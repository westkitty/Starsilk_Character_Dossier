// stages/pack.js — PACK stage: build grid sheets and packed atlases from the
// active clip, with trim/offset preservation, padding, edge extrusion, POT
// sizing, live preview and game-ready metadata in three real schemas.
import { el, $, toast, dialog, field, textInput, numberInput, selectInput, checkInput, button, section } from '../components.js';
import { packGrid, packAtlas, buildSheetMetadata, toAsepriteJson, toPhaserJson, placementsOverlap } from '../../lib/pack.js';
import { trimImage, blit, extrude, createImg, resizeNearest } from '../../lib/img.js';
import { imgToCanvas, downloadBytes, downloadBlob, imgToBlob } from '../../browser.js';
import { compositeFrame } from '../../exporters.js';

export class PackStage {
  constructor(ctx) {
    this.ctx = ctx;
    this.opts = {
      mode: 'grid', // grid | atlas
      gridLayout: 'horizontal', // horizontal | vertical | rows | columns
      gridCount: 8,
      approvedOnly: true,
      trim: true,
      padding: 2,
      borderPadding: 1,
      extrude: 0,
      powerOfTwo: false,
      maxWidth: 2048, maxHeight: 2048,
      allowRotate: false,
      showRects: true, showNames: true, showPivots: true,
      scale: 1,
    };
  }

  get anim() { return this.ctx.store.activeAnim(); }
  get ch() { return this.ctx.store.activeChar(); }

  activate() {
    const { canvasView } = this.ctx;
    canvasView.stageRenderer = { override: (c, v) => this.renderSheet(c, v) };
    this.build();
  }

  deactivate() { this.ctx.canvasView.stageRenderer = null; }

  /** Rebuild the packed sheet + metadata from current options (debounced). */
  build() {
    clearTimeout(this._debounce);
    this._debounce = setTimeout(() => this._buildNow(), 120);
  }

