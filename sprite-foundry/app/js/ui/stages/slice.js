// stages/slice.js — SLICE stage: import a sprite sheet, carve it into frames
// via grid / smart region detection / metadata / manual rects, preview, and
// import the chosen frames into the standard timeline. A frame is a frame.
import { el, $, toast, dialog, field, textInput, numberInput, selectInput, checkInput, button, section } from '../components.js';
import * as M from '../../lib/model.js';
import { gridSlices, detectRegions, parseSheetMetadata } from '../../lib/slice.js';
import { pickFile, importImageFile, blobToImgData } from '../../browser.js';
import { extractRect } from '../../lib/img.js';

export class SliceStage {
  constructor(ctx) {
    this.ctx = ctx;
    this.method = 'grid';
    this.gridParams = { mode: 'cols-rows', columns: 4, rows: 2, cellW: 0, cellH: 0, offsetX: 0, offsetY: 0, spacingX: 0, spacingY: 0 };
    this.smartParams = { minSize: 4, mergeRadius: 4, useBackgroundKey: false, backgroundKey: '#ffffff' };
    ctx.store.on('ui', () => { if (ctx.store.ui.stage === 'slice' && ctx.canvasView) ctx.canvasView.requestRender(); });
  }

  get sliceState() { return this.ctx.store.ui.slice; }

  activate() {
    const { store, canvasView } = this.ctx;
    canvasView.stageRenderer = { override: (c, v) => this.renderSheet(c, v) };
    canvasView.toolHandler = this.sheetTool();
    canvasView.fit();
  }

  deactivate() {
    const { canvasView } = this.ctx;
    canvasView.stageRenderer = null;
    canvasView.toolHandler = null;
  }

  async importFiles(files) {
    const file = files[0];
    if (!file) return;
    try {
      const { frames } = await importImageFile(file);
      if (frames.length > 1) {
        toast('That file is an animated GIF — dropped onto the app outside SLICE it imports as an animation. Here we slice stills.', 'warn');
      }
      const img = frames[0].img;
      const { store } = this.ctx;
      const sheetId = await store.imgStore.putImg(img);
      store.ui.slice = {
        sheetId, name: file.name,
        rects: [], selected: new Set(),
        meta: null, tags: [],
        sheetW: img.width, sheetH: img.height,
      };
      // sensible auto-first-pass: grid if even split seems plausible, else smart detect
      this.method = 'grid';
      this.ctx.store.emit('ui');
      this.ctx.store.emit('slice');
      this.ctx.canvasView.fit();
      toast(`Sheet "${file.name}" loaded (${img.width}×${img.height}). Choose a slice method on the left.`, 'ok');
    } catch (e) { toast(e.message, 'error'); }
  }

  render(root) {
    root.innerHTML = '';
    const { store } = this.ctx;
    const s = this.sliceState;
    const openBtn = button('Open sheet image…', async () => {
      const file = await pickFile({ accept: 'image/png,image/webp,image/jpeg' });
      if (file) this.importFiles([file]);
    }, { class: 'btn' });
    if (!s?.sheetId) {
      root.append(section('SHEET', openBtn, el('p', { class: 'hint', text: 'Import a sprite sheet (or paste one onto the canvas). Slice methods appear after loading.' })));
      return;
    }
    root.append(
      section('SHEET', el('div', { class: 'small', text: `${s.name} · ${s.sheetW}×${s.sheetH}` }), openBtn),
      this.methodTabs(),
      this.methodPanel(),
      this.rectListPanel(),
      this.previewPanel(),
      this.importPanel());
  }

  methodTabs() {
    const tabs = el('div', { class: 'btn-group' });
    for (const m of ['grid', 'smart', 'metadata', 'manual']) {
      const label = { grid: 'A · GRID', smart: 'B · SMART', metadata: 'C · METADATA', manual: 'D · MANUAL' }[m];
      const btn = button(label, () => {
        this.method = m;
        if (m === 'metadata' && !this.sliceState.meta) this.loadMetadata();
        this.ctx.store.emit('ui');
      }, { class: `mini-btn ${this.method === m ? 'active' : ''}` });
      tabs.append(btn);
    }
    return section('SLICE METHOD', tabs);
  }

