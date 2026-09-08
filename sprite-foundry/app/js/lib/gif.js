// gif.js — real GIF89a encoder and decoder for RGBA Img buffers.
// Encoder: global palette, transparency index, per-frame delays, loop count.
// Decoder: full LZW + interlace + disposal handling (enables GIF *import* and
// export validation, not just blind "trust it" saving).

// ---------------------------------------------------------------- encoder

class LzwEncoder {
  constructor(minCodeSize, writeByteStr) {
    this.minCodeSize = minCodeSize;
    this.out = [];
    this.cur = 0;
    this.curBits = 0;
    this.writeByte = writeByteStr;
  }
  flushBits() { /* handled in finish */ }
  emit(code, size) {
    this.cur |= code << this.curBits;
    this.curBits += size;
    while (this.curBits >= 8) {
      this.out.push(this.cur & 0xff);
      this.cur >>= 8;
      this.curBits -= 8;
    }
  }
}

/**
 * LZW-compress an array of palette indexes per GIF spec.
 * Returns Uint8Array: [minCodeSize, ...sub-blocks..., 0]
 */
export function lzwCompress(indexes, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  const enc = { out: [], cur: 0, curBits: 0 };
  const emit = (code, size) => {
    enc.cur |= code << enc.curBits;
    enc.curBits += size;
    while (enc.curBits >= 8) { enc.out.push(enc.cur & 0xff); enc.cur >>= 8; enc.curBits -= 8; }
  };
  let dict, nextCode, codeSize;
  const reset = () => { dict = new Map(); nextCode = eoiCode + 1; codeSize = minCodeSize + 1; };
  reset();
  emit(clearCode, codeSize);
  let prefix = -1;
  for (let i = 0; i < indexes.length; i++) {
    const k = indexes[i];
    if (prefix < 0) { prefix = k; continue; }
    const key = (prefix << 12) | k; // prefix up to 4095, k up to 255 → key fits
    const existing = dict.get(key);
    if (existing !== undefined) { prefix = existing; continue; }
    emit(prefix, codeSize);
    if (nextCode < 4096) {
      dict.set(key, nextCode++);
      if (nextCode - 1 === (1 << codeSize) && codeSize < 12) codeSize++;
    } else {
      emit(clearCode, codeSize);
      reset();
    }
    prefix = k;
  }
  if (prefix >= 0) emit(prefix, codeSize);
  emit(eoiCode, codeSize);
  if (enc.curBits > 0) enc.out.push(enc.cur & 0xff);
  // wrap in sub-blocks
  const bytes = enc.out;
  const blocks = [minCodeSize];
  for (let i = 0; i < bytes.length; i += 255) {
    const part = bytes.slice(i, i + 255);
    blocks.push(part.length, ...part);
  }
  blocks.push(0);
  return Uint8Array.from(blocks);
}

/** Decompress GIF LZW sub-block data → palette indexes. */
export function lzwDecompress(minCodeSize, data, expectedCount) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  // flatten sub-blocks
  const bytes = [];
  let ptr = 0;
  while (ptr < data.length) {
    const n = data[ptr++];
    if (n === 0) break;
    for (let i = 0; i < n; i++) bytes.push(data[ptr++]);
  }
  const out = [];
  let dict, nextCode, codeSize, prev;
  const reset = () => {
    dict = [];
    for (let i = 0; i < clearCode; i++) dict.push([i]);
    dict.push(null, null); // clear, eoi
    nextCode = eoiCode + 1;
    codeSize = minCodeSize + 1;
    prev = null;
  };
  reset();
  let bitPos = 0, cur = 0, curBits = 0;
  const readCode = () => {
    while (curBits < codeSize) {
      if (bitPos >= bytes.length) return -1;
      cur |= bytes[bitPos++] << curBits;
      curBits += 8;
    }
    const code = cur & ((1 << codeSize) - 1);
    cur >>= codeSize; curBits -= codeSize;
    return code;
  };
  for (;;) {
    const code = readCode();
    if (code < 0) break;
    if (code === clearCode) { reset(); continue; }
    if (code === eoiCode) break;
    let entry;
    if (code < dict.length && dict[code]) entry = dict[code];
    else if (code === nextCode && prev) entry = prev.concat(prev[0]);
    else throw new Error(`GIF LZW decode error: code ${code} out of range`);
    for (const b of entry) out.push(b);
    if (prev) dict[nextCode++] = prev.concat(entry[0]);
    // Decoder dictionary lags the encoder's by one entry, so it grows the
    // code size when nextCode REACHES 2^size (encoder: when it EXCEEDS it).
    if (nextCode === (1 << codeSize) && codeSize < 12) codeSize++;
    prev = entry;
    if (out.length > expectedCount + 4096) break; // corrupt stream guard
  }
  return out;
}

