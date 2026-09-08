// pack.js — sprite-sheet packing: fixed grid layouts and a MaxRects-style
// packed atlas with trim metadata, edge extrusion hooks, power-of-two sizing
// and occupancy stats. Pure layout logic (no pixel work) — the heavy lifting
// compositing is done by the caller with blit/extrude from img.js.

function nextPowerOfTwo(v) { let p = 2; while (p < v) p <<= 1; return p; }

/**
 * Grid layout.
 * frames: [{ key, w, h }] — the size each frame will OCCUPY in the sheet.
 * opts: { mode: 'horizontal'|'vertical'|'rows'|'columns', count?, cellW?, cellH?,
 *         padding, borderPadding, powerOfTwo }
 * count = how many per row (rows mode) or per column (columns mode).
 * Returns { width, height, placements: Map(key → {x, y, w, h, rotated:false}) }
 */
export function packGrid(frames, opts = {}) {
  const { mode = 'horizontal', borderPadding = 0, padding = 0, powerOfTwo = false } = opts;
  if (!frames.length) throw new Error('Nothing to pack');
  const cellW = opts.cellW || Math.max(...frames.map(f => f.w));
  const cellH = opts.cellH || Math.max(...frames.map(f => f.h));
  let cols, rows;
  if (mode === 'horizontal') { cols = frames.length; rows = 1; }
  else if (mode === 'vertical') { cols = 1; rows = frames.length; }
  else if (mode === 'rows') {
    cols = opts.count || Math.ceil(Math.sqrt(frames.length));
    rows = Math.ceil(frames.length / cols);
  } else if (mode === 'columns') {
    rows = opts.count || Math.ceil(Math.sqrt(frames.length));
    cols = Math.ceil(frames.length / rows);
  } else throw new Error(`Unknown grid mode ${mode}`);
  let width = borderPadding * 2 + cols * cellW + Math.max(0, cols - 1) * padding;
  let height = borderPadding * 2 + rows * cellH + Math.max(0, rows - 1) * padding;
  if (powerOfTwo) { width = nextPowerOfTwo(width); height = nextPowerOfTwo(height); }
  const placements = new Map();
  frames.forEach((f, i) => {
    const c = mode === 'columns' ? (i / rows | 0) : i % cols;
    const r = mode === 'columns' ? i % rows : (i / cols | 0);
    const x = borderPadding + c * (cellW + padding) + Math.floor((cellW - f.w) / 2);
    const y = borderPadding + r * (cellH + padding) + Math.floor((cellH - f.h) / 2);
    placements.set(f.key, { x, y, w: f.w, h: f.h, rotated: false, cell: { x: borderPadding + c * (cellW + padding), y: borderPadding + r * (cellH + padding), w: cellW, h: cellH } });
  });
  return { width, height, placements, mode };
}

/**
 * MaxRects bin packing (Best Short Side Fit).
 * frames: [{ key, w, h, allowRotate? }]
 * opts: { padding, borderPadding, powerOfTwo, maxWidth, maxHeight, allowRotate }
 * Automatically grows a power-of-two-ish bin until everything fits or max is hit.
 * Returns { width, height, placements, occupancy }
 */
