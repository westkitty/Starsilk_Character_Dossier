// stages/create.js — CREATE stage: character generation form, candidate tray,
// master reference, Character Genome editor, reference stack, palette lock.
import { el, $, toast, dialog, field, textInput, numberInput, selectInput, checkInput, button, section, swatch, lazyThumb } from '../components.js';
import * as M from '../../lib/model.js';
import { STYLE_PRESETS, DIRECTIONS_8, GENOME_SECTIONS, createReference, genomeAsymmetryWarning } from '../../lib/model.js';
import { pickFile, importImageFile, downloadBlob } from '../../browser.js';
import { extractPalette, quantizeToPalette, cloneImg } from '../../lib/img.js';

const REFERENCE_ROLES = ['identity', 'style', 'pose', 'previous-frame', 'next-frame', 'palette', 'master'];

export class CreateStage {
  constructor(ctx) {
    this.ctx = ctx;
    this.spec = {
      prompt: '', negative: '', styleId: 'pixel-art', customStylePrompt: '',
      view: 'side', facing: 'east', width: 256, height: 256,
      background: 'white', seed: -1, count: 1,
    };
    ctx.store.on('providers', () => this.refreshProviderNote());
  }

  activate() {}
  deactivate() {}

  get char() { return this.ctx.store.activeChar(); }

  refreshProviderNote() {
    const note = $('#provider-note');
    if (!note) return;
  }

  render(root) {
    const { store, providers } = this.ctx;
    const ch = this.char;
    root.innerHTML = '';
    if (!ch) { root.append(el('p', { class: 'dim', text: 'Add a character from the project panel.' })); return; }

    root.append(
      this.masterBanner(),
      this.generationForm(),
      this.candidateTray(),
      this.referenceStack(),
      this.genomeEditor(),
      this.paletteSection());

    // async provider note
    providers.refresh().then(report => {
      const usable = report.find(r => r.caps.t2i);
      const note = $('#provider-note');
      if (note) {
        const active = report.find(r => r.id === providers.activeId);
        note.textContent = active && active.caps.t2i
          ? `Provider: ${active.name}`
          : 'No usable image provider detected — generation is unavailable until one works (open the provider dialog at top right).';
        note.style.color = active && active.caps.t2i ? 'var(--ok)' : 'var(--warn)';
      }
    });
  }

  // ---------------------------------------------------------------- master banner

  masterBanner() {
    const { store, imgStore } = this.ctx;
    const ch = this.char;
    if (!ch.masterImageId) {
      return section('MASTER REFERENCE',
        el('p', { class: 'hint', text: 'No master yet. Generate candidates below (or import artwork), then press SET AS MASTER on one. The master is the canonical identity used by all animation generation.' }));
    }
    const banner = el('div', { class: 'master-banner' });
    banner.append(
      lazyThumb(imgStore, ch.masterImageId, { alt: 'Master reference' }),
      el('div', {},
        el('div', { style: 'font-weight:600' }, `★ Master — ${ch.masterSource ?? 'selected'}`),
        el('div', { class: 'hint', text: 'Canonical identity & style lock. Only an explicit SET AS MASTER replaces it.' }),
        el('div', { class: 'btn-group', style: 'margin-top:4px' },
          button('View full', () => this.viewImage(ch.masterImageId, 'Master reference'), { class: 'mini-btn' }),
          button('Download', async () => downloadBlob(await imgStore.getBlob(ch.masterImageId), `${ch.name}_master.png`), { class: 'mini-btn' }))));
    const sec = section('MASTER REFERENCE', banner);
    return sec;
  }

  // ---------------------------------------------------------------- generation form

