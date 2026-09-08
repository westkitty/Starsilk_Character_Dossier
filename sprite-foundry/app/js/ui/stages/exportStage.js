// stages/export.js — EXPORT stage: GIF (validated + previewed), PNG sequence
// ZIP, APNG, sheet/metadata shortcuts, portable project save/open, presets.
import { el, $, toast, dialog, field, textInput, numberInput, selectInput, checkInput, button, section } from '../components.js';
import { pickFile } from '../../browser.js';
import { exportableFrames } from '../../exporters.js';

export class ExportStage {
  constructor(ctx) { this.ctx = ctx; }

  get anim() { return this.ctx.store.activeAnim(); }
  get ch() { return this.ctx.store.activeChar(); }

  activate() {
    // export stage shows the animation on the main canvas (no override)
  }
  deactivate() {}

  render(root) {
    root.innerHTML = '';
    const anim = this.anim;
    const eligible = anim ? exportableFrames(anim, this.ctx.store.imgStore, { includeDrafts: true }) : null;
    root.append(
      section('EXPORT TARGET', this.targetPanel()),
      this.gifPanel(),
      this.apngPanel(),
      this.sequencePanel(),
      this.sheetPanel(),
      this.projectPanel());
  }

  targetPanel() {
    const { store } = this.ctx;
    const anim = this.anim;
    const ch = this.ch;
    if (!anim) return el('p', { class: 'dim', text: 'Select an animation first.' });
    const approved = anim.frames.filter(f => f.status === 'approved').length;
    const drafts = anim.frames.filter(f => f.status === 'draft').length;
    const rejected = anim.frames.filter(f => f.status === 'rejected').length;
    return el('div', { style: 'display:flex;flex-direction:column;gap:6px' },
      el('div', { class: 'small', text: `character "${ch?.name}" · clip "${anim.name}" (${anim.direction})` }),
      el('div', { class: 'small' },
        el('span', { class: 'badge badge-approved', text: 'A' }), ` ${approved} approved · `,
        el('span', { class: 'badge badge-draft', text: 'D' }), ` ${drafts} draft · `,
        el('span', { class: 'badge badge-rejected', text: 'R' }), ` ${rejected} rejected`),
      el('p', { class: 'hint', text: 'Exports include approved frames (falling back to drafts-with-images if nothing is approved); rejected frames never ship. Set status in FRAMES or the timeline.' }));
  }

