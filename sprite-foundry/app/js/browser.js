// browser.js — canvas/DOM glue between Img buffers, Blobs, files and URLs.
import { cloneImg } from './lib/img.js';
import { decodeGif } from './lib/gif.js';

export function imgToCanvas(img) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d');
  const imageData = new ImageData(img.data instanceof Uint8ClampedArray ? img.data : new Uint8ClampedArray(img.data), img.width, img.height);
  ctx.putImageData(imageData, 0, 0);
  return c;
}

export function canvasToImg(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: d.width, height: d.height, data: d.data };
}

export async function imgToBlob(img, type = 'image/png') {
  return new Promise((resolve, reject) => {
    imgToCanvas(img).toBlob(b => (b ? resolve(b) : reject(new Error('Canvas encode failed'))), type);
  });
}

export async function blobToImgData(blob) {
  const bitmap = await createImageBitmap(blob);
  const c = document.createElement('canvas');
  c.width = bitmap.width; c.height = bitmap.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const d = ctx.getImageData(0, 0, c.width, c.height);
  return { width: d.width, height: d.height, data: d.data };
}

/**
 * Import any supported image file:
 *   PNG/JPEG/WebP single frames, animated GIF (all frames with timings).
 * Returns { frames: [{ img, delayMs }], kind: 'still'|'gif' }
 */
export async function importImageFile(file) {
  if (!file || !file.type) throw new Error('No file provided');
  const ext = (file.name || '').toLowerCase();
  const isGif = file.type === 'image/gif' || ext.endsWith('.gif');
  if (isGif) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const gif = decodeGif(bytes); // throws descriptive errors
    return { kind: 'gif', frames: gif.frames.map(f => ({ img: f.img, delayMs: f.delayMs })), loopCount: gif.loopCount };
  }
  const ok = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'image/avif'];
  if (!ok.includes(file.type) && !/\.(png|jpe?g|webp|bmp|avif)$/i.test(ext)) {
    throw new Error(`Unsupported file type "${file.type || ext}". Import PNG, JPEG, WebP or GIF.`);
  }
  const img = await blobToImgData(file);
  return { kind: 'still', frames: [{ img: cloneImg(img), delayMs: 100 }] };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
}

export function downloadBytes(bytes, filename, mime = 'application/octet-stream') {
  downloadBlob(new Blob([bytes], { type: mime }), filename);
}

/** Pick a file via hidden input. accept: string. multiple: bool. */
export function pickFile({ accept = '', multiple = false } = {}) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => resolve(multiple ? [...input.files] : (input.files[0] || null));
    input.oncancel = () => resolve(multiple ? [] : null);
    input.click();
  });
}

export async function readClipboardImage() {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find(t => t.startsWith('image/'));
      if (type) return await item.getType(type);
    }
  } catch { /* permission / unsupported */ }
  return null;
}