export function packAtlas(frames, opts = {}) {
  const { padding = 1, borderPadding = 0, powerOfTwo = false, allowRotate = false,
          maxWidth = 4096, maxHeight = 4096 } = opts;
  if (!frames.length) throw new Error('Nothing to pack');
  const padded = frames.map(f => ({ ...f, pw: f.w + padding * 2, ph: f.h + padding * 2 }));
  const totalArea = padded.reduce((s, f) => s + f.pw * f.ph, 0);
  const maxSide = Math.max(...padded.map(f => Math.max(f.pw, f.ph)));
  // candidate bin sizes, growing until fit
  const baseW = powerOfTwo ? nextPowerOfTwo(Math.max(2, Math.ceil(Math.sqrt(totalArea)), maxSide))
                           : Math.max(2, Math.ceil(Math.sqrt(totalArea)), maxSide);
  const candidates = [];
  let cw = baseW, ch = baseW;
  for (let i = 0; i < 14; i++) {
    candidates.push({ w: cw, h: ch });
    if (cw <= ch) cw *= 2; else ch *= 2;
  }
  let lastError = null;
  for (const cand of candidates) {
    if (cand.w > maxWidth || cand.h > maxHeight) { lastError = `Atlas ${cand.w}×${cand.h} exceeds max ${maxWidth}×${maxHeight}`; continue; }
    const result = tryPack(padded, cand.w - borderPadding * 2, cand.h - borderPadding * 2, allowRotate);
    if (result) {
      const placements = new Map();
      for (const r of result) placements.set(r.key, { x: r.x + borderPadding + padding, y: r.y + borderPadding + padding, w: r.w, h: r.h, rotated: r.rotated });
      const usedArea = frames.reduce((s, f) => s + f.w * f.h, 0);
      return { width: cand.w, height: cand.h, placements, occupancy: usedArea / (cand.w * cand.h), padding, borderPadding };
    }
    lastError = `Could not fit all sprites into ${cand.w}×${cand.h}`;
  }
  throw new Error(`Atlas too large: ${lastError}`);
}

function tryPack(rects, binW, binH, allowRotate) {
  const sorted = [...rects].sort((a, b) => Math.max(b.pw, b.ph) - Math.max(a.pw, a.ph));
  const freeRects = [{ x: 0, y: 0, w: binW, h: binH }];
  const placed = [];
  for (const rect of sorted) {
    let best = null;
    for (let i = 0; i < freeRects.length; i++) {
      const fr = freeRects[i];
      if (rect.pw <= fr.w && rect.ph <= fr.h) {
        const score = Math.min(fr.w - rect.pw, fr.h - rect.ph);
        if (!best || score < best.score) best = { idx: i, rotated: false, score, w: rect.pw, h: rect.ph };
      }
      if (allowRotate && rect.allowRotate !== false && rect.ph <= fr.w && rect.pw <= fr.h && rect.pw !== rect.ph) {
        const score = Math.min(fr.w - rect.ph, fr.h - rect.pw);
        if (!best || score < best.score) best = { idx: i, rotated: true, score, w: rect.ph, h: rect.pw };
      }
    }
    if (!best) return null;
    const free = freeRects[best.idx];
    placed.push({ key: rect.key, x: free.x, y: free.y, w: rect.w, h: rect.h, rotated: best.rotated, pw: best.w, ph: best.h });
    // split free rect (guillotine on placed rect)
    splitFreeRect(freeRects, { x: free.x, y: free.y, w: best.w, h: best.h });
    pruneFreeRects(freeRects);
  }
  return placed;
}

function splitFreeRect(freeRects, used) {
  for (let i = freeRects.length - 1; i >= 0; i--) {
    const fr = freeRects[i];
    if (used.x >= fr.x + fr.w || used.x + used.w <= fr.x || used.y >= fr.y + fr.h || used.y + used.h <= fr.y) continue;
    freeRects.splice(i, 1);
    if (used.x > fr.x) freeRects.push({ x: fr.x, y: fr.y, w: used.x - fr.x, h: fr.h }); // left
    if (used.x + used.w < fr.x + fr.w) freeRects.push({ x: used.x + used.w, y: fr.y, w: fr.x + fr.w - (used.x + used.w), h: fr.h }); // right
    if (used.y > fr.y) freeRects.push({ x: fr.x, y: fr.y, w: fr.w, h: used.y - fr.y }); // top
    if (used.y + used.h < fr.y + fr.h) freeRects.push({ x: fr.x, y: used.y + used.h, w: fr.w, h: fr.y + fr.h - (used.y + used.h) }); // bottom
  }
}

function pruneFreeRects(freeRects) {
  for (let i = freeRects.length - 1; i >= 0; i--) {
    for (let j = freeRects.length - 1; j >= 0; j--) {
      if (i === j) continue;
      if (contains(freeRects[j], freeRects[i])) { freeRects.splice(i, 1); break; }
    }
  }
}
function contains(a, b) { return b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h; }