  methodPanel() {
    const body = el('div', { style: 'display:flex;flex-direction:column;gap:7px' });
    if (this.method === 'grid') this.gridPanel(body);
    else if (this.method === 'smart') this.smartPanel(body);
    else if (this.method === 'metadata') this.metadataPanel(body);
    else this.manualPanel(body);
    return section(`${this.method.toUpperCase()} SLICING`, body);
  }

  applyRects(rects, source) {
    const { store } = this.ctx;
    const s = this.sliceState;
    s.rects = rects.map((r, i) => ({ id: `rect_${i}`, x: r.x, y: r.y, w: r.w, h: r.h, name: r.name ?? `${s.name}_${i}`, include: true, durationMs: r.durationMs ?? null, pivotX: r.pivotX ?? null, pivotY: r.pivotY ?? null, sourceW: r.sourceW ?? r.w, sourceH: r.sourceH ?? r.h, offsetX: r.offsetX ?? 0, offsetY: r.offsetY ?? 0 }));
    store.emit('ui');
    store.emit('slice');
  }

  // ---------------------------------------------------------------- grid

  gridPanel(body) {
    const p = this.gridParams;
    const s = this.sliceState;
    const run = () => {
      try {
        const rects = gridSlices({
          sheetW: s.sheetW, sheetH: s.sheetH,
          columns: p.mode === 'cols-rows' ? p.columns : undefined,
          rows: p.mode === 'cols-rows' ? p.rows : undefined,
          cellW: p.mode === 'cell-size' ? p.cellW : undefined,
          cellH: p.mode === 'cell-size' ? p.cellH : undefined,
          offsetX: p.offsetX, offsetY: p.offsetY, spacingX: p.spacingX, spacingY: p.spacingY,
        });
        this.applyRects(rects, 'grid');
      } catch (e) { toast(e.message, 'error'); }
    };
    const modeSel = selectInput({
      label: 'Define grid by', value: p.mode,
      options: [{ value: 'cols-rows', label: 'columns & rows' }, { value: 'cell-size', label: 'frame width & height' }],
      onChange: v => { p.mode = v; this.ctx.store.emit('ui'); },
    });
    body.append(modeSel.node);
    if (p.mode === 'cols-rows') {
      body.append(el('div', { class: 'row' },
        numberInput({ label: 'Columns', value: p.columns, min: 1, onChange: v => { p.columns = v; run(); } }).node,
        numberInput({ label: 'Rows', value: p.rows, min: 1, onChange: v => { p.rows = v; run(); } }).node));
    } else {
      body.append(el('div', { class: 'row' },
        numberInput({ label: 'Cell width', value: p.cellW, min: 1, onChange: v => { p.cellW = v; run(); } }).node,
        numberInput({ label: 'Cell height', value: p.cellH, min: 1, onChange: v => { p.cellH = v; run(); } }).node));
    }
    body.append(
      el('div', { class: 'row' },
        numberInput({ label: 'Offset X', value: p.offsetX, min: 0, onChange: v => { p.offsetX = v; run(); } }).node,
        numberInput({ label: 'Offset Y', value: p.offsetY, min: 0, onChange: v => { p.offsetY = v; run(); } }).node),
      el('div', { class: 'row' },
        numberInput({ label: 'Spacing X', value: p.spacingX, min: 0, onChange: v => { p.spacingX = v; run(); } }).node,
        numberInput({ label: 'Spacing Y', value: p.spacingY, min: 0, onChange: v => { p.spacingY = v; run(); } }).node),
      el('p', { class: 'hint', text: 'The grid is drawn live on the sheet. Cell contents become frames in the standard timeline — no dead-end result screen.' }));
    run();
  }

