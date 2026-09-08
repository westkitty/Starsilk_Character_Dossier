// canvasView.js — the central production canvas.
// Renders the current frame (or stage-specific surface: slice sheet, pack
// atlas) with checkerboard, ground guide, onion skin, motion trail, pivot,
// boxes, points, bbox, pixel grid. Handles zoom/pan and dispatches pointer
// gestures to the active stage's tool.
import { createImg, silhouette, extractRect, cloneImg } from '../lib/img.js';
import { compositeFrame } from '../exporters.js';
import { poseToPixels, BONES, JOINTS } from '../lib/skeleton.js';

export class CanvasView {
  constructor(store, canvas, hud) {
    this.store = store;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hud = hud;
    this.stageRenderer = null;   // set by stage modules: (ctx, view) => void
    this.toolHandler = null;     // set by stage modules: { down, move, up, cursor }
    this.drag = null;
    this.needsResize = true;
    store.on('*', (topic) => { if (['project', 'ui', 'view', 'frame-image', 'selection', 'playing', 'providers', 'slice', 'pack'].includes(topic)) this.requestRender(); });
    window.addEventListener('resize', () => { this.needsResize = true; this.requestRender(); });
    this.bindPointer();
    const ro = new ResizeObserver(() => { this.needsResize = true; this.requestRender(); });
    ro.observe(canvas.parentElement);
    this._raf = requestAnimationFrame(() => this.tick());
    this.lastTick = performance.now();
    this.playAccum = 0;
  }

  // ---------------------------------------------------------------- view state

  get view() { return this.store.ui.view; }

  contentSize() {
    // what is being displayed (frame canvas / sheet / atlas)
    const store = this.store;
    const stage = store.ui.stage;
    if (stage === 'slice' && store.ui.slice?.sheetId) {
      const meta = store.imgStore.getMeta(store.ui.slice.sheetId);
      if (meta) return meta;
    }
    if (stage === 'pack' && store.ui.pack?.sheet) {
      return { w: store.ui.pack.sheet.width, h: store.ui.pack.sheet.height };
    }
    const frame = this.currentFrame();
    if (frame) return { w: Math.max(8, frame.canvasDims?.w ?? 64), h: Math.max(8, frame.canvasDims?.h ?? 64) };
    const anim = store.activeAnim();
    const ch = store.activeChar();
    if (anim?.frames?.length) {
      const f = anim.frames.find(fr => fr.imageId);
      if (f) return { w: Math.max(8, f.canvasDims.w), h: Math.max(8, f.canvasDims.h) };
    }
    return { w: Math.max(8, ch?.spriteDefaults?.w ?? 256), h: Math.max(8, ch?.spriteDefaults?.h ?? 256) };
  }

  currentFrame() {
    const anim = this.store.activeAnim();
    if (!anim || !anim.frames.length) return null;
    let idx = this.store.ui.playing ? this.store.ui.playIndex : this.store.ui.selection.currentIndex;
    idx = Math.max(0, Math.min(anim.frames.length - 1, idx));
    return anim.frames[idx] ?? null;
  }

  frameComposite(frame) {
    try { return compositeFrame(frame, this.store.imgStore); }
    catch {
      // images may still be lazy-loading from IndexedDB after a reload
      if (frame?.imageId) this.store.imgStore.ensure(frame.imageId).then(() => this.requestRender()).catch(() => {});
      return null;
    }
  }

  // ---------------------------------------------------------------- transform

  toScreen(x, y) {
    const r = this.canvas.getBoundingClientRect();
    const { zoom, panX, panY } = this.view;
    return { x: (x * zoom) + panX + this.origin.x, y: (y * zoom) + panY + this.origin.y };
  }
  toContent(sx, sy) {
    const { zoom, panX, panY } = this.view;
    const r = this.canvas.getBoundingClientRect();
    return { x: (sx - this.origin.x - panX) / zoom, y: (sy - this.origin.y - panY) / zoom };
  }

  fit() {
    const size = this.contentSize();
    const r = this.canvas.parentElement.getBoundingClientRect();
    const zx = (r.width - 40) / size.w, zy = (r.height - 40) / size.h;
    this.view.zoom = Math.max(0.05, Math.min(64, Math.min(zx, zy)));
    this.view.panX = 0; this.view.panY = 0;
    this.requestRender();
  }