/** Verify no placements overlap (used by tests + QA). */
export function placementsOverlap(placements) {
  const list = [...placements.values()];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) return true;
  }
  return false;
}

// ---------------------------------------------------------------- metadata

/**
 * Assemble the generic game-ready metadata document for a packed sheet.
 * items: [{ name, index, key, sourceW, sourceH, trimRect (relative to source),
 *           sourceOffset, pivot {x,y}, durationMs, tags, boxes, points, rotated }]
 * placements: Map from pack*.
 */
export function buildSheetMetadata({ project, character, animation, direction, width, height, items, placements, schema = 'spritefoundry-1' }) {
  const frames = items.map((item) => {
    const p = placements.get(item.key);
    if (!p) throw new Error(`No placement for frame "${item.name}" — metadata would lie; refusing to build`);
    return {
      name: item.name,
      index: item.index,
      x: p.x, y: p.y, w: p.w, h: p.h,
      rotated: !!p.rotated,
      sourceW: item.sourceW ?? p.w,
      sourceH: item.sourceH ?? p.h,
      offsetX: item.sourceOffset?.x ?? 0,
      offsetY: item.sourceOffset?.y ?? 0,
      pivotX: item.pivot?.x ?? 0.5,
      pivotY: item.pivot?.y ?? 1,
      durationMs: item.durationMs ?? 100,
      tags: item.tags ?? [],
      boxes: item.boxes ?? [],
      points: item.points ?? [],
    };
  });
  return {
    schema,
    app: 'sprite-foundry',
    project: project || 'untitled',
    character: character || 'character',
    animation: animation || 'clip',
    direction: direction || 'south',
    generatedAt: new Date().toISOString(),
    image: { width, height },
    frames,
    pivotNote: 'pivotX/pivotY are normalized to the SOURCE (untrimmed) sprite rectangle; offsetX/offsetY reconstruct original placement: draw at (x,y) region onto a sourceW×sourceH canvas shifted by offset.',
  };
}

/** Aseprite-style JSON export (frames hash + frameTags). */
export function toAsepriteJson(meta, imageName = 'sheet.png', tagName = 'walk') {
  const frames = {};
  for (const f of meta.frames) {
    frames[f.name] = {
      frame: { x: f.x, y: f.y, w: f.w, h: f.h },
      rotated: f.rotated,
      trimmed: f.sourceW !== f.w || f.sourceH !== f.h,
      spriteSourceSize: { x: f.offsetX, y: f.offsetY, w: f.w, h: f.h },
      sourceSize: { w: f.sourceW, h: f.sourceH },
      duration: f.durationMs,
    };
  }
  return {
    frames,
    meta: {
      app: 'aseprite-compat (sprite-foundry)',
      image: imageName,
      size: { w: meta.image.width, h: meta.image.height },
      scale: '1',
      frameTags: [{ name: tagName, from: 0, to: meta.frames.length - 1, direction: 'forward' }],
      pivots: Object.fromEntries(meta.frames.map(f => [f.name, { x: f.pivotX, y: f.pivotY }])),
    },
  };
}

/** Phaser 3 / PixiJS JSON-hash atlas export. */
export function toPhaserJson(meta, imageName = 'sheet.png') {
  const frames = {};
  for (const f of meta.frames) {
    frames[f.name] = {
      frame: { x: f.x, y: f.y, w: f.w, h: f.h },
      rotated: false, // phaser rotation unsupported here — we never rotate
      trimmed: f.sourceW !== f.w || f.sourceH !== f.h,
      spriteSourceSize: { x: f.offsetX, y: f.offsetY, w: f.w, h: f.h },
      sourceSize: { w: f.sourceW, h: f.sourceH },
      pivot: { x: f.pivotX, y: f.pivotY },
    };
  }
  return { frames, meta: { image: imageName, size: { w: meta.image.width, h: meta.image.height }, scale: 1 } };
}