  generationForm() {
    const { store, genops, providers } = this.ctx;
    const ch = this.char;
    const s = this.spec;
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:7px' });
    const styleOpts = STYLE_PRESETS.map(p => ({ value: p.id, label: p.label }));
    const genBtn = button(`GENERATE ${s.count} CANDIDATE${s.count > 1 ? 'S' : ''}`, async () => {
      if (!s.prompt.trim()) { toast('Describe the character first.', 'warn'); return; }
      const caps = await providers.caps(providers.activeId);
      if (!caps?.t2i) { toast('Active provider cannot generate images — open the provider dialog.', 'error'); return; }
      try {
        await genops.generateCandidates(ch.id, { ...s }, s.count);
        toast(`Queued ${s.count} candidate job(s) — watch the Jobs drawer (top right). Completed candidates appear below as they finish.`, 'ok', 6000);
      } catch (e) { toast(e.message, 'error'); }
    }, { class: 'btn' });

    wrap.append(
      textInput({ label: 'Character description', value: s.prompt, multiline: true, rows: 2, placeholder: 'small side-view adventurer sprite, green hood, lantern…', onChange: v => s.prompt = v }).node,
      textInput({ label: 'Negative prompt (what to avoid)', value: s.negative, placeholder: 'blurry, extra limbs…', onChange: v => s.negative = v }).node,
      selectInput({ label: 'Style preset', options: styleOpts, value: s.styleId, onChange: v => { s.styleId = v; this.renderPromptPreview(); } }).node,
      s.styleId === 'custom' ? textInput({ label: 'Custom style prompt', value: s.customStylePrompt, onChange: v => s.customStylePrompt = v }).node : null,
      el('div', { class: 'row' },
        selectInput({ label: 'Camera/view', options: [{ value: 'side', label: 'side view' }, { value: 'front', label: 'front view' }, { value: 'three-quarter', label: '¾ view' }], value: s.view, onChange: v => s.view = v }).node,
        selectInput({ label: 'Facing (side view)', options: DIRECTIONS_8.map(d => ({ value: d, label: d })), value: s.facing, onChange: v => s.facing = v }).node),
      el('div', { class: 'row' },
        numberInput({ label: 'Width', value: s.width, min: 64, max: 1280, step: 64, onChange: v => s.width = v }).node,
        numberInput({ label: 'Height', value: s.height, min: 64, max: 1280, step: 64, onChange: v => s.height = v }).node),
      el('div', { class: 'row' },
        selectInput({ label: 'Background', options: [{ value: 'white', label: 'white (key out later)' }, { value: 'solid', label: 'solid color' }, { value: 'transparent-request', label: 'transparent (provider-dependent)' }], value: s.background, onChange: v => s.background = v }).node,
        numberInput({ label: 'Seed (−1 = random)', value: s.seed, min: -1, onChange: v => s.seed = v }).node,
        numberInput({ label: 'Count', value: s.count, min: 1, max: 4, onChange: v => s.count = v }).node),
      el('p', { class: 'hint', id: 'generate-note', text: 'Style presets are visual starting points — named after eras for convenience, not hardware-accurate emulation.' }),
      genBtn,
      el('p', { id: 'provider-note', class: 'hint', text: 'Checking provider…' }));

    // disable transparent background option if provider lacks it
    providers.caps(providers.activeId).then(caps => {
      const sel = [...wrap.querySelectorAll('select')].find(s => [...s.options].some(o => o.value === 'transparent-request'));
      if (!sel) return;
      const opt = [...sel.options].find(o => o.value === 'transparent-request');
      if (opt) {
        opt.disabled = !caps.transparency;
        if (!caps.transparency) opt.title = 'The active provider cannot return transparent backgrounds';
        if (s.background === 'transparent-request' && !caps.transparency) { s.background = 'white'; sel.value = 'white'; }
      }
    });

    // import as candidate
    const importBtn = button('Import image as candidate', async () => {
      const file = await pickFile({ accept: 'image/png,image/jpeg,image/webp' });
      if (!file) return;
      try {
        const { frames } = await importImageFile(file);
        if (frames.length > 1) { toast('That file is an animation — use the SLICE stage or drag it onto the app to import frames.', 'warn'); return; }
        const imageId = await store.imgStore.putImg(frames[0].img);
        store.addCandidate(ch.id, { id: M.uid('cand'), imageId, prompt: null, spec: null, rejected: false, createdAt: Date.now(), lineage: { provider: 'local-import', operation: 'import', prompt: null, createdAt: Date.now() } });
      } catch (e) { toast(e.message, 'error'); }
    }, { class: 'btn ghost' });
    wrap.append(importBtn);
    return section('GENERATE CHARACTER', wrap);
  }

  renderPromptPreview() { /* the note stays honest: presets are style hints */ }

  // ---------------------------------------------------------------- candidate tray