  async _buildNow() {
    const { store } = this.ctx;
    const anim = this.anim;
    if (anim) await Promise.all(anim.frames.filter(f => f.imageId).map(f => store.imgStore.ensure(f.imageId).catch(() => null)));
    const o = this.opts;
    const ui = store.ui;
    if (!anim || !anim.frames.length) { store.ui.pack = null; store.emit('pack'); this.ctx.canvasView?.requestRender(); return; }
    const frames = anim.frames.filter(f => f.imageId && (!o.approvedOnly || f.status === 'approved'));
    if (!frames.length) {
      store.ui.pack = { error: o.approvedOnly ? 'No approved frames — approve frames in FRAMES (or include drafts).' : 'No frames with images.' };
      store.emit('pack');
      this.ctx.canvasView?.requestRender();
      this.refreshStatusLine?.();
      return;
    }
    try {
      const entries = frames.map((f, i) => {
        const comp = compositeFrame(f, store.imgStore);
        let sprite = comp, trimMeta = null;
        if (o.trim) {
          const t = trimImage(comp);
          sprite = t.img;
          trimMeta = t;
        }
        return { frame: f, key: f.id, index: i, comp, sprite, trimMeta, w: sprite.width, h: sprite.height };
      });
      if (o.extrude > 0 && o.extrude > o.padding) throw new Error(`Edge extrusion (${o.extrude}px) cannot exceed padding (${o.padding}px) — it draws INTO the padding.`);
      let pack;
      if (o.mode === 'grid') {
        const cellW = Math.max(...entries.map(e => e.w));
        const cellH = Math.max(...entries.map(e => e.h));
        pack = packGrid(entries.map(e => ({ key: e.key, w: e.w, h: e.h })), {
          mode: o.gridLayout, count: o.gridCount, cellW, cellH,
          padding: o.padding, borderPadding: o.borderPadding, powerOfTwo: o.powerOfTwo,
        });
      } else {
        pack = packAtlas(entries.map(e => ({ key: e.key, w: e.w, h: e.h, allowRotate: o.allowRotate })), {
          padding: o.padding, borderPadding: o.borderPadding, powerOfTwo: o.powerOfTwo,
          maxWidth: o.maxWidth, maxHeight: o.maxHeight, allowRotate: o.allowRotate,
        });
      }
      if (placementsOverlap(pack.placements)) throw new Error('Internal packer error: overlapping placements (report this)');
      // compose sheet image
      const sheet = createImg(pack.width, pack.height);
      const ex = o.extrude;
      for (const e of entries) {
        const p = pack.placements.get(e.key);
        const sprite = ex > 0 ? extrude(e.sprite, ex) : e.sprite;
        blit(sheet, sprite, p.x - ex, p.y - ex);
      }
      const items = entries.map(e => ({
        name: e.frame.name || `${anim.name}_${e.index}`,
        index: e.index, key: e.key,
        sourceW: o.trim ? e.comp.width : e.w,
        sourceH: o.trim ? e.comp.height : e.h,
        sourceOffset: o.trim ? e.trimMeta.sourceOffset : { x: 0, y: 0 },
        pivot: e.frame.pivot,
        durationMs: e.frame.duration,
        tags: e.frame.tags ?? [],
        boxes: e.frame.boxes?.map(b => ({ kind: b.kind, ...denorm(b, o.trim ? e.comp : null, e.trimMeta) })) ?? [],
        points: e.frame.points?.map(p => denormPoint(p, o.trim ? e.comp : null, e.trimMeta)) ?? [],
      }));
      const meta = buildSheetMetadata({
        project: store.project.name, character: this.ch?.name, animation: anim.name,
        direction: anim.direction, width: pack.width, height: pack.height, items, placements: pack.placements,
      });
      const usedArea = entries.reduce((s, e) => s + e.w * e.h, 0);
      store.ui.pack = {
        sheet, width: pack.width, height: pack.height, placements: pack.placements,
        meta, entries, occupancy: usedArea / (pack.width * pack.height),
        mode: o.mode, framesCount: frames.length,
      };
      ui.packMetaText = null;
      store.emit('pack');
      this.ctx.canvasView?.requestRender();
      this.refreshStatusLine?.();
    } catch (e) {
      store.ui.pack = { error: e.message };
      store.emit('pack');
      this.ctx.canvasView?.requestRender();
      this.refreshStatusLine?.();
    }
  }

  render(root) {
    root.innerHTML = '';
    const o = this.opts;
    const anim = this.anim;
    if (!anim) { root.append(el('p', { class: 'dim', text: 'Select an animation first.' })); return; }
    root.append(
      section('SOURCE', el('div', { class: 'small', text: `clip "${anim.name}" (${anim.direction}) · ${anim.frames.length} frames` }),
        checkInput({ label: 'Approved frames only', checked: o.approvedOnly, onChange: v => { o.approvedOnly = v; this.build(); this.ctx.store.emit('ui'); } }).node),
      section('LAYOUT', this.layoutPanel()),
      section('PACKING OPTIONS', this.optionsPanel()),
      section('SHEET', this.sheetPanel()),
      section('METADATA', this.metaPanel()));
    this.refreshStatusLine = () => {
      const st = $('#pack-status');
      if (!st) return;
      const p = this.ctx.store.ui.pack;
      if (!p) st.textContent = '';
      else if (p.error) { st.textContent = `⚠ ${p.error}`; st.style.color = 'var(--warn)'; }
      else { st.textContent = `${p.width}×${p.height} · ${p.framesCount} frames · occupancy ${(p.occupancy * 100).toFixed(1)}%`; st.style.color = 'var(--ok)'; }
    };
    this.refreshStatusLine();
  }

