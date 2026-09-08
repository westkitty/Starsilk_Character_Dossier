// qa.js — deterministic frame-continuity diagnostics.
// These are WARNING systems over measurable pixel facts. They do not (and
// cannot) judge whether the character still "looks right" — the user decides.
import { alphaBBox, phash, hamming, silhouetteIoU, semiAlphaCount, touchesEdge, colorsOutsidePalette, resizeNearest } from './img.js';

/**
 * Analyze a clip of frames for continuity problems.
 * frames: [{ id, name, meta:{ w,h, duration?, pivot?:{x,y} } }] — descriptors
 * getImg(frame) → Img (sync; use a bounded/downsized variant if heavy)
 * opts: { palette?: [[r,g,b]], paletteTolerance, maxAnalyze: N (bound cost) }
 * Returns [{ frameId, index, kind, severity: 'warn'|'info', message }]
 */
export function analyzeClip(frames, getImg, opts = {}) {
  const warnings = [];
  const maxAnalyze = opts.maxAnalyze ?? 64;
  const imgs = [];
  for (let i = 0; i < Math.min(frames.length, maxAnalyze); i++) {
    let img = null;
    try { img = getImg(frames[i]); } catch { /* record below */ }
    imgs.push(img);
  }
  const dimsKey = f => `${f.meta.w}x${f.meta.h}`;
  const baseDims = frames.length ? dimsKey(frames[0]) : null;
  const bboxes = imgs.map(img => img ? alphaBBox(img) : null);
  const hashes = imgs.map(img => img ? phash(resizeNearest(img, Math.min(64, img.width), Math.min(64, img.height))) : null);

  for (let i = 0; i < imgs.length; i++) {
    const f = frames[i], img = imgs[i], bb = bboxes[i];
    const label = `frame ${String(i + 1).padStart(2, '0')}${f.name ? ` (${f.name})` : ''}`;
    if (!img) { warnings.push(warn(f, i, 'missing-image', 'error', `${label}: image data missing`)); continue; }
    if (dimsKey(f) !== baseDims) warnings.push(warn(f, i, 'dims', 'warn', `${label} has canvas ${dimsKey(f)} but clip started at ${baseDims} — canvas dimension mismatch`));
    if (!bb) { warnings.push(warn(f, i, 'empty', 'warn', `${label} appears to be empty (no visible pixels)`)); continue; }
    if (touchesEdge(img)) warnings.push(warn(f, i, 'crop', 'info', `${label}'s visible pixels touch the canvas edge — it may be cropped`));
    const semi = semiAlphaCount(img);
    if (semi > 0) warnings.push(warn(f, i, 'halo', 'info', `${label} contains ${semi} partially transparent pixels (edge halos; GIF export will threshold these)`));
    if (opts.palette && opts.palette.length) {
      const outside = colorsOutsidePalette(img, opts.palette, opts.paletteTolerance ?? 24);
      if (outside.length > 0) warnings.push(warn(f, i, 'palette', 'warn', `${label} contains ${outside.length} colour${outside.length === 1 ? '' : 's'} outside the locked palette (most common: rgb(${outside[0].color.join(',')}))`));
    }
    if (i > 0) {
      const prevBb = bboxes[i - 1], prevHash = hashes[i - 1];
      if (bb && prevBb && hashes[i] && prevHash) {
        const dist = hamming(hashes[i], prevHash);
        if (dist <= 6) warnings.push(warn(f, i, 'duplicate', 'warn', `${label} and the previous frame appear nearly identical`));
        const hRatio = bb.h / prevBb.h, wRatio = bb.w / prevBb.w;
        if (hRatio > 1.35 || hRatio < 0.74) warnings.push(warn(f, i, 'bbox', 'warn', `${label} has a significantly ${hRatio > 1 ? 'taller' : 'shorter'} visible bounding box (${prevBb.h}px → ${bb.h}px)`));
        const areaRatio = (bb.w * bb.h) / Math.max(1, prevBb.w * prevBb.h);
        if (areaRatio > 1.8 || areaRatio < 0.55) warnings.push(warn(f, i, 'scale', 'warn', `${label} shows a large scale jump (visible area changed ×${areaRatio.toFixed(2)})`));
        if (f.pivot && frames[i - 1].pivot) {
          const dx = Math.abs(f.pivot.x - frames[i - 1].pivot.x), dy = Math.abs(f.pivot.y - frames[i - 1].pivot.y);
          if (dx > 0.15 || dy > 0.15) warnings.push(warn(f, i, 'pivot', 'info', `${label} pivot jumped relative to the previous frame`));
        }
        const iou = silhouetteIoU(img, imgs[i - 1]);
        if (iou < 0.35) warnings.push(warn(f, i, 'silhouette', 'warn', `${label} silhouette changed abruptly (IoU ${iou.toFixed(2)}) — possible wrong pose/order`));
        const baselineDelta = Math.abs((bb.y + bb.h) - (prevBb.y + prevBb.h));
        if (baselineDelta > Math.max(3, bb.h * 0.2)) warnings.push(warn(f, i, 'baseline', 'info', `${label}'s baseline moved ${baselineDelta}px vs the previous frame — possible unwanted bouncing`));
      }
    }
  }
  return warnings;
}