  candidateTray() {
    const { store, imgStore, genops } = this.ctx;
    const ch = this.char;
    const grid = el('div', { class: 'cand-grid' });
    const items = [...ch.candidates].sort((a, b) => b.createdAt - a.createdAt);
    if (!items.length) grid.append(el('p', { class: 'hint', text: 'Candidates will appear here as jobs complete. Nothing replaces your master until you explicitly promote one.' }));
    for (const cand of items) {
      const isMaster = ch.masterImageId === cand.imageId;
      const card = el('div', { class: `cand-card ${isMaster ? 'master' : ''} ${cand.rejected ? 'rejected' : ''}` });
      const imgEl = lazyThumb(imgStore, cand.imageId, { cls: 'cand-img', alt: 'Generated candidate', title: `${cand.prompt ?? 'imported image'}\nseed: ${cand.seed ?? '—'}` });
      imgEl.addEventListener('click', () => this.viewImage(cand.imageId, cand.prompt ?? 'Candidate'));
      card.append(imgEl,
        el('div', { class: 'cand-actions' },
          button(isMaster ? '★ MASTER' : 'SET AS MASTER', () => {
            store.setMaster(ch.id, cand.imageId, cand.lineage?.provider === 'local-import' ? 'imported' : 'generated');
            store.ui.selection.candidateIds = [cand.id];
            toast('Master reference locked. The genome below is now the continuity contract for motion generation — fill it in.', 'ok');
          }, { class: `mini-btn ${isMaster ? '' : 'active'}` }),
          button('Vary', () => { cand.spec ? genops.varyCandidate(ch.id, cand.id) : toast('Imported candidates have no prompt to vary.', 'warn'); }, { class: 'mini-btn', title: 'Generate a variation (same prompt, new seed)' }),
          button('↻', () => { cand.spec ? genops.regenerateCandidate(ch.id, cand.id) : toast('No prompt recorded for this candidate.', 'warn'); }, { class: 'mini-btn', title: 'Regenerate (same prompt, random seed)' }),
          button(cand.rejected ? 'Unreject' : 'Reject', () => store.updateCandidate(ch.id, cand.id, { rejected: !cand.rejected }), { class: 'mini-btn' }),
          button('⌄', async () => downloadBlob(await imgStore.getBlob(cand.imageId), `candidate_${cand.id.slice(-6)}.png`), { class: 'mini-btn', title: 'Download PNG' }),
          button('✕', () => {
            if (isMaster && !confirm('This candidate IS the master reference. Remove it anyway (master will be unset)?')) return;
            if (isMaster) store.setMaster(ch.id, null, null);
            store.removeCandidate(ch.id, cand.id);
          }, { class: 'mini-btn', title: 'Delete candidate' })));
      grid.append(card);
    }
    return section(`CANDIDATE TRAY (${items.length})`, grid);
  }

  viewImage(imageId, title) {
    const { store } = this.ctx;
    const img = store.imgStore.getImg(imageId);
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
    const scale = Math.min(6, Math.max(1, Math.floor(512 / Math.max(img.width, img.height))));
    c.style.width = `${img.width * scale}px`;
    c.style.imageRendering = 'pixelated';
    dialog({ title, content: () => el('div', { style: 'display:flex;justify-content:center;background:repeating-conic-gradient(#1d2026 0 25%,#23262d 0 50%) 0 0/16px 16px;padding:12px;border-radius:4px' }, c), actions: [{ label: 'Close', class: 'btn' }], width: Math.min(680, img.width * scale + 60) });
  }

  // ---------------------------------------------------------------- reference stack

  referenceStack() {
    const { store } = this.ctx;
    const ch = this.char;
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:6px' });
    wrap.append(el('p', { class: 'hint', text: 'Named roles for reference images. Providers that accept references use identity+style+pose when generating; previous/next frame roles condition in-betweening.' }));
    for (const ref of ch.references) {
      const row = el('div', { class: 'ref-row' },
        lazyThumb(store.imgStore, ref.imageId, { alt: '' }),
        el('div', { class: 'ref-roles' },
          REFERENCE_ROLES.map(role => el('span', {
            class: `role-chip ${ref.roles.includes(role) ? 'on' : ''}`,
            text: role, title: `Toggle the "${role}" role`,
            onClick: () => {
              store.mutate('edit reference', () => {
                ref.roles = ref.roles.includes(role) ? ref.roles.filter(r => r !== role) : [...ref.roles, role];
                if (!ref.roles.length) ref.roles = ['identity'];
              });
            },
          })),
          el('button', { class: 'icon-btn', title: 'Remove reference', onClick: () => store.mutate('remove reference', () => { ch.references = ch.references.filter(r => r.id !== ref.id); }) }, '🗑')));
      wrap.append(row);
    }
    const addRow = el('div', { class: 'btn-group' },
      button('Add reference image…', async () => {
        const file = await pickFile({ accept: 'image/png,image/jpeg,image/webp' });
        if (!file) return;
        const { frames } = await importImageFile(file);
        const imageId = await store.imgStore.putImg(frames[0].img);
        store.mutate('add reference', () => {
          ch.references.push(createReference(imageId, ['identity'], file.name));
        });
      }, { class: 'mini-btn' }),
      ch.masterImageId && !ch.references.some(r => r.roles.includes('master'))
        ? button('Add master as "master" reference', () => store.mutate('add reference', () => { ch.references.push(createReference(ch.masterImageId, ['master', 'identity'], 'master')); }), { class: 'mini-btn' })
        : null);
    wrap.append(addRow);
    return section(`REFERENCE STACK (${ch.references.length})`, wrap);
  }

