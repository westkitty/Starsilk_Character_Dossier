// png.js — dependency-free PNG encoder/decoder for RGBA Img buffers.
// Deflate/inflate are injected so the same code runs in Node (zlib) and, if
// needed, in browsers (CompressionStream). The browser app normally uses
// canvas for PNG I/O; this codec powers the deterministic Node tests and APNG.
import { crc32 } from './crc.js';

const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function chunk(type, payload) {
  const out = new Uint8Array(12 + payload.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, payload.length, false);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(payload, 8);
  const crc = crc32(out, 4, 8 + payload.length);
  view.setUint32(8 + payload.length, crc >>> 0, false);
  return out;
}

/** Raw scanlines (filter byte 0 + RGBA row) — the exact bytes PNG deflates. */
export function rawScanlines(img) {
  const { width: w, height: h } = img;
  const raw = new Uint8Array((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    raw.set(img.data.subarray(y * w * 4, (y + 1) * w * 4), y * (w * 4 + 1) + 1);
  }
  return raw;
}

/** Encode Img (RGBA) → PNG bytes. deflateSync: (rawBytes) => Uint8Array (zlib stream). */
export function encodePng(img, { deflateSync }) {
  const { width: w, height: h } = img;
  const compressed = deflateSync(rawScanlines(img));
  const ihdr = new DataView(new ArrayBuffer(13));
  ihdr.setUint32(0, w, false); ihdr.setUint32(4, h, false);
  ihdr.setUint8(8, 8);   // bit depth
  ihdr.setUint8(9, 6);   // colour type RGBA
  const parts = [Uint8Array.from(SIG), chunk('IHDR', new Uint8Array(ihdr.buffer)), chunk('IDAT', compressed), chunk('IEND', new Uint8Array(0))];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out;
}

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/**
 * Decode PNG bytes → Img. Supports 8-bit colour type 6 (RGBA) and 2 (RGB),
 * non-interlaced — which covers every PNG this application writes.
 * inflateSync: (zlib bytes) => Uint8Array.
 */
export function decodePng(bytes, { inflateSync }) {
  for (let i = 0; i < 8; i++) if (bytes[i] !== SIG[i]) throw new Error('Not a PNG (bad signature)');
  let pos = 8, width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  const idat = [];
  while (pos < bytes.length) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + pos);
    const len = view.getUint32(0, false);
    const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
    const payload = bytes.subarray(pos + 8, pos + 8 + len);
    const expectedCrc = view.getUint32(8 + len, false) >>> 0;
    if (crc32(bytes, pos + 4, pos + 8 + len) !== expectedCrc) throw new Error(`PNG chunk ${type} failed CRC`);
    if (type === 'IHDR') {
      const v = new DataView(payload.buffer, payload.byteOffset);
      width = v.getUint32(0, false); height = v.getUint32(4, false);
      bitDepth = v.getUint8(8); colorType = v.getUint8(9); interlace = v.getUint8(12);
    } else if (type === 'IDAT') idat.push(payload);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth ${bitDepth}`);
  if (colorType !== 6 && colorType !== 2) throw new Error(`Unsupported PNG colour type ${colorType}`);
  if (interlace !== 0) throw new Error('Interlaced PNG not supported by this decoder');
  const totalLen = idat.reduce((s, c) => s + c.length, 0);
  const zdata = new Uint8Array(totalLen);
  let p = 0; for (const c of idat) { zdata.set(c, p); p += c.length; }
  const raw = inflateSync(zdata);
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const out = new Uint8ClampedArray(width * height * 4);
  let prev = new Uint8Array(stride), src = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[src++];
    const line = raw.subarray(src, src + stride); src += stride;
    const recon = new Uint8Array(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? recon[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v = (v + a) & 255;
      else if (filter === 2) v = (v + b) & 255;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (filter === 4) v = (v + paeth(a, b, c)) & 255;
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
      recon[x] = v;
    }
    if (bpp === 4) out.set(recon, y * width * 4);
    else for (let x = 0; x < width; x++) {
      const si = x * 3, di = (y * width + x) * 4;
      out[di] = recon[si]; out[di + 1] = recon[si + 1]; out[di + 2] = recon[si + 2]; out[di + 3] = 255;
    }
    prev = recon;
  }
  return { width, height, data: out };
}

/**
 * Build an APNG (animated PNG) from RGBA frames.
 * frames: [{ img, delayMs }]; loop: 0 = forever. Full-frame, blend=SOURCE,
 * dispose=NONE — honest, universal. deflateSync injected as above.
 */
export function encodeApng(frames, { deflateSync, loop = 0 }) {
  if (!frames.length) throw new Error('APNG: no frames');
  const { width: w, height: h } = frames[0].img;
  const parts = [Uint8Array.from(SIG)];
  const ihdr = new DataView(new ArrayBuffer(13));
  ihdr.setUint32(0, w, false); ihdr.setUint32(4, h, false);
  ihdr.setUint8(8, 8); ihdr.setUint8(9, 6);
  parts.push(chunk('IHDR', new Uint8Array(ihdr.buffer)));
  const actl = new DataView(new ArrayBuffer(8));
  actl.setUint32(0, frames.length, false);
  actl.setUint32(4, loop, false);
  parts.push(chunk('acTL', new Uint8Array(actl.buffer)));
  let seq = 0;
  frames.forEach(({ img, delayMs }, i) => {
    if (img.width !== w || img.height !== h) throw new Error('APNG: frame size mismatch');
    const fctl = new DataView(new ArrayBuffer(26));
    fctl.setUint32(0, seq++, false);
    fctl.setUint32(4, w, false); fctl.setUint32(8, h, false);
    fctl.setUint32(12, 0, false); fctl.setUint32(16, 0, false);
    fctl.setUint16(20, delayMs, false); fctl.setUint16(22, 1000, false);
    fctl.setUint8(24, 0); fctl.setUint8(25, 0);
    parts.push(chunk('fcTL', new Uint8Array(fctl.buffer)));
    const compressed = deflateSync(rawScanlines(img));
    if (i === 0) parts.push(chunk('IDAT', compressed));
    else {
      const fdat = new Uint8Array(4 + compressed.length);
      new DataView(fdat.buffer).setUint32(0, seq++, false);
      fdat.set(compressed, 4);
      parts.push(chunk('fdAT', fdat));
    }
  });
  parts.push(chunk('IEND', new Uint8Array(0)));
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out;
}