  layoutPanel() {
    const o = this.opts;
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:7px' });
    const modeSel = selectInput({
      label: 'Output kind', value: o.mode,
      options: [{ value: 'grid', label: 'GRID sheet (uniform cells)' }, { value: 'atlas', label: 'PACKED atlas (tight rectangles)' }],
      onChange: v => { o.mode = v; this.build(); this.ctx.store.emit('ui'); },
    });
    wrap.append(modeSel.node);
    if (o.mode === 'grid') {
      wrap.append(el('div', { class: 'row' },
        selectInput({ label: 'Arrangement', value: o.gridLayout, options: [{ value: 'horizontal', label: 'horizontal strip' }, { value: 'vertical', label: 'vertical strip' }, { value: 'rows', label: 'N per row' }, { value: 'columns', label: 'N per column' }], onChange: v => { o.gridLayout = v; this.build(); this.ctx.store.emit('ui'); } }).node,
        (o.gridLayout === 'rows' || o.gridLayout === 'columns') ? numberInput({ label: 'N', value: o.gridCount, min: 1, max: 64, onChange: v => { o.gridCount = v; this.build(); } }).node : null));
    }
    return wrap;
  }

  optionsPanel() {
    const o = this.opts;
    const re = () => { this.build(); this.ctx.store.emit('ui'); };
    return el('div', { style: 'display:flex;flex-direction:column;gap:7px' },
      checkInput({ label: 'Trim transparent borders (keeps source size + offset for realignment)', checked: o.trim, onChange: v => { o.trim = v; re(); } }).node,
      el('div', { class: 'row' },
        numberInput({ label: 'Shape padding', value: o.padding, min: 0, max: 64, onChange: v => { o.padding = v; this.build(); } }).node,
        numberInput({ label: 'Sheet border padding', value: o.borderPadding, min: 0, max: 64, onChange: v => { o.borderPadding = v; this.build(); } }).node),
      el('div', { class: 'row' },
        numberInput({ label: 'Edge extrusion (px)', value: o.extrude, min: 0, max: 8, onChange: v => { o.extrude = v; this.build(); } }).node,
        checkInput({ label: 'Power-of-two size', checked: o.powerOfTwo, onChange: v => { o.powerOfTwo = v; this.build(); } }).node),
      el('div', { class: 'row' },
        numberInput({ label: 'Max width', value: o.maxWidth, min: 64, max: 8192, onChange: v => { o.maxWidth = v; this.build(); } }).node,
        numberInput({ label: 'Max height', value: o.maxHeight, min: 64, max: 8192, onChange: v => { o.maxHeight = v; this.build(); } }).node),
      checkInput({ label: 'Allow rotation (NOT recommended for animation)', checked: o.allowRotate, onChange: v => { o.allowRotate = v; this.build(); } }).node,
      el('p', { class: 'hint', text: 'Extrusion copies boundary pixels outward into the padding (not just empty space) — prevents sampling bleed in engines. Rotation is off by default because animation import flows rarely support it.' }));
  }

  sheetPanel() {
    const o = this.opts;
    const st = el('p', { class: 'small', id: 'pack-status', text: 'Building…' });
    return el('div', { style: 'display:flex;flex-direction:column;gap:7px' },
      st,
      el('div', { class: 'row' },
        checkInput({ label: 'boundaries', checked: o.showRects, onChange: v => { o.showRects = v; this.ctx.store.emit('pack'); } }).node,
        checkInput({ label: 'names', checked: o.showNames, onChange: v => { o.showNames = v; this.ctx.store.emit('pack'); } }).node,
        checkInput({ label: 'pivots', checked: o.showPivots, onChange: v => { o.showPivots = v; this.ctx.store.emit('pack'); } }).node),
      el('div', { class: 'btn-group' },
        button('Download sheet PNG', () => this.downloadSheet(), { class: 'btn' }),
        button('Preview reconstruction (trim→canvas)', () => this.reconstructionDialog(), { class: 'btn ghost' })));
  }