/**
 * Encode RGBA Img frames to an animated GIF.
 * frames: [{ img, delayMs }]
 * opts: { palette?: [[r,g,b]..] (pre-extracted), maxColors: 256, loop: 0 (forever),
 *         dither: bool, alphaThreshold: 128, disposal: 2 }
 * Transparent-index handling: if any pixel alpha < threshold, index 0 of the
 * global palette is reserved as the transparent colour.
 * Returns { bytes: Uint8Array, warnings: string[] }
 */
export function encodeGif(frames, opts = {}) {
  if (!frames || frames.length === 0) throw new Error('GIF: no frames to encode');
  const { maxColors = 256, loop = 0, alphaThreshold = 128, disposal = 2, extractPaletteFn } = opts;
  if (typeof extractPaletteFn !== 'function') throw new Error('encodeGif requires extractPaletteFn (img.js)');
  const w = frames[0].img.width, h = frames[0].img.height;
  const warnings = [];
  let anyAlpha = false, hasPartial = false;
  for (const f of frames) {
    if (f.img.width !== w || f.img.height !== h) throw new Error('GIF: all frames must share canvas dimensions');
    const d = f.img.data;
    for (let i = 3; i < d.length; i += 4) {
      if (d[i] < 255) anyAlpha = true;
      if (d[i] > alphaThreshold && d[i] < 255) hasPartial = true;
    }
  }
  if (hasPartial) {
    warnings.push('GIF supports only binary transparency. Partially transparent edge pixels will be thresholded; alpha edges will look harsher than the source. Consider APNG export for full alpha.');
  }
  // palette for actual sprite colours
  const colorBudget = anyAlpha ? maxColors - 1 : maxColors;
  let palette;
  if (opts.palette && opts.palette.length) palette = opts.palette.slice(0, colorBudget);
  else {
    // merged median-cut across frames: build a synthetic histogram array
    const merged = new Map();
    for (const f of frames) {
      const d = f.img.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < alphaThreshold) continue;
        const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
        merged.set(k, (merged.get(k) || 0) + 1);
      }
    }
    palette = extractPaletteFn(merged, Math.max(1, colorBudget));
  }
  const transparentIndex = anyAlpha ? 0 : -1;
  const fullPalette = anyAlpha ? [[0, 0, 0], ...palette] : palette;
  // pad table to power of two
  let tableSize = 1;
  while (tableSize < fullPalette.length) tableSize <<= 1;
  tableSize = Math.max(2, tableSize);
  if (tableSize > 256) throw new Error('GIF: palette exceeds 256 colours');
  const gctBits = Math.log2(tableSize) - 1;

  const nearestCache = new Map();
  const nearest = (r, g, b) => {
    const k = (r << 16) | (g << 8) | b;
    let v = nearestCache.get(k);
    if (v !== undefined) return v;
    let best = 1, bestD = Infinity;
    const start = anyAlpha ? 1 : 0;
    for (let i = start; i < fullPalette.length; i++) {
      const p = fullPalette[i];
      const dr = p[0] - r, dg = p[1] - g, db = p[2] - b;
      const dd = dr * dr * 3 + dg * dg * 4 + db * db * 2;
      if (dd < bestD) { bestD = dd; best = i; }
    }
    nearestCache.set(k, best);
    return best;
  };

  const out = [];
  const push = (...b) => out.push(...b);
  // header
  push(0x47, 0x49, 0x46, 0x38, 0x39, 0x61); // GIF89a
  // logical screen descriptor
  push(w & 255, w >> 8, h & 255, h >> 8, 0xf0 | gctBits, 0, 0);
  for (let i = 0; i < tableSize; i++) {
    const c = fullPalette[i] || [0, 0, 0];
    push(c[0], c[1], c[2]);
  }
  // NETSCAPE looping extension
  push(0x21, 0xff, 0x0b, 0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30, 0x03, 0x01, loop & 255, (loop >> 8) & 255, 0x00);
  const minCodeSize = Math.max(2, Math.ceil(Math.log2(tableSize)));
  for (const f of frames) {
    const delayCs = Math.max(2, Math.round((f.delayMs ?? 100) / 10));
    // graphic control extension
    const packed = ((disposal & 7) << 2) | (transparentIndex >= 0 ? 1 : 0);
    push(0x21, 0xf9, 0x04, packed, delayCs & 255, delayCs >> 8, transparentIndex >= 0 ? transparentIndex : 0, 0x00);
    // image descriptor
    push(0x2c, 0, 0, 0, 0, w & 255, w >> 8, h & 255, h >> 8, 0x00);
    // pixel data
    const d = f.img.data;
    const indexes = new Array(w * h);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      indexes[p] = d[i + 3] < alphaThreshold && transparentIndex >= 0 ? transparentIndex : nearest(d[i], d[i + 1], d[i + 2]);
    }
    const compressed = lzwCompress(indexes, minCodeSize);
    push(...compressed);
  }
  push(0x3b); // trailer
  return { bytes: Uint8Array.from(out), warnings };
}