  // ---------------------------------------------------------------- smart

  smartPanel(body) {
    const p = this.smartParams;
    const s = this.sliceState;
    body.append(
      el('div', { class: 'row' },
        numberInput({ label: 'Min region (px)', value: p.minSize, min: 1, onChange: v => p.minSize = v }).node,
        numberInput({ label: 'Merge radius', value: p.mergeRadius, min: 0, max: 20, onChange: v => p.mergeRadius = v }).node),
      checkInput({ label: 'Keyed background instead of alpha', checked: p.useBackgroundKey, onChange: v => p.useBackgroundKey = v }).node,
      p.useBackgroundKey ? textInput({ label: 'Background color (hex)', value: p.backgroundKey, onChange: v => p.backgroundKey = v }).node : null,
      button('DETECT REGIONS', () => {
        try {
          const img = this.ctx.store.imgStore.getImg(s.sheetId);
          const opts = { minSize: p.minSize, mergeRadius: p.mergeRadius };
          if (p.useBackgroundKey) {
            const m = /^#?([0-9a-f]{6})$/i.exec(p.backgroundKey);
            if (!m) { toast('Invalid background hex.', 'error'); return; }
            const n = parseInt(m[1], 16);
            opts.userBackground = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
          }
          const { rects, background } = detectRegions(img, opts);
          if (!rects.length) { toast('No regions found — adjust min size / merge radius, or use grid/manual.', 'warn'); return; }
          this.applyRects(rects, 'smart');
          toast(`Detected ${rects.length} region(s)${background ? ` (background rgb(${background.join(',')}))` : ''}. Toggle/correct any of them before importing — detection is not infallible.`, 'ok', 6000);
        } catch (e) { toast(e.message, 'error'); }
      }, { class: 'btn' }),
      el('p', { class: 'hint', text: 'Transparency boundaries + connected regions (with background-keying for opaque sheets). Disjoint sprite parts are merged via the radius; correct regions by dragging on the canvas or editing numbers below.' }));
  }

  // ---------------------------------------------------------------- metadata

  metadataPanel(body) {
    const s = this.sliceState;
    body.append(
      el('p', { class: 'hint', text: 'Best path when a JSON accompanies the sheet: preserves rectangles, trim offsets, pivots, durations and tags. Understands Sprite Foundry, Aseprite and TexturePacker JSON.' }),
      button('Load metadata JSON…', () => this.loadMetadata(), { class: 'btn' }),
      s.meta ? el('p', { class: 'small', style: 'color:var(--ok)', text: `Loaded: ${s.meta.frames.length} frame(s), ${s.meta.tags.length} tag(s)` }) : null);
  }