  metaPanel() {
    const { store } = this.ctx;
    const preset = selectInput({
      label: 'Format', value: 'spritefoundry',
      options: [
        { value: 'spritefoundry', label: 'Sprite Foundry generic JSON' },
        { value: 'aseprite', label: 'Aseprite-style JSON (valid structure)' },
        { value: 'phaser', label: 'Phaser 3 / Pixi atlas JSON' },
      ],
    });
    const pre = el('pre', { class: 'meta-preview', text: '(build a sheet first)' });
    const refresh = () => {
      const p = store.ui.pack;
      if (!p || p.error) { pre.textContent = p?.error ?? '(no sheet)'; return; }
      pre.textContent = JSON.stringify(this.currentMeta(), null, 1).slice(0, 4000) + (JSON.stringify(this.currentMeta()).length > 4000 ? '\n…(truncated preview — download for full file)' : '');
    };
    preset.input.addEventListener('change', refresh);
    store.on('pack', refresh);
    this._metaPreset = preset;
    setTimeout(refresh, 0);
    return el('div', { style: 'display:flex;flex-direction:column;gap:7px' },
      preset.node, pre,
      el('div', { class: 'btn-group' },
        button('Download metadata JSON', () => this.downloadMeta(), { class: 'btn' }),
        button('Sheet PNG + JSON together', () => { this.downloadSheet(); this.downloadMeta(); }, { class: 'btn ghost' })));
  }

  currentMeta() {
    const p = this.ctx.store.ui.pack;
    if (!p || p.error) return null;
    const preset = this._metaPreset?.input.value ?? 'spritefoundry';
    if (preset === 'aseprite') return toAsepriteJson(p.meta, `${this.anim.name}.png`, this.anim.type);
    if (preset === 'phaser') return toPhaserJson(p.meta, `${this.anim.name}.png`);
    return p.meta;
  }

  async downloadSheet() {
    const p = this.ctx.store.ui.pack;
    if (!p || p.error) { toast(p?.error ?? 'Build a sheet first.', 'warn'); return; }
    const blob = await imgToBlob(p.sheet);
    downloadBlob(blob, `${this.anim?.name ?? 'sheet'}.png`);
  }

  downloadMeta() {
    const meta = this.currentMeta();
    if (!meta) { toast('Build a sheet first.', 'warn'); return; }
    const preset = this._metaPreset?.input.value ?? 'spritefoundry';
    downloadBytes(new TextEncoder().encode(JSON.stringify(meta, null, 2)), `${this.anim?.name ?? 'sheet'}.${preset === 'spritefoundry' ? 'json' : `${preset}.json`}`, 'application/json');
  }