  setZoom(factor, cx, cy) {
    const before = this.toContent(cx ?? this.canvas.width / 2 / devicePixelRatio, cy ?? this.canvas.height / 2 / devicePixelRatio);
    const prev = this.view.zoom;
    this.view.zoom = Math.max(0.05, Math.min(128, prev * factor));
    const r = this.canvas.getBoundingClientRect();
    const afterPx = before.x * this.view.zoom + this.origin.x + this.view.panX;
    const afterPy = before.y * this.view.zoom + this.origin.y + this.view.panY;
    this.view.panX -= (afterPx - (before.x * prev + this.origin.x + this.view.panX)) * (this.view.zoom / prev) - 0; // keep pointer anchored
    // simpler: recompute pan so content point stays under pointer
    const px = (cx ?? r.width / 2), py = (cy ?? r.height / 2);
    this.view.panX = px - this.origin.x - before.x * this.view.zoom;
    this.view.panY = py - this.origin.y - before.y * this.view.zoom;
    this.requestRender();
  }

  // ---------------------------------------------------------------- render

  requestRender() { this._dirty = true; }

  tick() {
    requestAnimationFrame(() => this.tick());
    const now = performance.now();
    const dt = now - this.lastTick;
    this.lastTick = now;
    // playback advance
    const store = this.store;
    if (store.ui.playing) {
      const anim = store.activeAnim();
      if (anim && anim.frames.length) {
        const idx = Math.max(0, Math.min(anim.frames.length - 1, store.ui.playIndex));
        const frame = anim.frames[idx];
        const dur = Math.max(20, frame?.duration ?? (1000 / (anim.defaultFPS || 8)));
        this.playAccum += dt;
        if (this.playAccum >= dur) {
          this.playAccum = 0;
          let next = idx + store.ui.playbackDir;
          if (next >= anim.frames.length) {
            if (anim.loopMode === 'once') { store.ui.playing = false; store.emit('playing'); return; }
            if (anim.loopMode === 'pingpong') { store.ui.playbackDir = -1; next = Math.max(0, idx - 1); }
            else next = 0;
          }
          if (next < 0) {
            if (anim.loopMode === 'pingpong') { store.ui.playbackDir = 1; next = Math.min(anim.frames.length - 1, idx + 1); }
            else next = anim.frames.length - 1;
          }
          store.ui.playIndex = next;
          store.ui.selection.currentIndex = next;
          store.emit('playing');
        }
      } else { store.ui.playing = false; store.emit('playing'); }
    }
    if (this._dirty || this.needsResize || store.ui.playing || (store.ui.compare.mode !== 'off' && store.ui.compare.animating)) {
      this._dirty = false;
      this.render();
    }
  }