  async loadMetadata() {
    const s = this.sliceState;
    const file = await pickFile({ accept: '.json,application/json' });
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      const meta = parseSheetMetadata(json, { sheetW: s.sheetW, sheetH: s.sheetH });
      s.meta = meta;
      this.method = 'metadata';
      this.applyRects(meta.frames, 'metadata');
      toast(`Metadata accepted: ${meta.frames.length} frames${meta.tags.length ? ` + ${meta.tags.length} tag(s)` : ''} — coordinates validated against the sheet.`, 'ok');
    } catch (e) { toast(`Metadata rejected: ${e.message}`, 'error', 6500); }
  }

  // ---------------------------------------------------------------- manual

  manualPanel(body) {
    const s = this.sliceState;
    body.append(
      el('div', { class: 'btn-group' },
        button('Add rect', () => {
          const w = Math.min(64, s.sheetW), h = Math.min(64, s.sheetH);
          s.rects.push({ id: `rect_${Date.now()}`, x: 0, y: 0, w, h, name: `manual_${s.rects.length}`, include: true, durationMs: null, pivotX: null, pivotY: null, sourceW: w, sourceH: h, offsetX: 0, offsetY: 0 });
          this.ctx.store.emit('ui'); this.ctx.store.emit('slice');
        }, { class: 'mini-btn' })),
      el('p', { class: 'hint', text: 'Drag rectangles on the canvas (edges resize), or edit the numbers below.' }));
  }

  // ---------------------------------------------------------------- rect list

  rectListPanel() {
    const s = this.sliceState;
    const wrap = el('div', { class: 'slice-rect-list' });
    if (!s.rects.length) wrap.append(el('p', { class: 'hint', text: 'No slice rectangles yet.' }));
    s.rects.forEach((r, i) => {
      const mk = key => {
        const input = el('input', { type: 'number', value: r[key], title: key, 'aria-label': `rect ${i} ${key}` });
        input.addEventListener('change', () => {
          const v = Math.round(Number(input.value));
          if (!Number.isFinite(v)) return;
          if (key === 'w' && v <= 0 || key === 'h' && v <= 0) { input.value = r[key]; return; }
          if (key === 'x' || key === 'y') {
            r[key] = Math.max(0, Math.min(key === 'x' ? s.sheetW - r.w : s.sheetH - r.h, v));
          } else r[key] = Math.max(1, Math.min(key === 'w' ? s.sheetW - r.x : s.sheetH - r.y, v));
          this.ctx.store.emit('ui'); this.ctx.store.emit('slice');
        });
        return input;
      };
      wrap.append(el('div', { class: 'slice-row' },
        el('input', { type: 'checkbox', checked: r.include, title: 'include on import', onChange: e => { r.include = e.target.checked; this.ctx.store.emit('ui'); } }),
        el('span', { class: 'small', style: 'width:14px', text: String(i + 1) }),
        mk('x'), mk('y'), mk('w'), mk('h'),
        el('button', { class: 'icon-btn del', title: 'Duplicate', onClick: () => { s.rects.splice(i + 1, 0, { ...r, id: `rect_${Date.now()}_${i}`, x: r.x + 4, y: r.y + 4 }); this.ctx.store.emit('ui'); } }, '⧉'),
        el('button', { class: 'icon-btn', title: 'Delete', onClick: () => { s.rects.splice(i, 1); this.ctx.store.emit('ui'); this.ctx.store.emit('slice'); } }, '✕')));
    });
    return section(`RECTANGLES (${s.rects.length})`, wrap);
  }

  // ---------------------------------------------------------------- preview + import

  previewPanel() {
    const { store } = this.ctx;
    const s = this.sliceState;
    const wrap = el('div', { class: 'thumb-row' });
    if (!s.rects.length) wrap.append(el('p', { class: 'hint', text: 'Nothing to preview.' }));
    const sheet = s.sheetId ? store.imgStore.getImg(s.sheetId) : null;
    s.rects.forEach((r, i) => {
      const cell = sheet ? extractRect(sheet, r.x, r.y, r.w, r.h) : null;
      const hasPixels = cell && cell.data.some((v, idx) => idx % 4 === 3 && v > 8);
      const box = el('div', { class: `slice-thumb ${r.include ? '' : 'off'}`, title: `${i + 1}. ${r.w}×${r.h}${hasPixels ? '' : ' — contains no visible pixels!'}` });
      if (cell) {
        const c = document.createElement('canvas');
        c.width = cell.width; c.height = cell.height;
        c.getContext('2d').putImageData(new ImageData(cell.data, cell.width, cell.height), 0, 0);
        box.append(c, el('span', { class: 'chk', text: r.include ? (hasPixels ? '✓' : '∅') : '—' }));
      }
      box.addEventListener('click', () => { r.include = !r.include; this.ctx.store.emit('ui'); });
      wrap.append(box);
    });
    return section('SLICE PREVIEW (click to toggle)', wrap);
  }

  importPanel() {
    const { store } = this.ctx;
    const s = this.sliceState;
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:7px' });
    const included = s.rects.filter(r => r.include);
    const empty = included.filter(r => {
      const sheet = store.imgStore.getImg(s.sheetId);
      const cell = extractRect(sheet, r.x, r.y, r.w, r.h);
      return !cell.data.some((v, i) => i % 4 === 3 && v > 8);
    });
    if (empty.length) wrap.append(el('p', { class: 'hint', style: 'color:var(--warn)', text: `⚠ ${empty.length} selected rect(s) contain no visible pixels and will be skipped.` }));
    const nameInput = textInput({ label: 'Import into', value: s.name ? `${s.name.replace(/\.[^.]+$/, '')}` : 'imported clip', hint: 'Name of the animation clip to create (frames append if a clip with this name exists on the active character)' });
    wrap.append(nameInput.node,
      button(`IMPORT ${included.length - empty.length} SELECTED FRAMES`, async () => {
        const ch = store.activeChar();
        if (!ch) { toast('Add a character first.', 'warn'); return; }
        const sheet = store.imgStore.getImg(s.sheetId);
        const clipName = nameInput.input.value.trim() || 'imported clip';
        let anim = ch.animations.find(a => a.name === clipName);
        if (!anim) anim = store.addAnimation(ch.id, { type: 'custom', name: clipName, frameCount: included.length });
        const frames = [];
        for (const r of included) {
          const cell = extractRect(sheet, r.x, r.y, r.w, r.h);
          if (!cell.data.some((v, i) => i % 4 === 3 && v > 8)) continue; // skip empty
          const imageId = await store.imgStore.putImg(cell);
          const f = M.createFrame({ width: r.sourceW || r.w, height: r.sourceH || r.h, source: 'sliced', name: r.name });
          f.imageId = imageId;
          f.canvasDims = { w: r.sourceW || r.w, h: r.sourceH || r.h };
          f.duration = r.durationMs || Math.round(1000 / (anim.defaultFPS || 8));
          if (r.pivotX != null) f.pivot = { x: clamp01num(r.pivotX), y: clamp01num(r.pivotY) };
          f.offset = { x: r.offsetX || 0, y: r.offsetY || 0 };
          f.versions.push(M.frameVersion(f, imageId, 'v1', 'slice'));
          f.lineage = { provider: 'local-slice', operation: 'slice', prompt: null, createdAt: Date.now(), sheet: s.name, requestedDims: { w: r.w, h: r.h }, resultDims: { w: r.w, h: r.h } };
          frames.push(f);
        }
        store.insertFrames(anim.id, frames, anim.frames.length);
        if (s.meta?.tags?.length) {
          store.mutate('sheet tags', () => { anim.tags = [...(anim.tags ?? []), ...s.meta.tags.map(t => t.name)]; });
        }
        toast(`Imported ${frames.length} frame(s) into "${clipName}" — they're in the timeline now, same as any generated frame.`, 'ok');
        this.ctx.setStage('frames');
      }, { class: 'btn', disabled: !included.length }));
    return section('IMPORT', wrap);
  }

  // ---------------------------------------------------------------- canvas rendering + interaction

  renderSheet(ctx2d, view) {
    const { store } = this.ctx;
    const s = this.sliceState;
    if (!s?.sheetId) return;
    const img = store.imgStore.getImg(s.sheetId);
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
    const { topLeft } = view;
    const zoom = view.view.zoom;
    ctx2d.imageSmoothingEnabled = !view.view.nearest;
    ctx2d.drawImage(c, topLeft.x, topLeft.y, img.width * zoom, img.height * zoom);
    if (this.method === 'grid' && this.gridParams) {
      // live grid overlay derived from current params (before apply)
      try {
        const p = this.gridParams;
        const rects = gridSlices({ sheetW: s.sheetW, sheetH: s.sheetH, columns: p.mode === 'cols-rows' ? p.columns : undefined, rows: p.mode === 'cols-rows' ? p.rows : undefined, cellW: p.mode === 'cell-size' ? p.cellW : undefined, cellH: p.mode === 'cell-size' ? p.cellH : undefined, offsetX: p.offsetX, offsetY: p.offsetY, spacingX: p.spacingX, spacingY: p.spacingY });
        ctx2d.strokeStyle = 'rgba(76,154,255,0.35)';
        ctx2d.lineWidth = 1;
        for (const r of rects) ctx2d.strokeRect(topLeft.x + r.x * zoom + 0.5, topLeft.y + r.y * zoom + 0.5, r.w * zoom - 1, r.h * zoom - 1);
      } catch { /* params invalid mid-edit */ }
    }
    // actual slice rects
    ctx2d.font = '10px system-ui';
    s.rects.forEach((r, i) => {
      const sx = topLeft.x + r.x * zoom, sy = topLeft.y + r.y * zoom, sw = r.w * zoom, sh = r.h * zoom;
      ctx2d.strokeStyle = r.include ? '#4ce0c3' : 'rgba(122,130,142,0.6)';
      ctx2d.lineWidth = r.include ? 1.5 : 1;
      ctx2d.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
      ctx2d.fillStyle = r.include ? '#4ce0c3' : 'rgba(122,130,142,0.8)';
      ctx2d.fillText(String(i + 1), sx + 3, sy + 10);
      // resize handles
      ctx2d.fillStyle = '#ffe13d';
      ctx2d.fillRect(sx + sw - 4, sy + sh - 4, 4, 4);
    });
  }

  sheetTool() {
    const { store, canvasView } = this.ctx;
    let drag = null;
    const hitRect = (pt) => {
      const s = this.sliceState;
      if (!s) return null;
      const tol = 8 / (canvasView.view.zoom || 1);
      for (let i = s.rects.length - 1; i >= 0; i--) {
        const r = s.rects[i];
        const inX = pt.x >= r.x - tol && pt.x <= r.x + r.w + tol;
        const inY = pt.y >= r.y - tol && pt.y <= r.y + r.h + tol;
        if (!inX || !inY) continue;
        if (Math.abs(pt.x - (r.x + r.w)) < tol && Math.abs(pt.y - (r.y + r.h)) < tol) return { kind: 'resize', index: i };
        if (pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) return { kind: 'move', index: i, dx: pt.x - r.x, dy: pt.y - r.y };
      }
      return null;
    };
    return {
      down: (pt) => {
        const s = this.sliceState;
        if (!s) return null;
        const hit = hitRect(pt);
        if (hit) {
          drag = { ...hit, startRects: s.rects.map(r => ({ ...r })) };
          return drag;
        }
        // add mode only when manual panel active & user drags on empty space with a modifier? default: pan
        return null;
      },
      move: (d, pt) => {
        if (!d) return;
        const s = this.sliceState;
        const r = s.rects[d.index];
        if (!r) return;
        if (d.kind === 'move') {
          r.x = Math.max(0, Math.min(s.sheetW - r.w, Math.round(pt.x - d.dx)));
          r.y = Math.max(0, Math.min(s.sheetH - r.h, Math.round(pt.y - d.dy)));
        } else if (d.kind === 'resize') {
          r.w = Math.max(2, Math.min(s.sheetW - r.x, Math.round(pt.x - r.x)));
          r.h = Math.max(2, Math.min(s.sheetH - r.y, Math.round(pt.y - r.y)));
        }
        store.emit('slice');
        store.emit('ui');
      },
      up: () => { drag = null; },
      hover: (pt) => {
        const hit = hitRect(pt);
        return hit ? (hit.kind === 'resize' ? 'nwse-resize' : 'move') : 'default';
      },
    };
  }
}

function clamp01num(v) { const n = Number(v); if (!Number.isFinite(n)) return 0.5; return Math.max(-2, Math.min(3, n)); }
