// stages/frames.js — FRAMES stage: per-frame editing & repair, version
// history, generation lineage, QA warnings, stabilization, pixel lab,
// pivots/ground, boxes & points metadata, compare modes, loop check.
import { el, el as _el, $, toast, dialog, field, textInput, numberInput, selectInput, checkInput, button, section, lazyThumb } from '../components.js';
import * as M from '../../lib/model.js';
import { pickFile, importImageFile, downloadBlob } from '../../browser.js';
import { analyzeClip, loopSeamReport } from '../../lib/qa.js';
import { alphaBBox, resizeNearest, hardAlpha, semiAlphaCount, removeStrayPixels, findStrayPixels, chromaKey, quantizeToPalette, detectBackgroundColor, cloneImg, createImg, blit } from '../../lib/img.js';

const POINT_NAMES = ['hand', 'weapon', 'muzzle', 'head', 'foot-left', 'foot-right', 'effect-origin'];
const BOX_KINDS = ['collision', 'hurt', 'attack', 'interact'];

export class FramesStage {
  constructor(ctx) {
    this.ctx = ctx;
    this.boxKind = 'collision';
    this.pointName = 'hand';
    this.compareTimer = null;
    ctx.store.on('selection', () => { if (ctx.store.ui.stage === 'frames') this.refreshFramePanels(); });
  }

  get ch() { return this.ctx.store.activeChar(); }
  get anim() { return this.ctx.store.activeAnim(); }
  get frame() {
    const { store } = this.ctx;
    const anim = this.anim;
    if (!anim || !anim.frames.length) return null;
    const idx = Math.max(0, Math.min(anim.frames.length - 1, store.ui.selection.currentIndex));
    return anim.frames[idx];
  }

  activate() { this.bindCanvasTools(); }
  deactivate() {
    this.stopCompare();
    this.ctx.canvasView.toolHandler = null;
    this.ctx.store.ui.view.tool = 'pan';
  }

  render(root) {
    root.innerHTML = '';
    const anim = this.anim;
    if (!anim) { root.append(el('p', { class: 'dim', text: 'Select an animation first (CREATE/MOTION).' })); return; }
    root.append(
      this.frameInspector(),
      this.versionPanel(),
      this.lineagePanel(),
      this.repairSection(),
      this.qaSection(),
      this.stabilizeSection(),
      this.pivotSection(),
      this.pixelLabSection(),
      this.compareSection(),
      this.boxesPointsSection());
  }

  refreshFramePanels() {
    // light refresh of dynamic panels
    const anim = this.anim;
    if (!anim) return;
  }

  // ---------------------------------------------------------------- frame inspector

  frameInspector() {
    const { store } = this.ctx;
    const anim = this.anim;
    const frame = this.frame;
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:7px' });
    if (!frame) { wrap.append(el('p', { class: 'hint', text: 'No frames yet.' })); return section('FRAME', wrap); }
    const idx = anim.frames.indexOf(frame);
    const selected = store.ui.selection.frameIds.length;
    wrap.append(
      el('div', { class: 'row' },
        el('span', { style: 'font-weight:600', text: `Frame ${idx + 1}/${anim.frames.length}` }),
        el('span', { class: `badge badge-${frame.status}`, text: frame.status.toUpperCase() }),
        el('span', { class: 'dim small', text: `${frame.canvasDims.w}×${frame.canvasDims.h} · ${frame.source}` }),
        selected > 1 ? el('span', { class: 'small', style: 'color:var(--teal)', text: `${selected} selected` }) : null),
      el('div', { class: 'row' },
        numberInput({ label: 'Duration (ms)', value: frame.duration, min: 10, max: 5000, onChange: v => store.setFramePatch(anim.id, frame.id, { duration: Math.max(10, v) }, 'set duration') }).node,
        checkInput({ label: 'Flip X', checked: frame.flipX, onChange: v => {
          const warn = M.genomeAsymmetryWarning(this.ch.genome);
          if (v && warn) toast(warn, 'warn');
          store.setFramePatch(anim.id, frame.id, { flipX: v }, 'flip frame');
        } }).node),
      el('div', { class: 'btn-group' },
        button('APPROVE', () => store.setFramePatch(anim.id, frame.id, { status: 'approved' }, 'approve'), { class: 'mini-btn active', title: 'Include in production exports' }),
        button('DRAFT', () => store.setFramePatch(anim.id, frame.id, { status: 'draft' }, 'draft'), { class: 'mini-btn' }),
        button('REJECT', () => store.setFramePatch(anim.id, frame.id, { status: 'rejected' }, 'reject'), { class: 'mini-btn', title: 'Exclude from exports' }),
        selected > 1 ? button(`APPROVE ${selected}`, () => { store.mutate('approve selection', () => { for (const id of store.ui.selection.frameIds) { const f = anim.frames.find(x => x.id === id); if (f) f.status = 'approved'; } }); }, { class: 'mini-btn' }) : null),
      el('div', { class: 'btn-group' },
        button('REGENERATE', () => this.regenerate(frame), { class: 'mini-btn' }),
        button('VARIATION', () => this.variation(frame), { class: 'mini-btn' }),
        button('REPAIR…', () => this.repairDialog(frame), { class: 'mini-btn' }),
        button('REPLACE…', () => this.replaceWithFile(frame), { class: 'mini-btn' }),
        button('DUPLICATE', () => store.duplicateFrames(anim.id, [frame.id]), { class: 'mini-btn' }),
        button('DELETE', () => store.removeFrames(anim.id, [frame.id]), { class: 'mini-btn' })),
      el('p', { class: 'hint', text: 'Repair one bad frame — never reroll the whole animation because one frame is ugly.' }));
    return section('FRAME', wrap);
  }

