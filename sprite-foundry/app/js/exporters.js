// exporters.js — every file the app produces: PNG frames, ZIP sequences,
// GIF/APNG animation, sheets (with pack.js), metadata JSON, portable projects.
import { downloadBytes, downloadBlob, imgToBlob } from './browser.js';
import { encodeGif, validateGif } from './lib/gif.js';
import { encodeApng, rawScanlines } from './lib/png.js';
import { zipWrite, zipReadAsync } from './lib/zip.js';
import { extractPaletteFromHistogram, resizeNearest, flatten, createImg, blit, cloneImg } from './lib/img.js';
import { projectToManifest, manifestFromJson, collectImageIds } from './lib/serialize.js';

// ---------------------------------------------------------------- compositing

/** The frame as a full RGBA image at its working canvas (offset + flip applied). */
export function compositeFrame(frame, imgStore) {
  const img = imgStore.getImg(frame.imageId);
  const canvas = createImg(frame.canvasDims?.w ?? img.width, frame.canvasDims?.h ?? img.height);
  blit(canvas, img, frame.offset?.x ?? 0, frame.offset?.y ?? 0);
  if (frame.flipX) {
    const flipped = createImg(canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      const si = (y * canvas.width + x) * 4, di = (y * canvas.width + (canvas.width - 1 - x)) * 4;
      flipped.data[di] = canvas.data[si]; flipped.data[di + 1] = canvas.data[si + 1];
      flipped.data[di + 2] = canvas.data[si + 2]; flipped.data[di + 3] = canvas.data[si + 3];
    }
    return flipped;
  }
  return canvas;
}

/** Frames of a clip ready for a shared-canvas export (approved only by default). */
export function exportableFrames(anim, imgStore, { includeDrafts = false } = {}) {
  const frames = anim.frames.filter(f => f.imageId && (includeDrafts || f.status !== 'rejected'));
  if (!includeDrafts) {
    const approved = frames.filter(f => f.status === 'approved');
    if (approved.length) return { frames: approved.map(f => ({ frame: f, img: compositeFrame(f, imgStore) })), note: null };
  }
  return { frames: frames.map(f => ({ frame: f, img: compositeFrame(f, imgStore) })), note: includeDrafts ? 'including drafts' : null };
}

function uniformCanvas(items, scaleMode) {
  // scaleMode: { w, h, nearest: true } forces size; otherwise use max dims
  let w = scaleMode?.w ?? Math.max(...items.map(i => i.img.width));
  let h = scaleMode?.h ?? Math.max(...items.map(i => i.img.height));
  return items.map(({ frame, img }) => {
    let work = img;
    if (work.width !== w || work.height !== h) {
      const padded = createImg(w, h);
      blit(padded, work, Math.floor((w - work.width) / 2), Math.floor((h - work.height) / 2));
      work = padded;
    }
    return { frame, img: work };
  }).map(({ frame, img }) => ({ frame, img: scaleMode ? resizeNearest(img, w, h) : img }));
}

// ---------------------------------------------------------------- main exports

export class Exporters {
  constructor(store) { this.store = store; }

  /** Ensure every frame image is resident (lazy IDB load after reload). */
  async ensureImages(anim) {
    await Promise.all(anim.frames.filter(f => f.imageId).map(f => this.store.imgStore.ensure(f.imageId).catch(() => null)));
  }