  render() {
    const canvas = this.canvas;
    const parent = canvas.parentElement;
    const dpr = devicePixelRatio || 1;
    const w = parent.clientWidth, h = parent.clientHeight;
    if (this.needsResize || canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      this.needsResize = false;
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // CSS pixel space from here
    this.origin = { x: w / 2, y: h / 2 };
    const size = this.contentSize();
    if (this.view.zoom == null) { this.fit(); return; }
    const zoom = this.view.zoom;
    // content rect top-left in screen px
    const ox = this.origin.x + this.view.panX - (size.w * zoom) / 2;
    const oy = this.origin.y + this.view.panY - (size.h * zoom) / 2;
    this.topLeft = { x: ox, y: oy };
    const stage = this.store.ui.stage;
    ctx.save();
    // draw background
    this.drawBackground(ctx, ox, oy, size.w * zoom, size.h * zoom);
    // stage-specific content
    if (this.stageRenderer?.override) {
      this.stageRenderer.override(ctx, this);
    } else {
      this.drawScene(ctx, ox, oy, zoom, size);
    }
    ctx.restore();
    this.updateHud(size);
  }

  drawBackground(ctx, x, y, w, h) {
    const bg = this.view.bg;
    if (bg === 'checkerboard') {
      const s = Math.max(4, Math.min(32, this.view.zoom >= 2 ? this.view.zoom / 2 : 8));
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.fillStyle = '#23262b'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#2b2f35';
      for (let yy = Math.floor(y / s) * s, iy = 0; yy < y + h; yy += s, iy++) {
        for (let xx = Math.floor(x / s) * s + (iy % 2 ? s : 0); xx < x + w; xx += s * 2) {
          ctx.fillRect(xx, yy, s, s);
        }
      }
      ctx.restore();
    } else {
      ctx.fillStyle = bg === 'dark' ? '#101114' : bg === 'light' ? '#cfd2d6' : bg;
      ctx.fillRect(x, y, w, h);
    }
  }

  drawScene(ctx, ox, oy, zoom, size) {
    const store = this.store;
    const ui = store.ui;
    const frame = this.currentFrame();
    const anim = store.activeAnim();
    const cmp = ui.compare;
    ctx.imageSmoothingEnabled = !this.view.nearest;

    // ground guide
    if (this.view.overlay.ground && anim?.groundY != null) {
      const gy = oy + anim.groundY * size.h * zoom;
      ctx.strokeStyle = '#4c9aff';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ox - 20, gy); ctx.lineTo(ox + size.w * zoom + 20, gy); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#4c9aff';
      ctx.font = '10px system-ui';
      ctx.fillText('ground', ox - 16 - 30, gy + 3);
    }

    const frames = anim?.frames ?? [];
    const curIdx = frame ? frames.indexOf(frame) : -1;

    // onion skin
    const onion = this.view.overlay.onion;
    if (onion > 0 && anim && cmp.mode === 'off') {
      const drawOnion = (f, tint, alpha) => {
        if (!f?.imageId) return;
        const comp = this.frameComposite(f);
        if (!comp) return;
        const canvas = imgCanvas(this._onionCache, f.imageId + tint, comp, tint);
        ctx.globalAlpha = alpha;
        ctx.drawImage(canvas, ox, oy, size.w * zoom, size.h * zoom);
        ctx.globalAlpha = 1;
      };
      for (let k = Math.min(onion, 2); k >= 1; k--) {
        const prev = frames[curIdx - k], next = frames[curIdx + k];
        if (prev) drawOnion(prev, '#ff5d5d', this.view.overlay.onionOpacity / k);
        if (next) drawOnion(next, '#5db3ff', this.view.overlay.onionOpacity / k);
      }
    }

    // motion trail / ghost compare modes draw themselves instead of the frame
    if (cmp.mode === 'ghost' && cmp.aId && cmp.bId) {
      const a = store.findFrame(cmp.aId)?.frame, b = store.findFrame(cmp.bId)?.frame;
      for (const [f, color] of [[a, '#ff5d5d'], [b, '#5db3ff']]) {
        const comp = f && this.frameComposite(f);
        if (comp) {
          ctx.globalAlpha = 0.55;
          ctx.drawImage(imgCanvas(this._ghostCache, f.imageId + color, comp, color), ox, oy, size.w * zoom, size.h * zoom);
          ctx.globalAlpha = 1;
        }
      }
    } else if (cmp.mode === 'trail' && frames.length) {
      const n = Math.min(cmp.trailN || 3, frames.length);
      for (let i = 0; i < n; i++) {
        const f = frames[(curIdx - i + frames.length) % frames.length];
        const comp = f?.imageId && this.frameComposite(f);
        if (comp) {
          const sil = imgSilhouette(this._trailCache, f.imageId, comp, i === 0 ? '#ffffff' : `hsl(${180 + i * 40} 80% 60%)`);
          ctx.globalAlpha = i === 0 ? 1 : Math.max(0.15, 0.6 - i * 0.12);
          ctx.drawImage(sil, ox, oy, size.w * zoom, size.h * zoom);
          ctx.globalAlpha = 1;
        }
      }
    } else if (frame?.imageId) {
      const comp = this.frameComposite(frame);
      if (comp) {
        const canvas = frameCanvas(comp);
        ctx.drawImage(canvas, ox + (frame.offset?.x ?? 0) * 0, oy, size.w * zoom, size.h * zoom);
      }
    } else if (!anim) {
      // empty space hint
      ctx.fillStyle = '#7a828e';
      ctx.font = '13px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('No artwork yet — create or import from the left panel', (ox + size.w * zoom / 2), (oy + size.h * zoom / 2));
      ctx.textAlign = 'left';
    }

    // pixel grid
    if (this.view.overlay.grid && zoom >= 6) {
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= size.w; x++) { ctx.moveTo(ox + x * zoom + 0.5, oy); ctx.lineTo(ox + x * zoom + 0.5, oy + size.h * zoom); }
      for (let y = 0; y <= size.h; y++) { ctx.moveTo(ox, oy + y * zoom + 0.5); ctx.lineTo(ox + size.w * zoom, oy + y * zoom + 0.5); }
      ctx.stroke();
    }