function warn(f, i, kind, severity, message) {
  return { frameId: f.id ?? null, index: i, kind, severity, message };
}

/** Compact one-shot production review used by "INSPECT ANIMATION". */
export function inspectClip(clip, getImg, opts = {}) {
  const frames = clip.frames ?? [];
  const totalDuration = frames.reduce((s, f) => s + (f.duration ?? 100), 0);
  const warnings = analyzeClip(frames, getImg, opts);
  const count = kind => warnings.filter(w => w.kind === kind).length;
  let failed = 0;
  for (const f of frames) if (f.generationFailed) failed++;
  const dims = new Set(frames.map(f => `${f.meta?.w}x${f.meta?.h}`));
  return {
    frameCount: frames.length,
    durationMs: totalDuration,
    loopMs: clip.loopMode === 'once' ? null : totalDuration,
    fps: clip.defaultFPS ?? 8,
    dimensions: dims.size === 1 ? [...dims][0] : [...dims].join(' / '),
    drafts: frames.filter(f => (f.status ?? 'draft') !== 'approved').length,
    failedGenerations: failed,
    warnings,
    summary: {
      empty: count('empty'), duplicates: count('duplicate'), scaleJumps: count('scale'),
      bboxJumps: count('bbox'), paletteDrift: count('palette'), halos: count('halo'),
      silhouette: count('silhouette'), baseline: count('baseline'), pivot: count('pivot'),
    },
  };
}

/** Loop-seam check: compare final → first frame. Returns comparable facts. */
export function loopSeamReport(clip, getImg) {
  if (!clip.frames || clip.frames.length < 2) return { ok: false, message: 'Need at least 2 frames to check a loop' };
  const first = clip.frames[0], last = clip.frames[clip.frames.length - 1];
  const a = getImg(last), b = getImg(first);
  if (!a || !b) return { ok: false, message: 'Missing image data for loop endpoints' };
  const iou = silhouetteIoU(a, b);
  const dist = hamming(phash(a), phash(b));
  const bbA = alphaBBox(a), bbB = alphaBBox(b);
  const drift = bbA && bbB ? Math.hypot((bbA.x + bbA.w / 2) - (bbB.x + bbB.w / 2), (bbA.y + bbA.h / 2) - (bbB.y + bbB.h / 2)) : null;
  const issues = [];
  if (iou < 0.5) issues.push(`large shape jump across the seam (IoU ${iou.toFixed(2)})`);
  if (drift != null && drift > Math.max(4, (bbB?.h ?? 16) * 0.15)) issues.push(`position drift of ${drift.toFixed(1)}px across the seam`);
  if (bbA && bbB && Math.abs(bbA.h - bbB.h) > bbB.h * 0.2) issues.push(`height change ${bbA.h}px → ${bbB.h}px at the seam`);
  return { ok: issues.length === 0, issues, iou, hashDistance: dist, message: issues.length ? issues.join('; ') : 'Loop seam looks consistent' };
}