  /** Individual PNGs (one download per frame — browser will stack them). */
  async exportPngSequenceZip(anim, { includeDrafts = false, scale = 1 } = {}) {
    await this.ensureImages(anim);
    const { frames } = exportableFrames(anim, this.store.imgStore, { includeDrafts });
    if (!frames.length) throw new Error('No frames to export');
    const entries = [];
    for (let i = 0; i < frames.length; i++) {
      const img = scale !== 1 ? resizeNearest(frames[i].img, frames[i].img.width * scale, frames[i].img.height * scale) : frames[i].img;
      const blob = await imgToBlob(img);
      entries.push({ name: `${anim.name}_${String(i).padStart(3, '0')}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
    }
    const zip = zipWrite(entries);
    downloadBytes(zip, `${anim.name}_sequence.zip`, 'application/zip');
    return { framesCount: entries.length, bytes: zip.length };
  }

  /** Real animated GIF. Returns validation + preview URL. */
  async exportGif(anim, opts = {}) {
    const { fps = anim.defaultFPS || 8, loop = 0, bg = null, scale = 1, includeDrafts = false, usePerFrameDurations = true } = opts;
    await this.ensureImages(anim);
    const { frames } = exportableFrames(anim, this.store.imgStore, { includeDrafts });
    if (!frames.length) throw new Error('No frames to export');
    let sized = uniformCanvas(frames, scale !== 1 ? { w: frames[0].img.width * scale, h: frames[0].img.height * scale } : null);
    if (scale !== 1) sized = sized.map(({ frame, img }) => ({ frame, img }));
    const gifFrames = sized.map(({ frame, img }) => ({
      img: bg ? flatten(img, bg) : img,
      delayMs: usePerFrameDurations ? frame.duration ?? 100 : Math.round(1000 / fps),
    }));
    const { bytes, warnings } = encodeGif(gifFrames, { loop, extractPaletteFn: extractPaletteFromHistogram, dither: false });
    const validation = validateGif(bytes);
    const blob = new Blob([bytes], { type: 'image/gif' });
    return {
      bytes, blob, warnings, validation,
      previewUrl: URL.createObjectURL(blob),
      download: () => downloadBlob(blob, `${anim.name}.gif`),
      framesCount: gifFrames.length,
    };
  }

  /** APNG export (full alpha). */
  async exportApng(anim, opts = {}) {
    const { fps = anim.defaultFPS || 8, loop = 0, usePerFrameDurations = true } = opts;
    await this.ensureImages(anim);
    const { frames } = exportableFrames(anim, this.store.imgStore, opts);
    if (!frames.length) throw new Error('No frames to export');
    const sized = uniformCanvas(frames, null);
    const raws = sized.map(({ img }) => rawScanlines(img));
    // deflate via browser CompressionStream, then feed synchronously to encoder
    const deflated = await Promise.all(raws.map(raw => deflateZlib(raw)));
    const map = new Map(raws.map((raw, i) => [raw, deflated[i]]));
    const deflateSync = raw => map.get(raw);
    const bytes = encodeApng(sized.map(({ frame, img }) => ({ img, delayMs: usePerFrameDurations ? frame.duration ?? 100 : Math.round(1000 / fps) })), { deflateSync, loop });
    const blob = new Blob([bytes], { type: 'image/apng' });
    return { bytes, blob, previewUrl: URL.createObjectURL(blob), download: () => downloadBlob(blob, `${anim.name}.png`), framesCount: sized.length };
  }

  // ---------------------------------------------------------------- project save/open

  async saveProject() {
    const manifest = projectToManifest(this.store.project);
    manifest.savedAt = new Date().toISOString();
    const entries = [{ name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) }];
    const ids = collectImageIds(this.store.project);
    let missing = [];
    for (const id of ids) {
      const blob = await this.store.imgStore.getBlob(id).catch(() => null);
      if (!blob) { missing.push(id); continue; }
      entries.push({ name: `media/${id}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
    }
    if (missing.length) throw new Error(`Cannot save: ${missing.length} referenced image(s) are missing locally (${missing.slice(0, 3).join(', ')}…)`);
    const zip = zipWrite(entries);
    const name = `${(this.store.project.name || 'project').replace(/[^\w.-]+/g, '_')}.spriteproject`;
    downloadBytes(zip, name, 'application/zip');
    return { name, images: ids.length, bytes: zip.length };
  }

  /** Load a .spriteproject file. Throws user-readable errors. */
  async openProject(file) {
    let bytes;
    try { bytes = new Uint8Array(await file.arrayBuffer()); }
    catch { throw new Error('Could not read the project file'); }
    let entries;
    try {
      entries = await zipReadAsync(bytes, { inflateAsync: inflateDeflateRaw });
    } catch (e) {
      throw new Error(`Project archive damaged: ${e.message}`);
    }
    const manifestEntry = entries.find(e => e.name === 'manifest.json');
    if (!manifestEntry) throw new Error('Project archive damaged: manifest.json missing');
    let json;
    try { json = JSON.parse(new TextDecoder().decode(manifestEntry.data)); }
    catch { throw new Error('Project archive damaged: manifest.json is not valid JSON'); }
    let parsed;
    try { parsed = manifestFromJson(json); }
    catch (e) { throw new Error(`Invalid project: ${e.message}`); }
    // media check
    const needed = new Set(collectImageIds(parsed.project));
    const missing = [];
    for (const id of needed) {
      const e = entries.find(x => x.name === `media/${id}.png`);
      if (!e) { missing.push(id); continue; }
      const blob = new Blob([e.data], { type: 'image/png' });
      const img = await (await import('./browser.js')).blobToImgData(blob);
      await this.store.imgStore.putBlob(blob, img.width, img.height, id);
    }
    if (missing.length) throw new Error(`Project references ${missing.length} image(s) not present in the archive (${missing.slice(0, 3).join(', ')}…)`);
    this.store.loadProject(parsed.project);
    return { project: parsed.project, images: needed.size };
  }
}

async function deflateZlib(bytes) {
  const cs = new CompressionStream('deflate');
  const stream = new Blob([bytes]).stream().pipeThrough(cs);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

async function inflateDeflateRaw(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}