    // bbox overlay
    if (this.view.overlay.bbox && frame?.imageId) {
      const comp = this.frameComposite(frame);
      const bb = comp && alphaBBSafe(comp);
      if (bb) {
        ctx.strokeStyle = '#ffb13d';
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(ox + bb.x * zoom, oy + bb.y * zoom, bb.w * zoom, bb.h * zoom);
        ctx.setLineDash([]);
      }
    }

    // boxes (hitboxes) + points
    if (frame && this.view.overlay.boxes) {
      for (const box of frame.boxes ?? []) {
        const color = { collision: '#39d98a', hurt: '#ff5d5d', attack: '#ffb13d', interact: '#4c9aff' }[box.kind] || '#fff';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(ox + box.x * size.w * zoom, oy + box.y * size.h * zoom, box.w * size.w * zoom, box.h * size.h * zoom);
        ctx.fillStyle = color;
        ctx.font = '9px system-ui';
        ctx.fillText(box.kind, ox + box.x * size.w * zoom + 2, oy + box.y * size.h * zoom + 9);
      }
    }
    if (frame && this.view.overlay.points) {
      for (const p of frame.points ?? []) {
        const px = ox + p.x * size.w * zoom, py = oy + p.y * size.h * zoom;
        ctx.fillStyle = '#ff3df0';
        ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
        ctx.font = '9px system-ui';
        ctx.fillText(p.name, px + 5, py - 3);
      }
    }

    // pivot
    if (this.view.overlay.pivot && frame) {
      const px = ox + (frame.pivot?.x ?? 0.5) * size.w * zoom;
      const py = oy + (frame.pivot?.y ?? 1) * size.h * zoom;
      ctx.strokeStyle = '#ffe13d';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px - 7, py); ctx.lineTo(px + 7, py);
      ctx.moveTo(px, py - 7); ctx.lineTo(px, py + 7);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.stroke();
    }

    // skeleton pose overlay (MOTION stage)
    const pose = this.store.ui.poseEdit;
    if (pose && this.store.ui.stage === 'motion') {
      const px = poseToPixels(pose.joints, { unitPx: pose.unitPx, cx: ox + pose.cx * zoom * 0 + size.w * zoom / 2, groundY: oy + (anim?.groundY ?? 0.92) * size.h * zoom });
      ctx.strokeStyle = '#4ce0c3';
      ctx.lineWidth = Math.max(1.5, zoom * 0.06);
      for (const [a, b] of BONES) {
        ctx.beginPath();
        ctx.moveTo(px[a].x, px[a].y); ctx.lineTo(px[b].x, px[b].y);
        ctx.stroke();
      }
      for (const j of JOINTS) {
        ctx.fillStyle = j === 'head' ? '#ffe13d' : '#4ce0c3';
        ctx.beginPath(); ctx.arc(px[j].x, px[j].y, Math.max(2.5, zoom * 0.09), 0, Math.PI * 2); ctx.fill();
      }
      this.posePx = px;
    }
  }

  updateHud(size) {
    const store = this.store;
    const zoomPct = Math.round((this.view.zoom ?? 1) * 100);
    const frame = this.currentFrame();
    const anim = store.activeAnim();
    this.hud.textContent = [
      `${size.w}×${size.h}`,
      `${zoomPct}%`,
      anim ? `${anim.name} · ${anim.frames.length}f · ${anim.defaultFPS}fps` : null,
      frame ? `frame ${anim ? anim.frames.indexOf(frame) + 1 : '?'}` : null,
      store.ui.playing ? '▶' : null,
    ].filter(Boolean).join('   ');
  }

  // ---------------------------------------------------------------- pointer

  bindPointer() {
    const canvas = this.canvas;
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      const pt = { x: e.offsetX, y: e.offsetY };
      const content = this.toContentRelative(pt.x, pt.y);
      if (this.toolHandler?.down) {
        this.drag = this.toolHandler.down(content, e, this) || null;
      } else {
        this.drag = { kind: 'pan', startX: pt.x, startY: pt.y, panX: this.view.panX, panY: this.view.panY };
      }
      if (!this.drag) this.drag = { kind: 'pan', startX: pt.x, startY: pt.y, panX: this.view.panX, panY: this.view.panY };
    });
    canvas.addEventListener('pointermove', e => {
      const pt = { x: e.offsetX, y: e.offsetY };
      if (!this.drag) {
        if (this.toolHandler?.hover) canvas.style.cursor = this.toolHandler.hover(this.toContentRelative(pt.x, pt.y), e, this) || 'default';
        return;
      }
      if (this.drag.kind === 'pan') {
        this.view.panX = this.drag.panX + (pt.x - this.drag.startX);
        this.view.panY = this.drag.panY + (pt.y - this.drag.startY);
        this.requestRender();
        return;
      }
      this.toolHandler?.move?.(this.drag, this.toContentRelative(pt.x, pt.y), e, this);
    });
    const up = e => {
      if (!this.drag) return;
      const d = this.drag;
      this.drag = null;
      if (d.kind !== 'pan') this.toolHandler?.up?.(d, this);
      this.store.commitCoalesce();
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.25 : 0.8;
      this.setZoom(factor, e.offsetX, e.offsetY);
    }, { passive: false });
  }

  toContentRelative(px, py) {
    // content coords relative to content origin (0..w, 0..h)
    const zoom = this.view.zoom ?? 1;
    const size = this.contentSize();
    return { x: (px - this.topLeft.x) / zoom, y: (py - this.topLeft.y) / zoom };
  }

  contentRectToScreen(rect) {
    const zoom = this.view.zoom ?? 1;
    return { x: this.topLeft.x + rect.x * zoom, y: this.topLeft.y + rect.y * zoom, w: rect.w * zoom, h: rect.h * zoom };
  }
}