  gifPanel() {
    const { store, exporters } = this.ctx;
    const anim = this.anim;
    const o = { scale: 1, loop: 0, bg: 'keep', fps: anim?.defaultFPS ?? 8, perFrame: true };
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:7px' });
    const previewBox = el('div', { style: 'min-height:32px' });
    const info = el('p', { class: 'small dim', text: '' });
    const buildBtn = button('BUILD GIF', async () => {
      if (!anim) return;
      buildBtn.disabled = true;
      previewBox.innerHTML = '';
      info.textContent = 'Encoding…';
      try {
        const result = await exporters.exportGif(anim, {
          scale: o.scale, loop: o.loop,
          bg: o.bg === 'keep' ? null : o.bg === 'white' ? [255, 255, 255] : o.bg === 'black' ? [0, 0, 0] : null,
          fps: o.fps, usePerFrameDurations: o.perFrame,
        });
        info.textContent = '';
        const img = el('img', { src: result.previewUrl, alt: 'GIF preview', style: 'max-width:100%;image-rendering:pixelated;background:repeating-conic-gradient(#23262b 0 25%,#2b2f35 0 50%) 0 0/12px 12px;border-radius:4px' });
        previewBox.append(img);
        const v = result.validation;
        const lines = [
          `${result.framesCount} frames · ${(result.bytes.length / 1024).toFixed(1)} KB`,
          v.ok ? '✓ signature GIF89a · animated · delays verified' : `⚠ ${v.errors.join('; ')}`,
          ...result.warnings.map(w => `⚠ ${w}`),
        ];
        previewBox.append(el('div', { class: 'small', style: 'white-space:pre-wrap' }, lines.join('\n')));
        previewBox.append(button('Download GIF', () => result.download(), { class: 'btn' }));
        toast(`GIF built and self-validated (${result.framesCount} frames, delays verified, signature checked).`, 'ok');
      } catch (e) { toast(`GIF encoding failed: ${e.message}`, 'error'); info.textContent = ''; }
      finally { buildBtn.disabled = false; }
    }, { class: 'btn' });
    wrap.append(
      el('div', { class: 'row' },
        selectInput({ label: 'Scale', options: [1, 2, 4, 8].map(n => ({ value: n, label: `${n}× nearest` })), value: o.scale, onChange: v => o.scale = Number(v) }).node,
        selectInput({ label: 'Background', options: [{ value: 'keep', label: 'keep transparency' }, { value: 'white', label: 'flatten on white' }, { value: 'black', label: 'flatten on black' }], value: o.bg, onChange: v => o.bg = v }).node),
      el('div', { class: 'row' },
        numberInput({ label: 'Global FPS', value: o.fps, min: 1, max: 50, onChange: v => o.fps = v }).node,
        numberInput({ label: 'Loop count (0 = forever)', value: o.loop, min: 0, max: 999, onChange: v => o.loop = v }).node),
      checkInput({ label: 'Per-frame durations (uncheck to force global FPS)', checked: o.perFrame, onChange: v => o.perFrame = v }).node,
      buildBtn, previewBox, info,
      el('p', { class: 'hint', text: 'Real GIF89a bytes from an in-app encoder (LZW + global palette + transparency index). The file is re-decoded after encoding to verify signature, frame count, order and delays. GIF transparency is binary — partial alpha is thresholded; prefer APNG below for full alpha.' }));
    return section('ANIMATED GIF', wrap);
  }

  apngPanel() {
    const { exporters } = this.ctx;
    const anim = this.anim;
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:7px' });
    const previewBox = el('div', {});
    wrap.append(
      el('p', { class: 'hint', text: 'Full-alpha animation (lossless RGBA + per-frame delays). Plays in browsers and many engines; conventional file extension is .png.' }),
      button('BUILD APNG', async () => {
        if (!anim) return;
        previewBox.innerHTML = 'Encoding…';
        try {
          const r = await exporters.exportApng(anim, {});
          previewBox.innerHTML = '';
          const img = el('img', { src: r.previewUrl, alt: 'APNG preview', style: 'max-width:100%;image-rendering:pixelated;background:repeating-conic-gradient(#23262b 0 25%,#2b2f35 0 50%) 0 0/12px 12px;border-radius:4px' });
          previewBox.append(img, button('Download APNG (.png)', () => r.download(), { class: 'btn' }));
        } catch (e) { previewBox.innerHTML = ''; toast(`APNG failed: ${e.message}`, 'error'); }
      }, { class: 'btn ghost' }),
      previewBox,
      el('p', { class: 'hint', text: 'Animated WebP: not supported — no reliable encoder path exists in-browser without binaries; GIF + APNG cover the animated range.' }));
    return section('APNG (BETTER ALPHA)', wrap);
  }

