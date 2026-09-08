// img.js — pure pixel-buffer utilities.
// An "Img" is a plain { width, height, data: Uint8ClampedArray } (RGBA, same
// layout as browser ImageData), so every function here runs identically in the
// browser and in Node tests without a canvas.

export function createImg(width, height, fill = 0) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`createImg: invalid dimensions ${width}x${height}`);
  }
  const data = new Uint8ClampedArray(width * height * 4);
  if (fill) data.fill(fill);
  return { width, height, data };
}

export function cloneImg(img) {
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
}

export function assertImg(img) {
  if (!img || !Number.isInteger(img.width) || !Number.isInteger(img.height) ||
      !img.data || img.data.length !== img.width * img.height * 4) {
    throw new Error('Not a valid Img (width/height/data mismatch)');
  }
}

export function solidImg(width, height, [r, g, b, a = 255]) {
  const img = createImg(width, height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a; }
  return img;
}

export function getPx(img, x, y) {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
}

export function setPx(img, x, y, [r, g, b, a = 255]) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = a;
}

export function fillRect(img, x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPx(img, xx, yy, color);
}

/** Copy src into dst at (dx,dy) with clipping, straight overwrite. */
export function blit(dst, src, dx = 0, dy = 0, sx = 0, sy = 0, sw = src.width, sh = src.height) {
  for (let y = 0; y < sh; y++) {
    const ty = dy + y, sy2 = sy + y;
    if (ty < 0 || ty >= dst.height || sy2 < 0 || sy2 >= src.height) continue;
    let tx0 = Math.max(dx, 0);
    let sx0 = sx + (tx0 - dx);
    let n = Math.min(sw - (sx0 - sx), dst.width - tx0, src.width - sx0);
    if (n <= 0) continue;
    dst.data.set(src.data.subarray((sy2 * src.width + sx0) * 4, (sy2 * src.width + sx0 + n) * 4),
                 (ty * dst.width + tx0) * 4);
  }
  return dst;
}

export function extractRect(img, x, y, w, h) {
  const out = createImg(w, h);
  for (let yy = 0; yy < h; yy++) {
    const sy = y + yy;
    if (sy < 0 || sy >= img.height) continue;
    const xs = Math.max(0, -x);
    const xe = Math.min(w, img.width - x);
    if (xe > xs) {
      out.data.set(img.data.subarray((sy * img.width + x + xs) * 4, (sy * img.width + x + xe) * 4),
                   (yy * w + xs) * 4);
    }
  }
  return out;
}

/** Bounding box of pixels with alpha > threshold. Returns null when empty. */
export function alphaBBox(img, alphaThreshold = 8) {
  const { width: w, height: h, data: d } = img;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (d[(row + x) * 4 + 3] > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * Trim transparent borders. Returns the trimmed image plus metadata that
 * allows exact reconstruction of the original placement:
 * draw trimmed.img at (trimRect.x, trimRect.y) on a sourceSize canvas.
 */
export function trimImage(img, alphaThreshold = 8) {
  const rect = alphaBBox(img, alphaThreshold);
  const sourceSize = { w: img.width, h: img.height };
  if (!rect) {
    return { img: createImg(Math.max(1, 1), 1), rect: null, sourceOffset: { x: 0, y: 0 }, sourceSize };
  }
  return {
    img: extractRect(img, rect.x, rect.y, rect.w, rect.h),
    rect,
    sourceOffset: { x: rect.x, y: rect.y },
    sourceSize,
  };
}

/** Pad/crop an image to (w,h) keeping the image at anchor position. */
export function fitToCanvas(img, w, h, anchor = 'center') {
  const out = createImg(w, h);
  let dx = 0, dy = 0;
  if (anchor === 'center') { dx = Math.round((w - img.width) / 2); dy = Math.round((h - img.height) / 2); }
  else if (anchor === 'bottom-center') { dx = Math.round((w - img.width) / 2); dy = h - img.height; }
  else if (anchor === 'top-left') { dx = 0; dy = 0; }
  blit(out, img, dx, dy);
  return { img: out, offset: { x: dx, y: dy } };
}

export function resizeNearest(img, w, h) {
  const out = createImg(w, h);
  const { width: sw, height: sh } = img;
  for (let y = 0; y < h; y++) {
    const sy = Math.min(sh - 1, (y * sh / h) | 0);
    for (let x = 0; x < w; x++) {
      const sx = Math.min(sw - 1, (x * sw / w) | 0);
      const di = (y * w + x) * 4, si = (sy * sw + sx) * 4;
      out.data[di] = img.data[si]; out.data[di + 1] = img.data[si + 1];
      out.data[di + 2] = img.data[si + 2]; out.data[di + 3] = img.data[si + 3];
    }
  }
  return out;
}

export function flipHorizontal(img) {
  const out = createImg(img.width, img.height);
  const { width: w, height: h } = img;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4, di = (y * w + (w - 1 - x)) * 4;
      out.data[di] = img.data[si]; out.data[di + 1] = img.data[si + 1];
      out.data[di + 2] = img.data[si + 2]; out.data[di + 3] = img.data[si + 3];
    }
  }
  return out;
}