  // ---------------------------------------------------------------- genome editor

  genomeEditor() {
    const { store } = this.ctx;
    const ch = this.char;
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:6px' });
    wrap.append(el('p', { class: 'hint', text: 'The genome is a persistent identity specification injected into every generation prompt. Locked fields are emphasized. It aids continuity — it cannot guarantee a generative model never drifts.' }));
    const warn = genomeAsymmetryWarning(ch.genome);
    if (warn) wrap.append(el('p', { class: 'hint', style: 'color:var(--warn)', text: `⚠ Mirroring note: ${warn}` }));
    for (const [sectionKey, def] of Object.entries(GENOME_SECTIONS)) {
      const body = el('div', { style: 'display:flex;flex-direction:column;gap:5px' });
      for (const [fieldKey, label] of Object.entries(def.fields)) {
        const g = ch.genome[sectionKey]?.[fieldKey];
        if (!g) continue;
        const ta = el('textarea', { rows: 1, placeholder: '—', 'aria-label': `${def.label}: ${label}` }, g.value || '');
        ta.addEventListener('input', () => {
          store.updateGenome(ch.id, genome => { genome[sectionKey][fieldKey].value = ta.value; });
        });
        const lock = el('button', {
          class: `lock-btn ${g.locked ? 'locked' : ''}`, title: g.locked ? 'Locked — emphasized in prompts' : 'Unlocked', 'aria-pressed': String(!!g.locked),
          onClick: () => store.updateGenome(ch.id, genome => { genome[sectionKey][fieldKey].locked = !genome[sectionKey][fieldKey].locked; }),
        }, g.locked ? '🔒' : '🔓');
        body.append(el('div', { class: 'genome-field' },
          el('span', { class: 'field-label', style: 'width:86px;flex:none;font-size:10px;padding-top:5px', text: label }), ta, lock));
      }
      wrap.append(section(def.label, body));
    }
    return section('CHARACTER GENOME', wrap);
  }

  // ---------------------------------------------------------------- palette

  paletteSection() {
    const { store } = this.ctx;
    const ch = this.char;
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:7px' });
    const palRow = el('div', { class: 'swatch-row' });
    if (ch.palette.colors.length) {
      ch.palette.colors.forEach((c, i) => palRow.append(swatch(c, {
        onRemove: () => {
          store.mutate('palette edit', () => { ch.palette.colors.splice(i, 1); });
        },
        title: `rgb(${c.join(',')}) — click to remove, dbl-click to edit`,
        onEdit: () => {
          const hex = prompt('Edit color (hex)', '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''));
          if (hex && /^#?[0-9a-f]{6}$/i.test(hex)) {
            const n = parseInt(hex.replace('#', ''), 16);
            store.mutate('palette edit', () => { ch.palette.colors[i] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; });
          }
        },
      })));
    } else palRow.append(el('span', { class: 'hint', text: 'No palette yet.' }));
    wrap.append(
      palRow,
      el('div', { class: 'row' },
        numberInput({ label: 'Max colors', value: ch.palette.maxSize, min: 2, max: 256, onChange: v => store.mutate('palette edit', () => { ch.palette.maxSize = Math.max(2, Math.min(256, v)); }) }).node),
      el('div', { class: 'btn-group' },
        button('EXTRACT PALETTE FROM MASTER', () => {
          if (!ch.masterImageId) { toast('Set a master reference first.', 'warn'); return; }
          const img = store.imgStore.getImg(ch.masterImageId);
          const colors = extractPalette(img, ch.palette.maxSize);
          store.mutate('extract palette', () => { ch.palette.colors = colors; ch.palette.source = 'master'; });
          toast(`Extracted ${colors.length} colors from master.`, 'ok');
        }, { class: 'mini-btn', disabled: !ch.masterImageId }),
        checkInput({ label: 'Palette locked', checked: ch.palette.locked, onChange: v => store.mutate('palette lock', () => { ch.palette.locked = v; }) }).node),
      el('p', { class: 'hint', text: 'Locking adds the palette to generation prompts and enables drift warnings + optional clip quantization in FRAMES → Pixel Lab. Optional by design — illustrated styles may not want it.' }));
    return section('PALETTE', wrap);
  }
}
