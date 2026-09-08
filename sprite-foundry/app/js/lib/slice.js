// slice.js — sprite-sheet slicing: grid, smart region detection, metadata
// import (with validation). Pure logic, fully unit-testable.
import { alphaBBox, detectBackgroundColor } from './img.js';

/**
 * Compute grid slice rectangles.
 * Accepts EITHER cols/rows (cell size derived) OR cellW/cellH (count derived).
 * opts: { sheetW, sheetH, columns?, rows?, cellW?, cellH?, offsetX?, offsetY?,
 *         spacingX?, spacingY? }
 * Throws with a useful message on invalid input. Returns [{ x, y, w, h }].
 */
export function gridSlices(opts) {
  const { sheetW, sheetH } = opts;
  if (!sheetW || !sheetH || sheetW <= 0 || sheetH <= 0) throw new Error('Invalid sheet dimensions');
  const offsetX = opts.offsetX || 0, offsetY = opts.offsetY || 0;
  const spacingX = opts.spacingX || 0, spacingY = opts.spacingY || 0;
  const availW = sheetW - offsetX, availH = sheetH - offsetY;
  if (availW <= 0 || availH <= 0) throw new Error(`Grid offset (${offsetX},${offsetY}) lies outside the ${sheetW}×${sheetH} sheet`);
  let { columns, rows, cellW, cellH } = opts;
  if (columns && rows && cellW && cellH) {
    // fully specified — validate consistency but trust user
  } else if (columns && rows) {
    cellW = Math.floor((availW - spacingX * (columns - 1)) / columns);
    cellH = Math.floor((availH - spacingY * (rows - 1)) / rows);
    if (cellW <= 0 || cellH <= 0) throw new Error(`Cannot fit ${columns}×${rows} cells (with spacing) in the sheet`);
  } else if (cellW && cellH) {
    if (cellW <= 0 || cellH <= 0) throw new Error('Cell dimensions must be positive');
    columns = Math.max(0, Math.floor((availW + spacingX) / (cellW + spacingX)));
    rows = Math.max(0, Math.floor((availH + spacingY) / (cellH + spacingY)));
    if (columns === 0 || rows === 0) throw new Error(`Cell ${cellW}×${cellH} does not fit in the sheet at all`);
  } else {
    throw new Error('Grid slicing needs either columns+rows or cell width+height');
  }
  const rects = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const x = offsetX + c * (cellW + spacingX);
      const y = offsetY + r * (cellH + spacingY);
      if (x + cellW > sheetW || y + cellH > sheetH) {
        throw new Error(`Grid overflows sheet at cell (${c},${r}) — check cell size/offset/spacing`);
      }
      rects.push({ x, y, w: cellW, h: cellH });
    }
  }
  return rects;
}

/**
 * Smart region detection for irregular sheets.
 * Builds a foreground mask (non-transparent, or non-background when a solid
 * background colour is detected on opaque sheets), closes it with a small
 * dilation radius so multi-part sprites stay together, labels connected
 * components (4-connectivity) and returns their bounding boxes.
 * Deterministic; results are MEANT to be user-corrected.
 * Returns { rects: [{x,y,w,h}], background: [r,g,b]|null }
 */
export function detectRegions(img, opts = {}) {
  const { minSize = 4, mergeRadius = 4, includeSmalls = false, userBackground = null } = opts;
  const { width: w, height: h } = img;
  const d = img.data;
  const bg = userBackground || detectBackgroundColor(img);
  // 1. foreground mask
  let mask = new Uint8Array(w * h);
  const bgTol2 = 3 * 24 * 24;
  for (let i = 0; i < w * h; i++) {
    const a = d[i * 4 + 3];
    if (a < 8) continue;
    if (bg) {
      const dr = d[i * 4] - bg[0], dg = d[i * 4 + 1] - bg[1], db = d[i * 4 + 2] - bg[2];
      if (dr * dr + dg * dg + db * db <= bgTol2) continue;
    }
    mask[i] = 1;
  }
  // 2. dilation (closing/reunion of sprite parts)
  for (let pass = 0; pass < mergeRadius; pass++) {
    const next = new Uint8Array(mask);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (mask[i]) continue;
      if (mask[i - 1] || mask[i + 1] || mask[i - w] || mask[i + w]) next[i] = 2;
    }
    mask = next;
  }
  // 3. connected components (only count ORIGINAL mask pixels for size)
  const labels = new Int32Array(w * h).fill(-1);
  const rects = [];
  let cur = -1;
  const stack = [];
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || labels[start] >= 0) continue;
    cur++;
    let minX = w, minY = h, maxX = -1, maxY = -1, solidCount = 0;
    stack.length = 0; stack.push(start);
    labels[start] = cur;
    while (stack.length) {
      const i = stack.pop();
      const x = i % w, y = (i / w) | 0;
      if (mask[i] === 1) {
        solidCount++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      const nb = [i - 1, i + 1, i - w, i + w];
      for (const ni of nb) {
        const nx = ni % w;
        if (ni < 0 || ni >= w * h || labels[ni] >= 0 || !mask[ni]) continue;
        if ((ni === i - 1 || ni === i + 1) && Math.abs(nx - x) !== 1) continue; // row wrap
        labels[ni] = cur;
        stack.push(ni);
      }
    }
    if (maxX < 0) continue; // dilation-only component, no real pixels
    const rw = maxX - minX + 1, rh = maxY - minY + 1;
    if (rw >= minSize && rh >= minSize) rects.push({ x: minX, y: minY, w: rw, h: rh });
    else if (includeSmalls) rects.push({ x: minX, y: minY, w: rw, h: rh, tiny: true });
  }
  // reading order: cluster into row bands (overlapping y-ranges share a row),
  // then sort left→right inside each row
  rects.sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  for (const r of rects) {
    const row = rows.find(g => r.y < g.bottom);
    if (row) { row.items.push(r); row.bottom = Math.max(row.bottom, r.y + r.h); }
    else rows.push({ bottom: r.y + r.h, items: [r] });
  }
  const ordered = rows.flatMap(g => g.items.sort((a, b) => a.x - b.x));
  return { rects: ordered, background: bg };
}