// tiny per-view caches tinted images / silhouettes
const _caches = { };
function imgCanvas(cache, key, comp, tint) {
  const store = (_caches[cache] ??= new Map());
  // keyed by image id + tint; drop if too big
  if (store.size > 120) store.clear();
  let entry = store.get(key);
  if (entry) return entry;
  const c = document.createElement('canvas');
  c.width = comp.width; c.height = comp.height;
  const ctx = c.getContext('2d');
  const tinted = cloneImg(comp);
  if (tint) {
    const [tr, tg, tb] = hexToRgb(tint);
    for (let i = 0; i < tinted.data.length; i += 4) {
      if (tinted.data[i + 3] < 10) continue;
      tinted.data[i] = tinted.data[i] / 2 + tr / 2;
      tinted.data[i + 1] = tinted.data[i + 1] / 2 + tg / 2;
      tinted.data[i + 2] = tinted.data[i + 2] / 2 + tb / 2;
    }
  }
  ctx.putImageData(new ImageData(tinted.data, c.width, c.height), 0, 0);
  store.set(key, c);
  return c;
}
function imgSilhouette(cache, key, comp, color) {
  const store = (_caches.sil ??= new Map());
  if (store.size > 120) store.clear();
  const k = key + color;
  let entry = store.get(k);
  if (entry) return entry;
  const sil = silhouette(comp, hexToRgb(color));
  const c = document.createElement('canvas');
  c.width = comp.width; c.height = comp.height;
  c.getContext('2d').putImageData(new ImageData(sil.data, c.width, c.height), 0, 0);
  store.set(k, c);
  return c;
}
function frameCanvas(comp) {
  const c = document.createElement('canvas');
  c.width = comp.width; c.height = comp.height;
  c.getContext('2d').putImageData(new ImageData(comp.data, c.width, c.height), 0, 0);
  return c;
}
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
import { alphaBBox } from '../lib/img.js';
function alphaBBSafe(comp) { try { return alphaBBox(comp); } catch { return null; } }

export function initCaches(view) {
  view._onionCache = 'onion';
  view._ghostCache = 'ghost';
  view._trailCache = 'sil';
}
