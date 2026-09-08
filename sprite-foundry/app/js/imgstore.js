// imgstore.js — durable image storage.
// - Blobs persist in IndexedDB (survive reloads, no localStorage limits)
// - In-memory caches: decoded Img (RGBA), ObjectURL, tiny thumbnails
// - Object URLs are created lazily and revoked on eviction/deletion
import { blobToImgData, imgToBlob } from './browser.js';
import { resizeNearest } from './lib/img.js';

const DB_NAME = 'sprite-foundry';
const DB_VERSION = 1;
const STORE_IMAGES = 'images';
const STORE_KV = 'kv';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_IMAGES)) db.createObjectStore(STORE_IMAGES, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_KV)) db.createObjectStore(STORE_KV, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB unavailable'));
  });
}

export class ImageStore {
  constructor() {
    this.db = null;
    this.cache = new Map(); // id → { blob?, url?, img?, w, h, thumb? }
    this.listeners = new Set();
    this.enabled = true;
  }

  async init() {
    try { this.db = await openDb(); }
    catch (e) { console.warn('IndexedDB init failed; persistence disabled', e); this.enabled = false; }
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(id) { for (const fn of this.listeners) fn(id); }

  /** Store an Img (RGBA) under a new or given id. Returns id. */
  async putImg(img, id = null) {
    const imgId = id || `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const blobPromise = imgToBlob(img);
    const rec = { id: imgId, img, w: img.width, h: img.height, blob: null, thumb: makeThumb(img), dirty: true };
    this.cache.set(imgId, rec);
    try { rec.blob = await blobPromise; } catch { rec.blob = null; }
    if (this.db) {
      await idbPut(this.db, STORE_IMAGES, { id: imgId, blob: rec.blob, w: rec.w, h: rec.h });
      rec.dirty = false;
    }
    this.emit(imgId);
    return imgId;
  }

  async putBlob(blob, w, h, id = null) {
    const img = await blobToImgData(blob);
    const imgId = id || `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const rec = { id: imgId, img, w, h, blob, thumb: makeThumb(img), dirty: false };
    this.cache.set(imgId, rec);
    if (this.db) await idbPut(this.db, STORE_IMAGES, { id: imgId, blob, w, h });
    this.emit(imgId);
    return imgId;
  }

  has(id) { return this.cache.has(id); }

  /** Sync Img access (must have been loaded). Throws if absent. */
  getImg(id) {
    const rec = this.cache.get(id);
    if (!rec || !rec.img) throw new Error(`Image ${id} not loaded`);
    return rec.img;
  }

  getMeta(id) {
    const rec = this.cache.get(id);
    return rec ? { w: rec.w, h: rec.h } : null;
  }

  getThumb(id) { return this.cache.get(id)?.thumb ?? null; }

  /** Load from IndexedDB into memory if needed. */
  async ensure(id) {
    if (!id) return null;
    let rec = this.cache.get(id);
    if (rec && rec.img) return rec;
    if (!this.db) return null;
    const stored = await idbGet(this.db, STORE_IMAGES, id);
    if (!stored || !stored.blob) return null;
    const img = await blobToImgData(stored.blob);
    rec = { id, img, w: stored.w, h: stored.h, blob: stored.blob, thumb: makeThumb(img), dirty: false };
    this.cache.set(id, rec);
    this.emit(id);
    return rec;
  }

  async getBlob(id) {
    const rec = await this.ensure(id);
    if (!rec) return null;
    if (!rec.blob && rec.img) rec.blob = await imgToBlob(rec.img);
    return rec.blob;
  }

  /** Object URL (created lazily; revoked on delete). */
  async url(id) {
    const rec = await this.ensure(id);
    if (!rec) return null;
    if (!rec.url) {
      const blob = await this.getBlob(id);
      if (!blob) return null;
      rec.url = URL.createObjectURL(blob);
    }
    return rec.url;
  }

  async delete(id) {
    const rec = this.cache.get(id);
    if (rec?.url) URL.revokeObjectURL(rec.url);
    this.cache.delete(id);
    if (this.db) await idbDel(this.db, STORE_IMAGES, id);
    this.emit(id);
  }

  /** Remove images not in the keep-list (project garbage collection). */
  async collectGarbage(keepIds) {
    const keep = new Set(keepIds);
    for (const id of [...this.cache.keys()]) if (!keep.has(id)) await this.delete(id);
    if (this.db) {
      const all = await idbKeys(this.db, STORE_IMAGES);
      for (const id of all) if (!keep.has(id)) await idbDel(this.db, STORE_IMAGES, id);
    }
  }

  async kvGet(key) {
    if (!this.db) return null;
    const rec = await idbGet(this.db, STORE_KV, key);
    return rec?.value ?? null;
  }
  async kvSet(key, value) {
    if (!this.db) return;
    await idbPut(this.db, STORE_KV, { key, value });
  }
  async kvDel(key) { if (this.db) await idbDel(this.db, STORE_KV, key); }
}

function makeThumb(img, max = 96) {
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const small = resizeNearest(img, w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').putImageData(new ImageData(small.data, w, h), 0, 0);
  return c.toDataURL('image/png');
}

// tiny IDB promise helpers
function idbPut(db, store, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
function idbGet(db, store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function idbDel(db, store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
function idbKeys(db, store) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