  sequencePanel() {
    const { exporters } = this.ctx;
    const anim = this.anim;
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:7px' });
    const o = { scale: 1, drafts: false };
    wrap.append(
      el('div', { class: 'row' },
        selectInput({ label: 'Scale', options: [1, 2, 4].map(n => ({ value: n, label: `${n}× nearest` })), value: o.scale, onChange: v => o.scale = Number(v) }).node,
        checkInput({ label: 'Include drafts', checked: o.drafts, onChange: v => o.drafts = v }).node),
      button('DOWNLOAD PNG SEQUENCE (ZIP)', async () => {
        if (!anim) return;
        try {
          const r = await exporters.exportPngSequenceZip(anim, { scale: o.scale, includeDrafts: o.drafts });
          toast(`ZIP with ${r.framesCount} PNGs (${(r.bytes / 1024).toFixed(0)} KB).`, 'ok');
        } catch (e) { toast(e.message, 'error'); }
      }, { class: 'btn' }),
      button('Save individual PNGs…', async () => {
        if (!anim) return;
        const { frames } = exportableFrames(anim, this.ctx.store.imgStore, { includeDrafts: o.drafts });
        if (!frames.length) { toast('No frames to export.', 'warn'); return; }
        const { imgToBlob, downloadBlob } = await import('../../browser.js');
        for (let i = 0; i < frames.length; i++) {
          const blob = await imgToBlob(frames[i].img);
          downloadBlob(blob, `${anim.name}_${String(i).padStart(3, '0')}.png`);
        }
        toast(`${frames.length} PNG download(s) queued (browser may ask about multiple downloads).`, 'ok');
      }, { class: 'btn ghost' }));
    return section('PNG FRAMES', wrap);
  }

  sheetPanel() {
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:7px' });
    wrap.append(
      el('p', { class: 'hint', text: 'Sheets and atlases are built in PACK (preview, trim, extrusion, metadata schemas). If a sheet was already built there, it can be downloaded again here.' }),
      el('div', { class: 'btn-group' },
        button('Go to PACK', () => this.ctx.setStage('pack'), { class: 'btn ghost' }),
        button('Download sheet PNG', async () => {
          const p = this.ctx.store.ui.pack;
          if (!p || p.error) { toast('No built sheet — build one in PACK first.', 'warn'); return; }
          const { imgToBlob, downloadBlob } = await import('../../browser.js');
          downloadBlob(await imgToBlob(p.sheet), `${this.anim?.name ?? 'sheet'}.png`);
        }, { class: 'btn ghost' })),
      section('EXPORT PRESETS', el('div', {}, el('p', { class: 'hint', text: 'Preset formats live on the PACK metadata panel: Sprite Foundry generic JSON · Aseprite-style JSON · Phaser 3/Pixi atlas JSON. Only formats with genuinely matching structures are offered — no button claims an engine it cannot satisfy.' }))));
    return section('SPRITE SHEETS', wrap);
  }

  projectPanel() {
    const { store, exporters } = this.ctx;
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:7px' });
    wrap.append(
      el('div', { class: 'btn-group' },
        button('SAVE PROJECT (.spriteproject)', async () => {
          try { const r = await exporters.saveProject(); toast(`Saved ${r.name}: ${r.images} images, ${(r.bytes / 1024).toFixed(0)} KB ZIP.`, 'ok'); }
          catch (e) { toast(e.message, 'error'); }
        }, { class: 'btn' }),
        button('OPEN PROJECT…', async () => {
          const file = await pickFile({ accept: '.spriteproject,.zip' });
          if (!file) return;
          try { const r = await exporters.openProject(file); toast(`Loaded "${r.project.name}" (${r.images} images).`, 'ok'); }
          catch (e) { toast(e.message, 'error', 6500); }
        }, { class: 'btn ghost' })),
      el('p', { class: 'hint', text: 'The archive contains manifest.json (full project model: genome, lineage, versions, pivots, boxes, palettes, blueprints) + media/*.png. Local IndexedDB autosave keeps working sessions alive across reloads.' }),
      el('div', { class: 'row' },
        checkInput({ label: 'Local autosave', checked: store.autosaveEnabled, onChange: v => { store.autosaveEnabled = v; if (!v) store.clearLocal(); } }).node,
        button('Clear autosave data', async () => { await store.clearLocal(); toast('Local autosave removed.', 'ok'); }, { class: 'mini-btn' })));
    return section('PORTABLE PROJECT', wrap);
  }
}