/** Count of pixels that are neither fully opaque nor fully transparent. */
export function semiAlphaCount(img, lo = 8, hi = 247) {
  let n = 0;
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) if (d[i] > lo && d[i] < hi) n++;
  return n;
}

/** Hard-edge alpha: below threshold → 0, else 255. */
export function hardAlpha(img, threshold = 128) {
  const out = cloneImg(img);
  for (let i = 3; i < out.data.length; i += 4) out.data[i] = out.data[i] >= threshold ? 255 : 0;
  return out;
}

/** Flatten onto a solid background color (for GIF without alpha, previews). */
export function flatten(img, [r, g, b] = [255, 255, 255]) {
  const out = createImg(img.width, img.height);
  const d = img.data, o = out.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] / 255;
    o[i] = d[i] * a + r * (1 - a);
    o[i + 1] = d[i + 1] * a + g * (1 - a);
    o[i + 2] = d[i + 2] * a + b * (1 - a);
    o[i + 3] = 255;
  }
  return out;
}

/** Chroma-key: pixels within tolerance of key color become transparent. */
export function chromaKey(img, key, tolerance = 32) {
  const out = cloneImg(img);
  const [kr, kg, kb] = key;
  const t2 = tolerance * tolerance * 3;
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    const dr = d[i] - kr, dg = d[i + 1] - kg, db = d[i + 2] - kb;
    if (dr * dr + dg * dg + db * db <= t2) d[i + 3] = 0;
  }
  return out;
}

/** Guess a solid background color from the 4 corners. Returns null if disagreed/transparent. */
export function detectBackgroundColor(img) {
  const { width: w, height: h } = img;
  const corners = [getPx(img, 0, 0), getPx(img, w - 1, 0), getPx(img, 0, h - 1), getPx(img, w - 1, h - 1)];
  if (corners.every(c => c[3] < 8)) return null; // transparent
  const r = corners.reduce((s, c) => s + c[0], 0) / 4;
  const g = corners.reduce((s, c) => s + c[1], 0) / 4;
  const b = corners.reduce((s, c) => s + c[2], 0) / 4;
  for (const c of corners) {
    if (Math.abs(c[0] - r) > 12 || Math.abs(c[1] - g) > 12 || Math.abs(c[2] - b) > 12) return null;
  }
  return [Math.round(r), Math.round(g), Math.round(b)];
}

/** Opaque pixels with fewer than 2 opaque 8-neighbours (likely strays). */
export function findStrayPixels(img, alphaThreshold = 128) {
  const { width: w, height: h, data: d } = img;
  const strays = [];
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] >= alphaThreshold ? 1 : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!solid(x, y)) continue;
    const n = solid(x-1,y)+solid(x+1,y)+solid(x,y-1)+solid(x,y+1)+solid(x-1,y-1)+solid(x+1,y-1)+solid(x-1,y+1)+solid(x+1,y+1);
    if (n < 2) strays.push({ x, y });
  }
  return strays;
}

export function removeStrayPixels(img, alphaThreshold = 128) {
  const strays = findStrayPixels(img, alphaThreshold);
  const out = cloneImg(img);
  for (const { x, y } of strays) out.data[(y * out.width + x) * 4 + 3] = 0;
  return { img: out, removed: strays.length };
}

/**
 * Edge extrusion. Given an image and an amount N, returns an image padded by N
 * on every side where boundary pixels are copied outward N times (avoids
 * texture-sampling bleed in atlases).
 */