  /** Show that trim+offset reconstructs original positions. */
  reconstructionDialog() {
    const { store } = this.ctx;
    const p = store.ui.pack;
    if (!p || p.error) { toast('Build a sheet first.', 'warn'); return; }
    const row = el('div', { class: 'thumb-row' });
    for (const e of p.entries.slice(0, 10)) {
      const canvas = p.entries ? compositeFrame(e.frame, store.imgStore) : null;
      // reconstruction: extract placement rect from sheet, blit onto source-size canvas at offset
      const full = createImg(e.comp.width, e.comp.height);
      const placement = p.placements.get(e.key);
      const cut = createImg(placement.w, placement.h);
      blit(cut, subRect(p.sheet, placement), 0, 0);
      blit(full, cut, e.trimMeta?.sourceOffset.x ?? 0, e.trimMeta?.sourceOffset.y ?? 0);
      const c = document.createElement('canvas');
      c.width = full.width; c.height = full.height;
      c.getContext('2d').putImageData(new ImageData(full.data, full.width, full.height), 0, 0);
      c.style.width = '52px'; c.style.imageRendering = 'pixelated';
      const same = arraysSame(full.data, canvas.data);
      row.append(el('div', { class: 'slice-thumb', title: same ? '✓ pixel-identical to the source frame' : '⚠ differs (pixels were edited after pack)' }, c, el('span', { class: 'chk', text: same ? '✓' : '!' })));
    }
    dialog({
      title: 'Trim reconstruction check',
      width: 620,
      content: el('div', { style: 'display:flex;flex-direction:column;gap:8px' },
        el('p', { class: 'hint', text: 'Each sheet placement is cut back out and re-laid on its source canvas using stored offsets. ✓ = pixel-identical round-trip — alignment survives packing.' }),
        row),
      actions: [{ label: 'Close', class: 'btn' }],
    });
    function subRect(sheet, rect) {
      const out = createImg(rect.w, rect.h);
      blit(out, sheet, -rect.x, -rect.y);
      return out;
    }
    function arraysSame(a, b) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i += 977) if (a[i] !== b[i]) return false; return true; }
  }

  renderSheet(ctx2d, view) {
    const p = this.ctx.store.ui.pack;
    const o = this.opts;
    const { topLeft } = view;
    const zoom = view.view.zoom;
    ctx2d.imageSmoothingEnabled = !view.view.nearest;
    if (!p) {
      ctx2d.fillStyle = '#7a828e'; ctx2d.font = '13px system-ui';
      ctx2d.fillText('No frames to pack yet.', topLeft.x, topLeft.y);
      return;
    }
    if (p.error) {
      ctx2d.fillStyle = '#ffb13d'; ctx2d.font = '13px system-ui';
      wrapFillText(ctx2d, `⚠ ${p.error}`, topLeft.x, topLeft.y, 420);
      return;
    }
    const c = imgToCanvas(p.sheet);
    ctx2d.drawImage(c, topLeft.x, topLeft.y, p.width * zoom, p.height * zoom);
    if (o.showRects) {
      ctx2d.fillStyle = '#ffe13d';
      ctx2d.font = '9px system-ui';
      for (const [key, r] of p.placements) {
        const sx = topLeft.x + r.x * zoom, sy = topLeft.y + r.y * zoom;
        ctx2d.strokeStyle = '#4ce0c3';
        ctx2d.lineWidth = 1;
        ctx2d.strokeRect(sx + 0.5, sy + 0.5, r.w * zoom - 1, r.h * zoom - 1);
        const item = p.meta.frames.find(f => f.name === (p.entries.find(e => e.key === key)?.frame.name || '')) ?? p.meta.frames[p.entries.findIndex(e => e.key === key)];
        if (o.showNames && zoom >= 1) ctx2d.fillText(item ? `${item.index + 1}` : '?', sx + 2, sy + 9);
        if (o.showPivots && item && !p.rotated) {
          // pivot position inside placement: pivot relative to source rect, offset by sourceOffset
          const entry = p.entries.find(e => e.key === key);
          const offX = this.opts.trim ? entry.trimMeta.sourceOffset.x : 0;
          const offY = this.opts.trim ? entry.trimMeta.sourceOffset.y : 0;
          const px = sx + (item.pivotX * item.sourceW - offX) * zoom;
          const py = sy + (item.pivotY * item.sourceH - offY) * zoom;
          ctx2d.strokeStyle = '#ffe13d';
          ctx2d.beginPath(); ctx2d.arc(px, py, 2.5, 0, Math.PI * 2); ctx2d.stroke();
        }
      }
    }
  }
}

function denorm(box, comp, trimMeta) {
  // box is normalized to the working canvas; express in pixels of the SOURCE (untrimmed) rect
  const w = comp.width, h = comp.height;
  return { x: round2(box.x * w), y: round2(box.y * h), w: round2(box.w * w), h: round2(box.h * h) };
}
function denormPoint(p, comp) { return { name: p.name, x: round2(p.x * comp.width), y: round2(p.y * comp.height) }; }
function round2(v) { return Math.round(v * 100) / 100; }
function wrapFillText(ctx, text, x, y, maxW) {
  const words = text.split(' ');
  let line = '', dy = 0;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y + dy); line = word; dy += 15; }
    else line = test;
  }
  ctx.fillText(line, x, y + dy);
}