// ---------------------------------------------------------------- metadata import

/**
 * Parse sheet metadata JSON from several real-world formats:
 *  - Sprite Foundry generic schema (frames array)
 *  - Aseprite JSON (frames hash/array + meta.frameTags)
 *  - TexturePacker "JSONArray"/"JSONHash"
 * validate: { sheetW, sheetH } bounds check. Throws descriptive errors.
 * Returns { frames: [{ name, x, y, w, h, sourceW, sourceH, offsetX, offsetY,
 *                      pivotX, pivotY, durationMs }], tags: [{ name, from, to }] }
 */
export function parseSheetMetadata(json, { sheetW, sheetH } = {}) {
  if (!json || typeof json !== 'object') throw new Error('Metadata is not a JSON object');
  const frames = [];
  const tags = [];
  const num = (v, field, owner) => {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error(`Invalid ${field} (${v}) for frame "${owner}"`);
    return n;
  };
  const pushFrame = (name, f, src) => {
    const frame = {
      name: String(name),
      x: num(f.x ?? f.frame?.x, 'x', name), y: num(f.y ?? f.frame?.y, 'y', name),
      w: num(f.w ?? f.frame?.w, 'width', name), h: num(f.h ?? f.frame?.h, 'height', name),
      sourceW: num(f.sourceW ?? f.sourceSize?.w ?? f.w ?? f.frame?.w, 'source width', name),
      sourceH: num(f.sourceH ?? f.sourceSize?.h ?? f.h ?? f.frame?.h, 'source height', name),
      offsetX: Number(f.offsetX ?? f.spriteSourceSize?.x ?? 0) || 0,
      offsetY: Number(f.offsetY ?? f.spriteSourceSize?.y ?? 0) || 0,
      pivotX: f.pivotX ?? f.pivot?.x ?? null,
      pivotY: f.pivotY ?? f.pivot?.y ?? null,
      durationMs: Number(f.durationMs ?? f.duration ?? 0) || null,
      rotated: !!f.rotated,
    };
    if (frame.w <= 0 || frame.h <= 0) throw new Error(`Frame "${name}" has non-positive dimensions (${frame.w}×${frame.h})`);
    if (sheetW != null && sheetH != null) {
      if (frame.x < 0 || frame.y < 0 || frame.x + frame.w > sheetW || frame.y + frame.h > sheetH) {
        throw new Error(`Frame "${name}" rectangle (${frame.x},${frame.y} ${frame.w}×${frame.h}) lies outside the ${sheetW}×${sheetH} sheet`);
      }
    }
    frames.push(frame);
  };

  if (Array.isArray(json.frames)) { // Sprite Foundry / TexturePacker JSONArray
    json.frames.forEach((f, i) => pushFrame(f.name ?? f.filename ?? `frame_${i}`, f, json));
  } else if (json.frames && typeof json.frames === 'object') { // Aseprite / TP JSONHash
    for (const [name, f] of Object.entries(json.frames)) pushFrame(name, f, json);
  } else {
    throw new Error('Unrecognized metadata format: expected a "frames" array or object (Sprite Foundry / Aseprite / TexturePacker JSON)');
  }
  if (frames.length === 0) throw new Error('Metadata contains zero frames');
  // pivot range validation
  for (const f of frames) {
    if (f.pivotX != null && (f.pivotX < -2 || f.pivotX > 3) || f.pivotY != null && (f.pivotY < -2 || f.pivotY > 3)) {
      throw new Error(`Frame "${f.name}" pivot (${f.pivotX},${f.pivotY}) looks implausible (expected ~0..1 normalized)`);
    }
  }
  const tagSrc = json.meta?.frameTags || json.tags || [];
  for (const t of tagSrc) {
    const from = num(t.from ?? t.start ?? 0, 'tag from', t.name);
    const to = num(t.to ?? t.end ?? from, 'tag to', t.name);
    if (from < 0 || to >= frames.length || to < from) continue; // tolerate foreign formats
    tags.push({ name: String(t.name || 'tag'), from, to, direction: t.direction || 'forward' });
  }
  return { frames, tags, source: json.meta?.app || 'external' };
}