export function extrude(img, n) {
  const w = img.width, h = img.height;
  const out = createImg(w + n * 2, h + n * 2);
  blit(out, img, n, n);
  const d = out.data;
  for (let x = 0; x < w; x++) { // top/bottom columns
    for (let k = 0; k < n; k++) {
      copyPx(d, out, x + n, k, img, x, 0);
      copyPx(d, out, x + n, out.height - 1 - k, img, x, h - 1);
    }
  }
  for (let y = 0; y < h + n * 2; y++) { // left/right including corners via already-filled rows
    const sy = Math.min(h - 1, Math.max(0, y - n));
    for (let k = 0; k < n; k++) {
      copyPx(d, out, k, y, img, 0, sy);
      copyPx(d, out, out.width - 1 - k, y, img, w - 1, sy);
    }
  }
  return out;
  function copyPx(dd, dst, x, y, src, sx, sy) {
    const di = (y * dst.width + x) * 4, si = (sy * src.width + sx) * 4;
    dd[di] = src.data[si]; dd[di + 1] = src.data[si + 1]; dd[di + 2] = src.data[si + 2]; dd[di + 3] = src.data[si + 3];
  }
}

// ---------------------------------------------------------------- palette

export function colorKey(r, g, b) { return (r << 16) | (g << 8) | b; }

/** Histogram of fully-visible colors: Map(colorKey -> count). */
export function colorHistogram(img, alphaThreshold = 128) {
  const hist = new Map();
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < alphaThreshold) continue;
    const k = colorKey(d[i], d[i + 1], d[i + 2]);
    hist.set(k, (hist.get(k) || 0) + 1);
  }
  return hist;
}

/**
 * Median-cut palette extraction from an image. Deterministic. Returns array of
 * [r,g,b] sorted by population share. If the image already has <= maxColors
 * unique colors they are returned exactly (most frequent first).
 */
export function extractPalette(img, maxColors = 16, alphaThreshold = 128) {
  return extractPaletteFromHistogram(colorHistogram(img, alphaThreshold), maxColors);
}

/** Median-cut palette extraction from a Map(colorKey → count) histogram. */
export function extractPaletteFromHistogram(hist, maxColors = 16) {
  const total = [...hist.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  let entries = [...hist.entries()].map(([k, count]) => ({ k, count, r: (k >> 16) & 255, g: (k >> 8) & 255, b: k & 255 }));
  if (entries.length <= maxColors) {
    return entries.sort((a, b) => b.count - a.count).map(e => [e.r, e.g, e.b]);
  }
  // median cut
  let boxes = [entries];
  while (boxes.length < maxColors) {
    boxes.sort((a, b) => boxScore(b) - boxScore(a));
    const box = boxes.shift();
    if (!box || box.length === 0) break;
    // split along channel with largest range at its weighted median
    const ranges = channelRanges(box);
    const ch = ranges.r >= ranges.g && ranges.r >= ranges.b ? 'r' : (ranges.g >= ranges.b ? 'g' : 'b');
    box.sort((a, b) => a[ch] - b[ch]);
    const half = box.reduce((s, e) => s + e.count, 0) / 2;
    let acc = 0, cut = 1;
    for (let i = 0; i < box.length; i++) { acc += box[i].count; if (acc >= half) { cut = Math.max(1, i); break; } }
    const a = box.slice(0, cut), b = box.slice(cut);
    boxes.push(a.length ? a : box);
    if (b.length) boxes.push(b);
  }
  const out = boxes.filter(b => b.length).map(box => {
    let r = 0, g = 0, bl = 0, c = 0;
    for (const e of box) { r += e.r * e.count; g += e.g * e.count; bl += e.b * e.count; c += e.count; }
    return { r: Math.round(r / c), g: Math.round(g / c), b: Math.round(bl / c), count: c };
  });
  return out.sort((x, y) => y.count - x.count).map(e => [e.r, e.g, e.b]).slice(0, maxColors);

  function channelRanges(box) {
    let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
    for (const e of box) {
      if (e.r < rMin) rMin = e.r; if (e.r > rMax) rMax = e.r;
      if (e.g < gMin) gMin = e.g; if (e.g > gMax) gMax = e.g;
      if (e.b < bMin) bMin = e.b; if (e.b > bMax) bMax = e.b;
    }
    return { r: rMax - rMin, g: gMax - gMin, b: bMax - bMin };
  }
  function boxScore(box) {
    const ranges = channelRanges(box);
    return (ranges.r + ranges.g + ranges.b) * box.reduce((s, e) => s + e.count, 0);
  }
}

/**
 * Quantize image to an explicit palette. Preserves transparency (alpha < 8 →
 * fully transparent pixel [0,0,0,0]). Optional Floyd–Steinberg dithering.
 */
export function quantizeToPalette(img, palette, { dither = false, alphaThreshold = 8 } = {}) {
  if (!palette || palette.length === 0) throw new Error('quantizeToPalette: empty palette');
  const w = img.width, h = img.height;
  const out = createImg(w, h);
  // nearest-color cache
  const cache = new Map();
  const nearest = (r, g, b) => {
    const k = colorKey(r, g, b);
    let v = cache.get(k);
    if (v) return v;
    let best = palette[0], bestD = Infinity;
    for (const p of palette) {
      const dr = p[0] - r, dg = p[1] - g, db = p[2] - b;
      const dd = dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114;
      if (dd < bestD) { bestD = dd; best = p; }
    }
    v = best;
    cache.set(k, v);
    return v;
  };
  const err = dither ? new Float32Array(w * h * 3) : null;
  const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const pi = (y * w + x) * 4;
      const a = img.data[pi + 3];
      if (a < alphaThreshold) { out.data[pi + 3] = 0; continue; }
      let r = img.data[pi], g = img.data[pi + 1], b = img.data[pi + 2];
      if (err) {
        const ei = (y * w + x) * 3;
        r = clamp(r + err[ei]); g = clamp(g + err[ei + 1]); b = clamp(b + err[ei + 2]);
      }
      const p = nearest(Math.round(r), Math.round(g), Math.round(b));
      const oi = (y * w + x) * 4;
      out.data[oi] = p[0]; out.data[oi + 1] = p[1]; out.data[oi + 2] = p[2];
      out.data[oi + 3] = a;
      if (err) {
        const er = r - p[0], eg = g - p[1], eb = b - p[2];
        const spread = (dx, dy, f) => {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) return;
          const ni = (ny * w + nx) * 3;
          err[ni] += er * f; err[ni + 1] += eg * f; err[ni + 2] += eb * f;
        };
        spread(1, 0, 7 / 16); spread(-1, 1, 3 / 16); spread(0, 1, 5 / 16); spread(1, 1, 1 / 16);
      }
    }
  }
  return out;
}