  async regenerate(frame) {
    const { genops } = this.ctx;
    try { await genops.regenerateFrame(this.ch.id, frame.id, {}); toast('Regeneration queued — result becomes a new version, neighbours untouched.', 'ok'); }
    catch (e) { toast(e.message, 'error'); }
  }
  async variation(frame) {
    const { genops } = this.ctx;
    try { await genops.variationFrame(this.ch.id, frame.id); toast('Variation queued.', 'ok'); }
    catch (e) { toast(e.message, 'error'); }
  }
  async replaceWithFile(frame) {
    const { store } = this.ctx;
    const file = await pickFile({ accept: 'image/png,image/webp,image/jpeg' });
    if (!file) return;
    try {
      const { frames } = await importImageFile(file);
      await store.replaceFrameImage(frame.id, frames[0].img, { label: 'replace (file)', op: 'replace' });
      toast('Frame replaced; previous pixels kept in version history.', 'ok');
    } catch (e) { toast(e.message, 'error'); }
  }

  // ---------------------------------------------------------------- versions

  versionPanel() {
    const { store, imgStore } = this.ctx;
    const frame = this.frame;
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:4px' });
    if (!frame) return section('VERSION HISTORY', wrap);
    if (!frame.versions.length) wrap.append(el('p', { class: 'hint', text: 'No versions recorded yet.' }));
    for (const v of frame.versions) {
      const current = frame.imageId === v.imageId;
      wrap.append(el('div', { class: `ver-row ${current ? 'current' : ''}` },
        v.imageId ? lazyThumb(imgStore, v.imageId, { alt: '' }) : el('span', { class: 'small dim', text: '—' }),
        el('span', { style: 'flex:1', text: `${v.label} · ${v.op}` }),
        el('span', { class: 'dim small', text: new Date(v.createdAt).toLocaleTimeString() }),
        current ? el('span', { class: 'badge badge-approved', text: 'current' }) : null,
        !current ? button('Set current', () => store.setFrameVersion(frame.id, v.id), { class: 'mini-btn' }) : null,
        !current ? button('Compare', () => this.startFlipbook(frame.imageId, v.imageId), { class: 'mini-btn', title: 'Flipbook A/B with current version' }) : null,
        frame.versions.length > 1 ? button('✕', () => store.deleteFrameVersion(frame.id, v.id), { class: 'mini-btn' }) : null));
    }
    return section(`VERSION HISTORY (${frame.versions.length})`, wrap);
  }

  // ---------------------------------------------------------------- lineage

  lineagePanel() {
    const frame = this.frame;
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:6px' });
    const lin = frame?.lineage;
    if (!lin) { wrap.append(el('p', { class: 'hint', text: 'No generation lineage for this frame (imported or unsaved history).' })); return section('LINEAGE', wrap); }
    const rows = [
      ['provider', `${lin.provider ?? '—'}${lin.model ? ` (${lin.model})` : ''}`],
      ['operation', lin.operation ?? '—'],
      ['seed', lin.seed ?? '—'],
      ['master ref', lin.masterReference ? '…' + lin.masterReference.slice(-8) : '—'],
      ['references', (lin.references ?? []).length],
      ['parent frames', (lin.parentFrames ?? []).length ? lin.parentFrames.map(p => '…' + p.slice(-6)).join(', ') : '—'],
      ['requested', lin.requestedDims ? `${lin.requestedDims.w}×${lin.requestedDims.h}` : '—'],
      ['result', lin.resultDims ? `${lin.resultDims.w}×${lin.resultDims.h}` : '—'],
      ['time', lin.createdAt ? new Date(lin.createdAt).toLocaleString() : '—'],
    ];
    if (lin.repairDescription) rows.splice(2, 0, ['repair', lin.repairDescription]);
    if (lin.motionBlueprint?.keyPose) rows.splice(2, 0, ['blueprint pose', lin.motionBlueprint.keyPose]);
    wrap.append(el('table', { class: 'lineage-table' }, rows.map(([k, v]) => el('tr', {}, el('td', { text: k }), el('td', { text: String(v) })))));
    if (lin.prompt) wrap.append(el('details', {}, el('summary', { class: 'small' }, 'prompt'), el('div', { class: 'lineage-prompt', text: lin.prompt })));
    if (lin.negativePrompt) wrap.append(el('details', {}, el('summary', { class: 'small' }, 'negative prompt'), el('div', { class: 'lineage-prompt', text: lin.negativePrompt })));
    return section('GENERATION LINEAGE', wrap);
  }

  // ---------------------------------------------------------------- repair

  repairSection() {
    const frame = this.frame;
    const { providers } = this.ctx;
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:6px' });
    const status = el('p', { class: 'hint', text: 'Checking provider repair capability…' });
    const repairBtn = button('REPAIR THIS FRAME…', () => this.repairDialog(frame), { class: 'btn' });
    providers.caps(providers.activeId).then(caps => {
      const ok = caps.edit || caps.inpaint;
      repairBtn.disabled = !ok || !frame;
      status.textContent = ok
        ? (caps.inpaint ? 'Edit + masked inpainting available.' : 'Full-frame edit available (no masked inpainting with this provider).')
        : 'Active provider cannot edit/inpaint — localized repair unavailable (not simulated). Use Regenerate, or switch provider.';
      status.style.color = ok ? 'var(--ok)' : 'var(--warn)';
    });
    wrap.append(el('p', { class: 'hint', text: 'Describe the defect ("right arm too long", "shoe changed color", "weapon disappeared"). Optionally paint a mask to confine the fix.' }), status, repairBtn);
    return section('REPAIR', wrap);
  }