// ---------------------------------------------------------------- decoder

/**
 * Parse + fully decode a GIF into composited RGBA frames.
 * Returns { width, height, loopCount, frames: [{ img, delayMs, rect, disposal }] }
 */
export function decodeGif(bytes) {
  if (bytes.length < 14) throw new Error('Not a GIF: file too small');
  const sig = String.fromCharCode(...bytes.subarray(0, 6));
  if (sig !== 'GIF87a' && sig !== 'GIF89a') throw new Error(`Not a GIF: signature "${sig}"`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint16(6, true), height = view.getUint16(8, true);
  const gctFlag = bytes[10] & 0x80, gctSize = 1 << ((bytes[10] & 7) + 1);
  let ptr = 13;
  let gct = null;
  if (gctFlag) { gct = readPalette(gctSize); }
  let loopCount = null;
  const frames = [];
  const canvas = new Uint8ClampedArray(width * height * 4);
  let prevCanvas = null;
  const gce = { delayMs: 100, transparentIndex: -1, disposal: 0 };
  while (ptr < bytes.length) {
    const block = bytes[ptr++];
    if (block === 0x3b) break; // trailer
    if (block === 0x21) { // extension
      const label = bytes[ptr++];
      if (label === 0xf9) { // graphic control
        const size = bytes[ptr++];
        if (size !== 4) throw new Error('GIF: malformed graphic control extension');
        const packed = bytes[ptr];
        gce.disposal = (packed >> 2) & 7;
        gce.transparentIndex = packed & 1 ? bytes[ptr + 3] : -1;
        gce.delayMs = view.getUint16(ptr + 1, true) * 10;
        ptr += size + 1;
      } else if (label === 0xff) { // application
        const size = bytes[ptr++];
        const app = String.fromCharCode(...bytes.subarray(ptr, ptr + Math.min(size, 11)));
        ptr += size;
        if (app.startsWith('NETSCAPE')) {
          const sub = bytes[ptr++];
          if (sub === 3 && bytes[ptr] === 1) loopCount = view.getUint16(ptr + 1, true);
          ptr += sub;
          while (bytes[ptr] !== 0) ptr += bytes[ptr] + 1; // skip remaining
          ptr++;
        } else {
          while (bytes[ptr] !== 0) ptr += bytes[ptr] + 1;
          ptr++;
        }
      } else {
        while (bytes[ptr] !== 0) ptr += bytes[ptr] + 1;
        ptr++;
      }
      continue;
    }
    if (block !== 0x2c) throw new Error(`GIF: unexpected block 0x${block.toString(16)} at ${ptr - 1}`);
    const x = view.getUint16(ptr, true), y = view.getUint16(ptr + 2, true);
    const w = view.getUint16(ptr + 4, true), h = view.getUint16(ptr + 6, true);
    const packed = bytes[ptr + 8];
    ptr += 9;
    const lct = packed & 0x80 ? readPalette(1 << ((packed & 7) + 1)) : null;
    const interlaced = !!(packed & 0x40);
    const palette = lct || gct;
    if (!palette) throw new Error('GIF: image without color table');
    const minCodeSize = bytes[ptr++];
    const subStart = ptr;
    while (bytes[ptr] !== 0) ptr += bytes[ptr] + 1;
    ptr++;
    const data = bytes.subarray(subStart, ptr);
    const indexes = lzwDecompress(minCodeSize, data, w * h);
    if (gce.disposal === 3) prevCanvas = canvas.slice();
    let order = [...Array(h).keys()];
    if (interlaced) order = [0, 4, 2, 1].flatMap((start, pass) => {
      const step = [8, 8, 4, 2][pass];
      const rows = [];
      for (let r = start; r < h; r += step) rows.push(r);
      return rows;
    });
    for (let srcRow = 0; srcRow < h; srcRow++) {
      const row = interlaceRow(order, srcRow, h);
      for (let col = 0; col < w; col++) {
        const idx = indexes[srcRow * w + col];
        if (idx === undefined) continue;
        if (idx === gce.transparentIndex) continue; // leave canvas
        const c = palette[idx];
        if (!c) continue;
        const di = ((y + row) * width + (x + col)) * 4;
        if (di >= 0 && di < canvas.length) {
          canvas[di] = c[0]; canvas[di + 1] = c[1]; canvas[di + 2] = c[2]; canvas[di + 3] = 255;
        }
      }
    }
    frames.push({
      img: { width, height, data: canvas.slice() },
      delayMs: gce.delayMs || 100,
      rect: { x, y, w, h },
      disposal: gce.disposal,
    });
    if (gce.disposal === 2) { // restore to background (transparent unless bg color)
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
        const di = (yy * width + xx) * 4;
        canvas[di + 3] = 0; canvas[di] = 0; canvas[di + 1] = 0; canvas[di + 2] = 0;
      }
    } else if (gce.disposal === 3 && prevCanvas) {
      canvas.set(prevCanvas);
    }
    gce.transparentIndex = -1; gce.disposal = 0;
  }
  if (frames.length === 0) throw new Error('GIF: no image frames found');
  return { width, height, loopCount: loopCount ?? 1, frames };

  function readPalette(size) {
    const p = [];
    for (let i = 0; i < size; i++) { p.push([bytes[ptr], bytes[ptr + 1], bytes[ptr + 2]]); ptr += 3; }
    return p;
  }
  function interlaceRow(order, srcRow, h) { return order[srcRow]; }
}

/** Validate encoded GIF bytes: signature, animation, frame order, timing. */
export function validateGif(bytes) {
  const errors = [];
  let result = null;
  try { result = decodeGif(bytes); } catch (e) { errors.push(e.message); }
  if (!bytes || bytes.length < 6 || String.fromCharCode(...bytes.subarray(0, 3)) !== 'GIF') {
    errors.push('Missing GIF file signature');
  }
  if (result && result.frames.length < 2) errors.push('GIF contains only one frame (not animated)');
  return { ok: errors.length === 0, errors, frames: result?.frames.length ?? 0, delays: result?.frames.map(f => f.delayMs) ?? [], loopCount: result?.loopCount };
}