/** Palette drift: colors present in image but further than tolerance from every palette color. */
export function colorsOutsidePalette(img, palette, tolerance = 24) {
  const hist = colorHistogram(img);
  const out = [];
  const t2 = tolerance * tolerance * 3;
  for (const [k, count] of hist) {
    const r = (k >> 16) & 255, g = (k >> 8) & 255, b = k & 255;
    let ok = false;
    for (const p of palette) {
      const dr = p[0] - r, dg = p[1] - g, db = p[2] - b;
      if (dr * dr + dg * dg + db * db <= t2) { ok = true; break; }
    }
    if (!ok) out.push({ color: [r, g, b], count });
  }
  return out.sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------- similarity

/** 16x16 average-luma hash (64-hex), aligned to shared canvas coords. */
export function phash(img, size = 16) {
  const small = resizeNearest(img, size, size);
  let sum = 0;
  const luma = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const a = small.data[i * 4 + 3];
    const l = a < 128 ? 0 : (small.data[i * 4] * 299 + small.data[i * 4 + 1] * 587 + small.data[i * 4 + 2] * 114) / 1000 / 255;
    luma[i] = l; sum += l;
  }
  const avg = sum / (size * size);
  const bits = [];
  for (let i = 0; i < size * size; i++) bits.push(luma[i] >= avg ? 1 : 0);
  return bits;
}

export function hamming(bitsA, bitsB) {
  let n = 0;
  for (let i = 0; i < bitsA.length; i++) if (bitsA[i] !== bitsB[i]) n++;
  return n;
}

/** IoU of alpha masks between two same-sized images. */
export function silhouetteIoU(a, b, alphaThreshold = 128) {
  const w = Math.max(a.width, b.width), h = Math.max(a.height, b.height);
  let inter = 0, union = 0;
  const solid = (img, x, y) => x < img.width && y < img.height && img.data[(y * img.width + x) * 4 + 3] >= alphaThreshold;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sa = solid(a, x, y), sb = solid(b, x, y);
    if (sa && sb) { inter++; union++; } else if (sa || sb) union++;
  }
  return union === 0 ? 1 : inter / union;
}

/** Grayscale silhouette for motion trails / ghost compare. */
export function silhouette(img, [r, g, b] = [255, 0, 128]) {
  const out = createImg(img.width, img.height);
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] >= 128) { out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b; out.data[i + 3] = 160; }
  }
  return out;
}

/** True when the alpha bounding box touches any canvas edge. */
export function touchesEdge(img, alphaThreshold = 8) {
  const bb = alphaBBox(img, alphaThreshold);
  if (!bb) return false;
  return bb.x === 0 || bb.y === 0 || bb.x + bb.w === img.width || bb.y + bb.h === img.height;
}