  repairDialog(frame) {
    if (!frame?.imageId) { toast('Frame has no image.', 'warn'); return; }
    const { store, genops, providers } = this.ctx;
    providers.caps(providers.activeId).then(caps => {
      if (!caps.edit && !caps.inpaint) { toast('Active provider cannot edit/inpaint.', 'warn'); return; }
      const defect = textInput({ label: 'What is wrong with this frame?', value: '', multiline: true, rows: 2, placeholder: 'e.g. right arm is too long — keep everything else identical' });
      let maskDataUrl = null;
      body: {
        const content = el('div', { style: 'display:flex;flex-direction:column;gap:8px' }, defect.node);
        if (caps.inpaint) {
          const maskInfo = el('p', { class: 'hint', text: 'Optional mask: paint over the area the model may change. Unmasked areas are preserved.' });
          const img = store.imgStore.getImg(frame.imageId);
          const scale = Math.min(4, Math.max(2, Math.floor(320 / Math.max(1, img.width))));
          const base = document.createElement('canvas');
          base.width = img.width * scale; base.height = img.height * scale;
          const bctx = base.getContext('2d');
          bctx.imageSmoothingEnabled = false;
          const tmp = document.createElement('canvas');
          tmp.width = img.width; tmp.height = img.height;
          tmp.getContext('2d').putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
          bctx.drawImage(tmp, 0, 0, base.width, base.height);
          const maskCanvas = document.createElement('canvas');
          maskCanvas.width = img.width; maskCanvas.height = img.height;
          const mctx = maskCanvas.getContext('2d');
          mctx.fillStyle = '#fff'; mctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
          const overlay = document.createElement('canvas');
          overlay.width = base.width; overlay.height = base.height;
          const octx = overlay.getContext('2d');
          let brush = Math.max(3, Math.round(img.width / 16));
          let painting = false;
          let painted = false;
          const drawStroke = e => {
            const r = overlay.getBoundingClientRect();
            const x = ((e.clientX - r.left) / r.width) * img.width;
            const y = ((e.clientY - r.top) / r.height) * img.height;
            mctx.fillStyle = '#000';
            mctx.beginPath(); mctx.arc(x, y, brush, 0, Math.PI * 2); mctx.fill();
            painted = true;
            redraw();
          };
          const redraw = () => {
            octx.clearRect(0, 0, overlay.width, overlay.height);
            octx.imageSmoothingEnabled = false;
            octx.globalAlpha = 0.65;
            octx.drawImage(maskCanvas, 0, 0, overlay.width, overlay.height);
            octx.globalAlpha = 1;
            // show painted area as red: overlay black => red tint
            octx.globalCompositeOperation = 'source-atop';
            octx.globalCompositeOperation = 'source-over';
          };
          overlay.addEventListener('pointerdown', e => { painting = true; overlay.setPointerCapture(e.pointerId); drawStroke(e); });
          overlay.addEventListener('pointermove', e => painting && drawStroke(e));
          overlay.addEventListener('pointerup', () => painting = false);
          const holder = el('div', { class: 'mask-editor' }, base, overlay);
          overlay.style.position = 'absolute'; overlay.style.inset = '0';
          const brushRow = el('div', { class: 'row' },
            field(`Brush ${brush}px`, (() => { const r = el('input', { type: 'range', min: 2, max: 40, value: brush }); r.addEventListener('input', () => { brush = Number(r.value); }); return r; })()),
            button('Clear mask', () => { mctx.fillStyle = '#fff'; mctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height); painted = false; redraw(); }, { class: 'mini-btn' }));
          content.append(maskInfo, holder, brushRow);
          Object.defineProperty(content, '_mask', { get: () => {
            if (!painted) return null;
            // convert canvas overlay to a proper mask image (same size as base frame image)
            const out = document.createElement('canvas');
            out.width = img.width; out.height = img.height;
            const octx2 = out.getContext('2d');
            octx2.drawImage(maskCanvas, 0, 0);
            // OpenAI mask semantics: fully transparent = editable area
            const data = octx2.getImageData(0, 0, out.width, out.height);
            for (let i = 0; i < data.data.length; i += 4) {
              const paintedPx = data.data[i] < 128;
              data.data[i] = data.data[i + 1] = data.data[i + 2] = 0;
              data.data[i + 3] = paintedPx ? 0 : 255;
            }
            octx2.putImageData(data, 0, 0);
            return out.toDataURL('image/png');
          } });
          dialog({
            title: 'Repair frame',
            width: 560,
            content,
            actions: [
              { label: 'Cancel', class: 'btn ghost' },
              {
                label: 'Run repair', class: 'btn',
                keepOpen: true,
                onClick: async (close) => {
                  const text = defect.input.value.trim();
                  if (!text) { toast('Describe the defect first.', 'warn'); return; }
                  const mask = content._mask;
                  try {
                    await genops.repairFrame(this.ch.id, frame.id, text, mask);
                    toast('Repair job queued — the result arrives as a new version. Compare in VERSION HISTORY.', 'ok', 6000);
                    close();
                  } catch (e) { toast(e.message, 'error'); }
                },
              },
            ],
          });
          return;
        }
        dialog({
          title: 'Repair frame (full-frame edit)',
          width: 460,
          content: el('div', { style: 'display:flex;flex-direction:column;gap:8px' }, defect.node, el('p', { class: 'hint', text: 'Provider supports full-frame edit but not masked inpainting — the model will see your defect description and the frame, and return an edited version.' })),
          actions: [{ label: 'Cancel', class: 'btn ghost' }, {
            label: 'Run repair', class: 'btn', keepOpen: true,
            onClick: async (close) => {
              const text = defect.input.value.trim();
              if (!text) { toast('Describe the defect first.', 'warn'); return; }
              try { await genops.repairFrame(this.ch.id, frame.id, text, null); toast('Repair job queued.', 'ok'); close(); }
              catch (e) { toast(e.message, 'error'); }
            },
          }],
        });
      }
    });
  }

  // ---------------------------------------------------------------- QA

  qaSection() {
    const { store } = this.ctx;
    const anim = this.anim;
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:6px' });
    const list = el('div', { style: 'display:flex;flex-direction:column;gap:4px' });
    const run = () => {
      list.innerHTML = '';
      if (!anim.frames.length) { list.append(el('p', { class: 'hint', text: 'No frames.' })); return; }
      const frames = anim.frames.filter(f => f.imageId).map(M.frameMetaForQa);
      const getImg = f => store.imgStore.getImg(store.findFrame(f.id).frame.imageId);
      const palette = this.ch?.palette.locked ? this.ch.palette.colors : null;
      let warnings = [];
      try { warnings = analyzeClip(frames, getImg, { palette }); }
      catch (e) { list.append(el('p', { class: 'hint', text: `Analysis failed: ${e.message}` })); return; }
      if (!warnings.length) list.append(el('p', { class: 'hint', style: 'color:var(--ok)', text: '✓ No deterministic continuity warnings.' }));
      for (const w of warnings) {
        list.append(el('div', {
          class: 'qa-item', tabindex: '0', title: 'Click to select the frame',
          onClick: () => {
            const found = store.findFrame(w.frameId);
            if (found) { store.ui.selection = { frameIds: [w.frameId], currentIndex: found.index, candidateIds: [] }; store.emit('selection'); store.emit('view'); }
          },
        },
          el('span', { class: `q-sev sev-${w.severity}`, text: w.severity === 'warn' ? '⚠' : 'ℹ' }),
          el('span', { class: 'q-msg', text: w.message })));
      }
    };
    wrap.append(
      el('div', { class: 'btn-group' },
        button('RUN FRAME QA', run, { class: 'mini-btn' }),
        button('CHECK LOOP', () => this.loopCheckDialog(), { class: 'mini-btn' })),
      list,
      el('p', { class: 'hint', text: 'Deterministic measurements (bounds, palette, duplicates, baselines) — warnings, not judgements. You decide what is actually a defect.' }));
    return section('FRAME QA', wrap);
  }

  loopCheckDialog() {
    const { store, genops } = this.ctx;
    const anim = this.anim;
    if (!anim || anim.frames.length < 2) { toast('Need at least 2 frames to check a loop.', 'warn'); return; }
    const first = anim.frames[0], last = anim.frames[anim.frames.length - 1];
    const report = loopSeamReport({ frames: anim.frames.map(M.frameMetaForQa), loopMode: anim.loopMode }, f => store.imgStore.getImg(store.findFrame(f.id).frame.imageId));
    const content = el('div', { style: 'display:flex;flex-direction:column;gap:8px' },
      el('p', { text: report.ok ? '✓ ' + report.message : '⚠ ' + report.message, style: report.ok ? 'color:var(--ok)' : 'color:var(--warn)' }),
      el('p', { class: 'small dim', text: `silhouette IoU ${report.iou?.toFixed(2) ?? '—'} · hash distance ${report.hashDistance ?? '—'}` }),
      el('div', { class: 'btn-group' },
        button('Flipbook last↔first on canvas', () => { this.startFlipbook(last.id, first.id); toast('Flipbook running on the canvas — stop it from COMPARE.', 'info'); }),
        button('Ghost overlay', () => { this.setCompare('ghost', last.id, first.id); })),
      el('p', { class: 'hint', text: 'If the seam jumps, consider adding bridge frames between the last and first poses.' }));
    dialog({
      title: 'Loop seam check',
      width: 520,
      content,
      actions: [
        {
          label: 'Generate bridge frame(s)', class: 'btn', keepOpen: true,
          onClick: async close => {
            try {
              await genops.generateBetween(this.ch.id, anim.id, last.id, first.id, 1);
              toast('Bridge generation queued between last → first frame.', 'ok');
              close();
            } catch (e) { toast(e.message, 'error'); }
          },
        },
        { label: 'Close', class: 'btn ghost' },
      ],
    });
  }

  // ---------------------------------------------------------------- stabilize

  stabilizeSection() {
    const { store } = this.ctx;
    const anim = this.anim;
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:6px' });
    const anchorSel = selectInput({
      label: 'Anchor', value: 'bottom-center',
      options: [
        { value: 'bottom-center', label: 'bottom center (feet)' },
        { value: 'center', label: 'bounding-box center' },
        { value: 'pivot', label: 'pivot point' },
      ],
    });
    const normCanvas = checkInput({ label: 'Normalize canvas dimensions (pad to common size)', checked: true });
    const applyBtn = button('STABILIZE SEQUENCE', () => {
      if (!anim?.frames.length) return;
      const anchor = anchorSel.input.value;
      const proposals = [];
      let maxW = 0, maxH = 0;
      for (const f of anim.frames) { maxW = Math.max(maxW, f.canvasDims.w); maxH = Math.max(maxH, f.canvasDims.h); }
      const details = anim.frames.map((f, i) => {
        let off = { x: f.offset?.x ?? 0, y: f.offset?.y ?? 0 };
        let noteParts = [];
        if (f.imageId) {
          const bb = alphaBBox(store.imgStore.getImg(f.imageId));
          if (bb) {
            const size = f.canvasDims;
            let anchorPt;
            if (anchor === 'bottom-center') anchorPt = { x: bb.x + bb.w / 2, y: bb.y + bb.h };
            else if (anchor === 'center') anchorPt = { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 };
            else anchorPt = { x: f.pivot.x * size.w + - (f.offset?.x ?? 0), y: f.pivot.y * size.h - (f.offset?.y ?? 0) };
            const target = anchor === 'pivot'
              ? { x: f.pivot.x * size.w, y: f.pivot.y * size.h }
              : { x: size.w / 2, y: anchor === 'bottom-center' ? size.h : size.h / 2 };
            const dx = Math.round(target.x - anchorPt.x - (anchor === 'pivot' ? 0 : 0));
            const dy = Math.round(target.y - anchorPt.y);
            if (dx !== 0 || dy !== 0) noteParts.push(`offset ${dx},${dy}`);
            off = { x: (f.offset?.x ?? 0) + dx, y: (f.offset?.y ?? 0) + dy };
          }
        }
        const canvasDims = normCanvas.input.checked && (f.canvasDims.w !== maxW || f.canvasDims.h !== maxH)
          ? (noteParts.push(`canvas → ${maxW}×${maxH}`), { w: maxW, h: maxH })
          : null;
        return { frame: f, offset: off, canvasDims, note: noteParts.join(' ; ') || 'unchanged', index: i };
      });
      const changed = details.filter(d => d.note !== 'unchanged');
      dialog({
        title: `Stabilize ${anim.name} (${changed.length}/${anim.frames.length} adjustments)`,
        width: 560,
        content: el('div', { style: 'display:flex;flex-direction:column;gap:6px' },
          el('p', { class: 'hint', text: 'Proposed corrections are stored as non-destructive offsets + canvas size metadata. Pixels are not moved; disable later by zeroing offsets. Turn off "normalize canvas" to keep intentional size changes.' }),
          el('div', { style: 'max-height:300px;overflow:auto;display:flex;flex-direction:column;gap:3px' },
            details.map(d => el('div', { class: 'small', style: `color:${d.note === 'unchanged' ? 'var(--dim)' : 'var(--text)'}` }, `frame ${d.index + 1}: ${d.note}`)))),
        actions: [
          { label: 'Cancel', class: 'btn ghost' },
          {
            label: 'Apply corrections', class: 'btn',
            onClick: () => {
              const assignments = new Map(details.map(d => [d.frame.id, { offset: d.offset, canvasDims: d.canvasDims ?? undefined }]));
              store.stabilize(anim.id, assignments);
              toast(`Applied ${changed.length} correction(s) as non-destructive offsets.`, 'ok');
            },
          },
        ],
      });
    }, { class: 'btn' });
    wrap.append(anchorSel.node, normCanvas.node, applyBtn,
      el('p', { class: 'hint', text: 'Aligns foot/body anchors across the clip so intentional motion stays but unwanted jitter stops. Stored as per-frame offsets — pixels untouched.' }));
    return section('STABILIZATION', wrap);
  }

  // ---------------------------------------------------------------- pivots + ground

  pivotSection() {
    const { store, canvasView } = this.ctx;
    const anim = this.anim;
    const frame = this.frame;
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:6px' });
    if (!frame) return section('PIVOT / GROUND', wrap);
    const presets = [
      { label: 'center', x: 0.5, y: 0.5 }, { label: 'bottom-center', x: 0.5, y: 1 },
      { label: 'bottom-left', x: 0, y: 1 }, { label: 'bottom-right', x: 1, y: 1 },
    ];
    wrap.append(
      el('div', { class: 'btn-group' },
        presets.map(p => button(p.label, () => store.setFramePatch(anim.id, frame.id, { pivot: { x: p.x, y: p.y } }, 'set pivot'), { class: 'mini-btn' })),
        button('drag on canvas', () => {
          store.ui.view.tool = 'pivot';
          this.bindCanvasTools();
          toast('Drag the yellow pivot cross on the canvas.');
        }, { class: 'mini-btn' })),
      el('div', { class: 'row' },
        el('span', { class: 'small', text: `pivot: (${frame.pivot.x.toFixed(2)}, ${frame.pivot.y.toFixed(2)})` }),
        button('APPLY PIVOT TO ENTIRE CLIP', () => store.applyPivotToClip(anim.id, frame.pivot), { class: 'mini-btn' })),
      el('div', { class: 'row' },
        el('span', { class: 'small', text: `ground guide: ${anim.groundY != null ? anim.groundY.toFixed(2) : 'off'}` }),
        button(anim.groundY == null ? 'place ground' : 'move ground', () => {
          store.ui.view.tool = 'ground';
          this.bindCanvasTools();
          toast('Click on the canvas where the ground line should sit.');
        }, { class: 'mini-btn' }),
        anim.groundY != null ? button('clear ground', () => store.updateAnim(anim.id, { groundY: null }, 'clear ground', false), { class: 'mini-btn' }) : null));
    return section('PIVOT / GROUND GUIDE', wrap);
  }

  bindCanvasTools() {
    const { store, canvasView } = this.ctx;
    const anim = this.anim;
    const tool = store.ui.view.tool;
    if (tool === 'pivot') {
      const frame = this.frame;
      canvasView.toolHandler = {
        down: pt => {
          const f = this.frame;
          if (!f) return null;
          const size = canvasView.contentSize();
          const pivot = { x: clamp01(pt.x / size.w), y: clamp01(pt.y / size.h) };
          store.setFramePatch(anim.id, f.id, { pivot }, 'drag pivot');
          return { kind: 'pivot' };
        },
        move: (d, pt) => {
          const f = this.frame;
          if (!f) return;
          const size = canvasView.contentSize();
          store.setFramePatch(anim.id, f.id, { pivot: { x: clamp01(pt.x / size.w), y: clamp01(pt.y / size.h) } }, 'drag pivot');
        },
        hover: () => 'crosshair',
      };
    } else if (tool === 'ground') {
      canvasView.toolHandler = {
        down: pt => {
          const size = canvasView.contentSize();
          store.updateAnim(anim.id, { groundY: clamp01(pt.y / size.h) }, 'set ground', false);
          return { kind: 'ground' };
        },
        move: (d, pt) => {
          const size = canvasView.contentSize();
          store.updateAnim(anim.id, { groundY: clamp01(pt.y / size.h) }, 'set ground', false);
        },
        hover: () => 'row-resize',
      };
    } else if (tool === 'box') {
      canvasView.toolHandler = {
        down: (pt) => ({ kind: 'box', x0: pt.x, y0: pt.y }),
        move: (d, pt) => { d.x1 = pt.x; d.y1 = pt.y; this.drawBoxPreview(d); },
        up: (d) => {
          const f = this.frame;
          if (!f || d.x1 == null) return;
          const size = canvasView.contentSize();
          const ctxRect = this.normRect(d, size);
          if (ctxRect.w * size.w < 3 || ctxRect.h * size.h < 3) { toast('Box too small — ignored.'); return; }
          store.mutate('add box', () => {
            f.boxes.push({ id: M.uid('box'), kind: this.boxKind, ...ctxRect });
          });
        },
        hover: () => 'crosshair',
      };
    } else if (tool === 'point') {
      canvasView.toolHandler = {
        down: pt => {
          const f = this.frame;
          if (!f) return null;
          const size = canvasView.contentSize();
          store.mutate('add point', () => {
            const existing = f.points.find(p => p.name === this.pointName);
            const ptN = { name: this.pointName, x: clamp01(pt.x / size.w), y: clamp01(pt.y / size.h) };
            if (existing) Object.assign(existing, ptN);
            else f.points.push(ptN);
          });
          return { kind: 'point' };
        },
        hover: () => 'crosshair',
      };
    } else {
      canvasView.toolHandler = null;
    }
  }

  normRect(d, size) {
    const x = Math.min(d.x0, d.x1) / size.w;
    const y = Math.min(d.y0, d.y1) / size.h;
    const w = Math.abs(d.x1 - d.x0) / size.w;
    const h = Math.abs(d.y1 - d.y0) / size.h;
    return { x: clamp01(x), y: clamp01(y), w: clamp01(w), h: clamp01(h) };
  }
  drawBoxPreview() { /* the commit snap is enough; overlay draws on finalize */ }

  // ---------------------------------------------------------------- pixel lab

  pixelLabSection() {
    const { store } = this.ctx;
    const anim = this.anim;
    const frame = this.frame;
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:6px' });
    wrap.append(el('p', { class: 'hint', text: 'Production tools for pixel-style sprites. All ops run on current frame (or clip where marked) and create versions.' }));
    const row1 = el('div', { class: 'btn-group' },
      button('Resize (nearest)…', () => frame && this.resizeDialog(frame), { class: 'mini-btn' }),
      button('Hard-edge alpha', () => frame && this.applyToFrame(frame, img => hardAlpha(img), 'hard alpha'), { class: 'mini-btn', title: 'Threshold semi-transparent pixels' }),
      button('Remove strays', () => frame && this.applyToFrame(frame, img => {
        const strayN = findStrayPixels(img).length;
        const { img: out, removed } = removeStrayPixels(img);
        toast(`Removed ${removed} stray pixel(s).`, removed ? 'ok' : 'info');
        return out;
      }, 'remove strays'), { class: 'mini-btn' }),
      button('Key out background…', () => frame && this.chromaDialog(frame), { class: 'mini-btn', title: 'Chroma-key a solid background to transparency' }));
    const row2 = el('div', { class: 'btn-group' },
      button('APPLY PALETTE TO CLIP…', () => this.paletteClipDialog(), { class: 'mini-btn' }),
      button('Apply palette to frame…', () => frame && this.paletteFrameDialog(frame), { class: 'mini-btn' }));
    wrap.append(row1, row2);
    if (frame) {
      const info = el('p', { class: 'small dim' });
      try {
        const img = store.imgStore.getImg(frame.imageId);
        const semi = semiAlphaCount(img);
        const strays = findStrayPixels(img).length;
        info.textContent = `frame facts: ${semi} semi-transparent px · ${strays} stray px`;
      } catch { info.textContent = ''; }
      wrap.append(info);
    }
    return section('PIXEL ART LAB', wrap);
  }

  resizeDialog(frame) {
    const { store } = this.ctx;
    const img = store.imgStore.getImg(frame.imageId);
    const wIn = numberInput({ label: 'Width', value: img.width, min: 1, max: 4096 });
    const hIn = numberInput({ label: 'Height', value: img.height, min: 1, max: 4096 });
    dialog({
      title: 'Nearest-neighbor resize', width: 380,
      content: el('div', {}, el('p', { class: 'hint', text: 'Pixel-art safe resize — never bilinear. Generates a new frame version.' }), el('div', { class: 'row' }, wIn.node, hIn.node)),
      actions: [{ label: 'Cancel', class: 'btn ghost' }, {
        label: 'Resize', class: 'btn',
        onClick: () => this.applyToFrame(frame, i => resizeNearest(i, Math.max(1, wIn.input.value), Math.max(1, hIn.input.value)), `resize ${wIn.input.value}×${hIn.input.value}`, { canvasToo: true }),
      }],
    });
  }

  chromaDialog(frame) {
    const { store } = this.ctx;
    const img = store.imgStore.getImg(frame.imageId);
    const auto = detectBackgroundColor(img);
    const hexOf = c => c ? '#' + c.map(v => v.toString(16).padStart(2, '0')).join('') : '#ffffff';
    const color = textInput({ label: 'Key color (hex)', value: hexOf(auto) });
    const tol = numberInput({ label: 'Tolerance', value: 32, min: 0, max: 180 });
    dialog({
      title: 'Chroma-key background', width: 400,
      content: el('div', {}, el('p', { class: 'hint', text: auto ? `Detected background rgb(${auto.join(',')}).` : 'No solid background auto-detected — set a color manually.' }), color.node, tol.node),
      actions: [{ label: 'Cancel', class: 'btn ghost' }, {
        label: 'Apply', class: 'btn',
        onClick: () => {
          const m = /^#?([0-9a-f]{6})$/i.exec(color.input.value.trim());
          if (!m) { toast('Invalid hex color.', 'error'); return; }
          const n = parseInt(m[1], 16);
          this.applyToFrame(frame, i => chromaKey(i, [(n >> 16) & 255, (n >> 8) & 255, n & 255], tol.input.value), 'chroma key');
        },
      }],
    });
  }

  paletteFrameDialog(frame) {
    this.paletteApplyDialog('frame', frame);
  }
  paletteClipDialog() {
    this.paletteApplyDialog('clip', null);
  }
  paletteApplyDialog(scope, frame) {
    const { store } = this.ctx;
    const ch = this.ch;
    if (!ch.palette.colors.length) { toast('No palette — extract one in CREATE first.', 'warn'); return; }
    const anim = this.anim;
    const targets = scope === 'clip' ? anim.frames.filter(f => f.imageId) : [frame];
    const dither = checkInput({ label: 'Dither (Floyd–Steinberg)', checked: false });
    const preview = el('div', { class: 'thumb-row' });
    const renderPreview = () => {
      preview.innerHTML = '';
      for (const f of targets.slice(0, 8)) {
        const img = store.imgStore.getImg(f.imageId);
        const q = quantizeToPalette(img, ch.palette.colors, { dither: dither.input.checked });
        const c = document.createElement('canvas');
        c.width = q.width; c.height = q.height;
        c.getContext('2d').putImageData(new ImageData(q.data, q.width, q.height), 0, 0);
        c.style.width = '52px'; c.style.imageRendering = 'pixelated';
        preview.append(c);
      }
    };
    dither.input.addEventListener('change', renderPreview);
    renderPreview();
    dialog({
      title: `Apply locked palette to ${scope === 'clip' ? targets.length + ' frames' : 'frame'} (preview)`,
      width: 560,
      content: el('div', { style: 'display:flex;flex-direction:column;gap:8px' },
        el('p', { class: 'hint', text: `Quantize to ${ch.palette.colors.length} locked colors. Transparency preserved. Each frame gets a new version.` }),
        dither.node,
        preview),
      actions: [{ label: 'Cancel', class: 'btn ghost' }, {
        label: 'Apply', class: 'btn',
        onClick: async () => {
          for (const f of targets) {
            const img = store.imgStore.getImg(f.imageId);
            const q = quantizeToPalette(img, ch.palette.colors, { dither: dither.input.checked });
            await store.replaceFrameImage(f.id, q, { label: 'palette quantize', op: 'palette' });
          }
          toast(`Palette applied to ${targets.length} frame(s).`, 'ok');
        },
      }],
    });
  }

  async applyToFrame(frame, fn, label, { canvasToo = false } = {}) {
    const { store } = this.ctx;
    try {
      const img = store.imgStore.getImg(frame.imageId);
      const out = fn(cloneImg(img));
      await store.replaceFrameImage(frame.id, out, { label, op: 'pixel-lab' });
      if (canvasToo) store.setFramePatch(this.anim.id, frame.id, { canvasDims: { w: out.width, h: out.height } }, label);
      store.emit('frame-image', frame.id);
      toast(`${label} applied`, 'ok');
    } catch (e) { toast(`${label} failed: ${e.message}`, 'error'); }
  }

  // ---------------------------------------------------------------- compare

  compareSection() {
    const { store } = this.ctx;
    const anim = this.anim;
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:6px' });
    const frames = anim.frames.filter(f => f.imageId);
    if (frames.length < 2) { wrap.append(el('p', { class: 'hint', text: 'Need at least 2 frames to compare.' })); return section('FLIPBOOK COMPARE', wrap); }
    const opts = frames.map((f, i) => ({ value: f.id, label: `f${anim.frames.indexOf(f) + 1} ${f.name ?? ''}` }));
    const cmp = store.ui.compare;
    const selA = selectInput({ label: 'A', options: opts, value: cmp.aId ?? opts[0].value, onChange: v => cmp.aId = v });
    const selB = selectInput({ label: 'B', options: opts, value: cmp.bId ?? opts[1].value, onChange: v => cmp.bId = v });
    const modeBtns = el('div', { class: 'btn-group' },
      ...['flipbook', 'ghost', 'side-by-side', 'trail'].map(mode => button(mode, () => this.setCompare(
        mode === 'side-by-side' ? 'side' : mode, selA.input.value, selB.input.value), { class: `mini-btn ${cmp.mode === mode ? 'active' : ''}` })),
      button('off', () => this.stopCompare(), { class: 'mini-btn' }));
    const trailRow = modeBtns;
    wrap.append(el('div', { class: 'row' }, selA.node, selB.node), modeBtns,
      el('div', { class: 'row' },
        field('Trail length', (() => { const r = el('input', { type: 'range', min: 2, max: 8, value: cmp.trailN }); r.addEventListener('input', () => { cmp.trailN = Number(r.value); store.emit('view'); }); return r; })())),
      el('p', { class: 'hint', text: 'Deterministic visual comparison — flipbook swaps A/B rapidly, ghost overlays with tint, side-by-side shows both, trail overlays consecutive silhouettes.' }));
    return section('FLIPBOOK COMPARE', wrap);
  }

  setCompare(mode, aId, bId) {
    const { store } = this.ctx;
    this.stopCompare();
    const cmp = store.ui.compare;
    cmp.mode = mode; cmp.aId = aId; cmp.bId = bId;
    if (mode === 'flipbook') {
      let showA = true;
      this.compareTimer = setInterval(() => {
        const id = showA ? cmp.aId : cmp.bId;
        const found = store.findFrame(id);
        if (found) {
          store.ui.playIndex = found.index;
          store.ui.selection.currentIndex = found.index;
          store.emit('view');
        }
        showA = !showA;
      }, 1000 / (this.anim?.defaultFPS || 8));
      cmp.animating = true;
    } else if (mode === 'side') {
      this.sideBySideDialog(aId, bId);
      cmp.mode = 'off';
    }
    store.emit('view');
  }

  startFlipbook(aId, bId) { this.setCompare('flipbook', aId, bId); }

  stopCompare() {
    if (this.compareTimer) { clearInterval(this.compareTimer); this.compareTimer = null; }
    const cmp = this.ctx.store.ui.compare;
    cmp.mode = 'off'; cmp.animating = false;
    this.ctx.store.emit('view');
  }

  sideBySideDialog(aId, bId) {
    const { store } = this.ctx;
    const makeCanvas = frameId => {
      const f = store.findFrame(frameId)?.frame;
      const c = document.createElement('canvas');
      if (!f?.imageId) return c;
      const img = store.imgStore.getImg(f.imageId);
      c.width = img.width; c.height = img.height;
      c.getContext('2d').putImageData(new ImageData(cloneImg(img).data, img.width, img.height), 0, 0);
      c.style.imageRendering = 'pixelated';
      c.style.width = '200px';
      return c;
    };
    const foundA = store.findFrame(aId), foundB = store.findFrame(bId);
    dialog({
      title: 'Side-by-side',
      width: 520,
      content: el('div', { class: 'row', style: 'align-items:flex-start' },
        el('div', { style: 'text-align:center' }, makeCanvas(aId), el('div', { class: 'small dim', text: `A · frame ${(foundA?.index ?? 0) + 1}` })),
        el('div', { style: 'text-align:center' }, makeCanvas(bId), el('div', { class: 'small dim', text: `B · frame ${(foundB?.index ?? 0) + 1}` }))),
      actions: [{ label: 'Close', class: 'btn' }],
    });
  }

  // ---------------------------------------------------------------- boxes + points

  boxesPointsSection() {
    const { store, canvasView } = this.ctx;
    const anim = this.anim;
    const frame = this.frame;
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:7px' });
    if (!frame) return section('HITBOXES & ATTACHMENT POINTS', wrap);
    // boxes
    const boxWrap = el('div', { style: 'display:flex;flex-direction:column;gap:4px' });
    boxWrap.append(el('div', { class: 'row' },
      selectInput({ label: 'Box kind', options: BOX_KINDS.map(k => ({ value: k, label: k })), value: this.boxKind, onChange: v => this.boxKind = v }).node,
      button('Draw box on canvas', () => { store.ui.view.tool = 'box'; this.bindCanvasTools(); toast('Drag a rectangle on the canvas.'); }, { class: 'mini-btn' })));
    for (const [i, box] of (frame.boxes ?? []).entries()) {
      boxWrap.append(el('div', { class: 'row small' },
        el('span', { text: `${box.kind} (${box.x.toFixed(2)},${box.y.toFixed(2)} ${box.w.toFixed(2)}×${box.h.toFixed(2)})` }),
        button('apply to selected', () => {
          const sel = store.ui.selection.frameIds;
          if (sel.length < 2) { toast('Select multiple frames in the timeline first.', 'warn'); return; }
          store.mutate('box to selection', () => {
            for (const id of sel) {
              const f = anim.frames.find(x => x.id === id);
              if (f && f.id !== frame.id) f.boxes.push({ ...box, id: M.uid('box') });
            }
          });
          toast(`Box copied to ${sel.length - 1} other frame(s).`, 'ok');
        }, { class: 'mini-btn' }),
        button('✕', () => store.mutate('remove box', () => { frame.boxes = frame.boxes.filter(b => b.id !== box.id); }), { class: 'mini-btn' })));
    }
    // points
    const ptWrap = el('div', { style: 'display:flex;flex-direction:column;gap:4px' });
    ptWrap.append(el('div', { class: 'row' },
      selectInput({ label: 'Point name', options: POINT_NAMES.map(p => ({ value: p, label: p })), value: this.pointName, onChange: v => this.pointName = v }).node,
      button('Place on canvas', () => { store.ui.view.tool = 'point'; this.bindCanvasTools(); toast('Click on the canvas to place/move the point.'); }, { class: 'mini-btn' })));
    for (const p of frame.points ?? []) {
      ptWrap.append(el('div', { class: 'row small' },
        el('span', { text: `${p.name} (${p.x.toFixed(2)}, ${p.y.toFixed(2)})` }),
        button('copy to selected', () => this.copyPointAcross(p), { class: 'mini-btn' }),
        button('✕', () => store.mutate('remove point', () => { frame.points = frame.points.filter(x => x !== p); }), { class: 'mini-btn' })));
    }
    ptWrap.append(button('Interpolate point across range…', () => this.interpolatePointDialog(), { class: 'mini-btn' }));
    wrap.append(section('BOXES (collision/hurt/attack/interact)', boxWrap), section('ATTACHMENT POINTS', ptWrap));
    return section('GAME METADATA (per frame)', wrap);
  }

  copyPointAcross(p) {
    const { store } = this.ctx;
    const anim = this.anim;
    const sel = store.ui.selection.frameIds;
    if (sel.length < 2) { toast('Select multiple frames first.', 'warn'); return; }
    store.mutate('point to selection', () => {
      for (const id of sel) {
        const f = anim.frames.find(x => x.id === id);
        if (!f) continue;
        const existing = f.points.find(x => x.name === p.name);
        if (existing) Object.assign(existing, { x: p.x, y: p.y });
        else f.points.push({ name: p.name, x: p.x, y: p.y });
      }
    });
  }

  interpolatePointDialog() {
    const { store } = this.ctx;
    const anim = this.anim;
    const withPoint = name => anim.frames.filter(f => f.points.some(p => p.name === name));
    const names = [...new Set(anim.frames.flatMap(f => f.points.map(p => p.name)))];
    if (!names.length) { toast('No points placed yet.', 'warn'); return; }
    const nameSel = selectInput({ label: 'Point', options: names.map(n => ({ value: n, label: n })), value: names[0] });
    const run = (name) => {
      const keyed = anim.frames.map((f, i) => ({ f, i })).filter(({ f }) => f.points.some(p => p.name === name));
      if (keyed.length < 2) { toast(`Point "${name}" needs to exist on at least two frames to interpolate.`, 'warn'); return; }
      store.mutate('interpolate point', () => {
        for (let k = 0; k < keyed.length - 1; k++) {
          const a = keyed[k], b = keyed[k + 1];
          const pa = a.f.points.find(p => p.name === name);
          const pb = b.f.points.find(p => p.name === name);
          for (let i = a.i + 1; i < b.i; i++) {
            const t = (i - a.i) / (b.i - a.i);
            const f = anim.frames[i];
            const pos = { x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t };
            const existing = f.points.find(p => p.name === name);
            if (existing) Object.assign(existing, pos);
            else f.points.push({ name, ...pos });
          }
        }
      });
      toast(`Interpolated "${name}" across ${anim.frames.length} frames.`, 'ok');
    };
    dialog({
      title: 'Interpolate point across range',
      width: 420,
      content: el('div', {}, el('p', { class: 'hint', text: 'Linearly fills point positions between keyframes that define it (useful for weapons/hands/effect-origins).' }), nameSel.node),
      actions: [{ label: 'Cancel', class: 'btn ghost' }, { label: 'Interpolate', class: 'btn', onClick: () => run(nameSel.input.value) }],
    });
  }
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
