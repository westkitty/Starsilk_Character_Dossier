// main.js — boot + application chrome: stage routing, project tree, topbar,
// jobs drawer, keyboard workflow, empty state, dialogs.
import { Store } from './store.js';
import { ImageStore } from './imgstore.js';
import { ProviderRegistry } from './providers.js';
import { GenOps } from './genops.js';
import { Exporters } from './exporters.js';
import { CanvasView, initCaches } from './ui/canvasView.js';
import { Timeline } from './ui/timeline.js';
import { el, $, toast, dialog, field, textInput, numberInput, selectInput, checkInput, button, lazyThumb } from './ui/components.js';
import { importImageFile, pickFile, downloadBlob } from './browser.js';
import * as M from './lib/model.js';
import { inspectClip } from './lib/qa.js';
import { manifestFromJson } from './lib/serialize.js';

import { CreateStage } from './ui/stages/create.js';
import { MotionStage } from './ui/stages/motion.js';
import { FramesStage } from './ui/stages/frames.js';
import { SliceStage } from './ui/stages/slice.js';
import { PackStage } from './ui/stages/pack.js';
import { ExportStage } from './ui/stages/exportStage.js';

const ctx = {};
window.__sf = ctx; // debugging handle (also used by smoke tests)

async function boot() {
  const imgStore = new ImageStore();
  await imgStore.init();
  const store = new Store(imgStore);
  const providers = new ProviderRegistry(store);
  const genops = new GenOps(store, providers);
  const exporters = new Exporters(store);
  Object.assign(ctx, { store, imgStore, providers, genops, exporters });

  const canvas = $('#view');
  const canvasView = new CanvasView(store, canvas, $('#canvas-hud'));
  initCaches(canvasView);
  ctx.canvasView = canvasView;
  const timeline = new Timeline(store, $('#timeline'), genops);
  ctx.timeline = timeline;

  const stages = {
    create: new CreateStage(ctx),
    motion: new MotionStage(ctx),
    frames: new FramesStage(ctx),
    slice: new SliceStage(ctx),
    pack: new PackStage(ctx),
    export: new ExportStage(ctx),
  };
  ctx.stages = stages;

  // ------------------------------------------------------------ stage routing
  const stageButtons = [...document.querySelectorAll('.stage-btn')];
  function setStage(stage) {
    stages[store.ui.stage]?.deactivate?.();
    store.ui.stage = stage;
    stageButtons.forEach(b => {
      const on = b.dataset.stage === stage;
      b.classList.toggle('active', on);
      b.setAttribute('aria-current', on ? 'true' : 'false');
    });
    canvasView.stageRenderer = null;
    canvasView.toolHandler = null;
    stages[stage]?.activate?.();
    renderInspector();
    canvasView.requestRender();
    store.emit('ui');
  }
  stageButtons.forEach(b => b.addEventListener('click', () => setStage(b.dataset.stage)));
  ctx.setStage = setStage;

  function renderInspector() {
    // never yank focus out from under a typing user
    const active = document.activeElement;
    const root = $('#inspector');
    if (active && root.contains(active) && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;
    root.innerHTML = '';
    stages[store.ui.stage]?.render?.(root);
  }
  imgStore.onChange(() => { canvasView.requestRender(); timeline.render(); });
  store.on('ui', renderInspector);
  store.on('project', renderInspector);
  store.on('jobs', renderJobs);
  store.on('providers', renderProviderStatus);
  store.on('autosaved', () => { $('#autosave-status').textContent = `autosaved ${new Date().toLocaleTimeString()}`; });

  // ------------------------------------------------------------ project tree
  function renderTree() {
    const root = $('#project-tree');
    root.innerHTML = '';
    const p = store.project;
    if (!p.characters.length) {
      root.append(el('div', { class: 'dim small', style: 'padding:10px' }, 'No characters yet. Generate or import to begin.'));
    }
    for (const ch of p.characters) {
      const isActive = ch.id === p.activeCharacterId;
      const head = el('div', {
        class: `tree-char-head ${isActive ? 'active' : ''}`,
        tabindex: '0', role: 'button', 'aria-expanded': 'true',
      });
      head.append(
        el('span', { class: 'caret', text: '▾', 'aria-hidden': 'true' }),
        ch.masterImageId ? lazyThumb(imgStore, ch.masterImageId, { alt: '' }) : el('span', { class: 'dim', text: '◌' }),
        el('span', { class: 'tree-name', text: ch.name }),
        ch.masterImageId ? el('span', { class: 'master-flag', title: 'Master reference set', text: '★' }) : null,
        el('span', { class: 'tree-actions' },
          el('button', { class: 'icon-btn', title: 'Rename character', onClick: e => { e.stopPropagation(); const name = prompt('Character name', ch.name); if (name) store.renameCharacter(ch.id, name); } }, '✎'),
          el('button', { class: 'icon-btn', title: 'Delete character', onClick: e => { e.stopPropagation(); if (confirm(`Delete "${ch.name}" and all its animations?`)) store.removeCharacter(ch.id); } }, '🗑')),
      );
      head.addEventListener('click', () => {
        store.mutate(null, pr => { pr.activeCharacterId = ch.id; });
        store.emit('ui');
      });
      const charNode = el('div', { class: 'tree-char' }, head);
      if (isActive) {
        for (const anim of ch.animations) {
          const animRow = el('div', { class: `tree-anim ${anim.id === ch.activeAnimationId ? 'active' : ''}`, tabindex: '0', role: 'button' },
            el('span', { text: anim.name }),
            el('span', { class: 'dim small', text: anim.type }),
            el('span', { class: 'count', text: `${anim.frames.length}f` }),
            el('span', { class: 'tree-actions' },
              el('button', { class: 'icon-btn', title: 'Duplicate clip', onClick: e => { e.stopPropagation(); store.duplicateAnimation(anim.id); } }, '⧉'),
              el('button', { class: 'icon-btn', title: 'Delete clip', onClick: e => { e.stopPropagation(); if (confirm(`Delete animation "${anim.name}"?`)) store.removeAnimation(anim.id); } }, '🗑')));
          animRow.addEventListener('click', () => {
            store.mutate(null, () => { ch.activeAnimationId = anim.id; });
            store.ui.selection = { frameIds: anim.frames[0] ? [anim.frames[0].id] : [], currentIndex: 0, candidateIds: [] };
            store.emit('selection');
            store.emit('ui');
          });
          charNode.append(animRow);
        }
        charNode.append(el('div', { class: 'tree-anim', role: 'button', tabindex: '0', style: 'color:var(--dim)' },
          el('span', { text: '+ new animation' }),
        ));
        const addRow = charNode.lastChild;
        addRow.addEventListener('click', () => addAnimationDialog(ch.id));
      }
      root.append(charNode);
    }
    updateEmptyState();
  }
  store.on('project', renderTree);
  store.on('history', () => {
    $('#btn-undo').disabled = !store.past.length;
    $('#btn-redo').disabled = !store.future.length;
  });

  function updateEmptyState() {
    const empty = $('#empty-state');
    const show = store.project.characters.length === 0;
    empty.hidden = !show;
  }
  $('#empty-state').addEventListener('click', e => {
    const act = e.target.dataset?.start;
    if (act === 'generate') setStage('create');
    else if (act === 'import') startImportSprite();
    else if (act === 'sheet') { setStage('slice'); toast('Choose a sprite-sheet image to slice (SLICE stage → Open sheet image).'); }
  });

  $('#btn-add-character').addEventListener('click', () => {
    const ch = store.addCharacter();
    store.emit('ui');
    toast(`Created "${ch.name}" — describe it in CREATE, then generate candidates.`, 'ok');
  });

  async function addAnimationDialog(charId) {
    const ch = store.findChar(charId);
    dialog({
      title: 'New animation',
      width: 460,
      content: close => {
        const type = selectInput({ label: 'Animation type', options: M.ANIMATION_TYPES.map(t => ({ value: t, label: t })), value: 'walk' });
        const name = textInput({ label: 'Name', value: 'walk 1' });
        const dir = selectInput({ label: 'Facing direction', options: [...M.DIRECTIONS_8, 'none'].map(d => ({ value: d, label: d })), value: 'south' });
        const frames = numberInput({ label: 'Frame count (blueprint)', value: 8, min: 1, max: 64 });
        const fps = numberInput({ label: 'Default FPS', value: 8, min: 1, max: 60 });
        return el('div', { class: 'col' },
          type.node, name.node, el('div', { class: 'row' }, dir.node, frames.node, fps.node),
          el('p', { class: 'hint', text: 'A Motion Blueprint is created from the type template — edit poses and phases in MOTION.' }),
          el('div', { class: 'row' },
            button('Cancel', () => close(), { class: 'btn ghost' }),
            button('Create animation', () => {
              store.addAnimation(charId, { type: type.input.value, name: name.input.value || type.input.value, direction: dir.input.value, frameCount: Math.max(1, Math.min(64, frames.input.value || 8)), fps: Math.max(1, fps.input.value || 8) });
              close();
              setStage('motion');
            }, { class: 'btn' })));
      },
    });
  }
  ctx.addAnimationDialog = addAnimationDialog;

  async function startImportSprite() {
    const file = await pickFile({ accept: 'image/*' });
    if (!file) return;
    try {
      const { frames } = await importImageFile(file);
      const ch = store.addCharacter(file.name.replace(/\.[^.]+$/, ''));
      const imageId = await imgStore.putImg(frames[0].img);
      store.setMaster(ch.id, imageId, 'imported');
      const anim = store.addAnimation(ch.id, { type: 'idle', name: 'imported', frameCount: frames.length });
      const modelFrames = [];
      for (let i = 0; i < frames.length; i++) {
        const f = M.createFrame({ width: frames[i].img.width, height: frames[i].img.height, source: 'imported', name: `${file.name}_${i}` });
        f.imageId = i === 0 ? imageId : await imgStore.putImg(frames[i].img);
        f.canvasDims = { w: frames[i].img.width, h: frames[i].img.height };
        f.duration = frames[i].delayMs;
        f.versions.push(M.frameVersion(f, f.imageId, 'v1', 'import'));
        modelFrames.push(f);
      }
      store.insertFrames(anim.id, modelFrames, 0);
      toast(`Imported "${file.name}" as master + ${frames.length} frame(s).`, 'ok');
    } catch (e) { toast(e.message, 'error'); }
  }
  ctx.startImportSprite = startImportSprite;

  // ------------------------------------------------------------ topbar
  $('#project-name').addEventListener('input', e => {
    store.project.name = e.target.value;
    store.scheduleAutosave();
  });
  $('#btn-undo').addEventListener('click', () => store.undo());
  $('#btn-redo').addEventListener('click', () => store.redo());
  $('#btn-save-project').addEventListener('click', async () => {
    try { const r = await exporters.saveProject(); toast(`Project saved: ${r.name} (${r.images} images, ${(r.bytes / 1024).toFixed(0)} KB)`, 'ok'); }
    catch (e) { toast(e.message, 'error'); }
  });
  $('#btn-open-project').addEventListener('click', async () => {
    const file = await pickFile({ accept: '.spriteproject,.zip' });
    if (!file) return;
    try {
      const r = await exporters.openProject(file);
      $('#project-name').value = store.project.name;
      toast(`Project "${r.project.name}" loaded (${r.images} images).`, 'ok');
    } catch (e) { toast(e.message, 'error'); }
  });
  $('#btn-inspect').addEventListener('click', () => inspectAnimationDialog());
  $('#btn-jobs').addEventListener('click', () => { $('#jobs-drawer').hidden = !$('#jobs-drawer').hidden; renderJobs(); });

  // view toolbar
  document.querySelectorAll('[data-zoom]').forEach(b => b.addEventListener('click', () => canvasView.setZoom(Number(b.dataset.zoom) === 1 ? 1.25 : 0.8)));
  $('#btn-fit').addEventListener('click', () => canvasView.fit());
  $('#btn-100').addEventListener('click', () => { canvasView.view.zoom = 1; canvasView.view.panX = 0; canvasView.view.panY = 0; canvasView.requestRender(); });
  $('#btn-nn').addEventListener('click', e => {
    store.ui.view.nearest = !store.ui.view.nearest;
    e.currentTarget.setAttribute('aria-pressed', String(store.ui.view.nearest));
    canvasView.requestRender();
  });
  document.querySelectorAll('[data-ov]').forEach(box => {
    box.addEventListener('change', () => {
      store.ui.view.overlay[box.dataset.ov] = box.checked;
      store.emit('view');
    });
  });
  $('#onion-select').addEventListener('change', e => { store.ui.view.overlay.onion = Number(e.target.value); store.emit('view'); });
  $('#onion-opacity').addEventListener('input', e => { store.ui.view.overlay.onionOpacity = Number(e.target.value) / 100; store.emit('view'); });
  $('#bg-select').addEventListener('change', e => {
    let v = e.target.value;
    if (v.startsWith('#')) {
      const c = prompt('Custom background color (hex)', store.project.settings.customBg);
      if (c) { v = c; store.project.settings.customBg = c; }
      else return;
    }
    store.ui.view.bg = v;
    store.emit('view');
  });

  // ------------------------------------------------------------ provider + settings dialogs
  function renderProviderStatus() {
    const report = providers.capsReport;
    const active = providers.activeId && report.find(r => r.id === providers.activeId);
    const any = report.some(r => r.caps.t2i);
    $('#provider-dot').className = `dot ${any ? 'dot-on' : 'dot-off'}`;
    $('#provider-label').textContent = active ? active.name.replace(/\s*\(.*/, '') : 'No provider';
  }

  $('#btn-provider').addEventListener('click', async () => {
    await providers.refresh();
    const report = providers.capsReport;
    dialog({
      title: 'Image generation providers',
      width: 640,
      content: close => {
        const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:10px' });
        for (const r of report) {
          const c = r.caps;
          const flags = [['t2i', 'text→image'], ['i2i', 'image→image'], ['references', 'references'], ['multiReferences', 'multi-refs'], ['seed', 'seed'], ['transparency', 'alpha'], ['edit', 'edit'], ['inpaint', 'inpaint'], ['between', 'in-between'], ['cancel', 'cancel']];
          const row = el('label', { class: 'ref-row', style: 'align-items:flex-start; cursor:pointer' },
            el('input', { type: 'radio', name: 'provider', checked: providers.activeId === r.id, disabled: !c.t2i }),
            el('div', {},
              el('div', { style: 'font-weight:600' }, r.name, c.t2i ? '' : '  (unavailable)'),
              el('div', { class: 'small', style: 'margin:3px 0' },
                flags.map(([k, label]) => el('span', { class: `role-chip ${c[k] ? 'on' : ''}`, style: 'margin-right:3px', text: label }))),
              el('div', { class: 'hint', text: c.note || '' })));
          row.querySelector('input').addEventListener('change', () => providers.setActive(r.id));
          if (r.id === 'openai-direct') {
            const keyInput = textInput({ label: 'API key (session-only)', placeholder: 'sk-…', value: '' });
            keyInput.input.type = 'password';
            keyInput.input.autocomplete = 'off';
            keyInput.input.addEventListener('change', () => {
              providers.providers.find(p => p.id === 'openai-direct').setKey(keyInput.input.value.trim() || null);
              providers.refresh().then(() => { renderProviderStatus(); });
            });
            wrap.append(row, el('div', { style: 'margin-left:26px; width:85%' }, keyInput.node,
              el('p', { class: 'hint', html: 'Security note: a browser page cannot fully protect an embedded key. This key is kept in tab-session memory only (never written to project files, IndexedDB, or sent anywhere except api.openai.com). Prefer the server mode (<code>OPENAI_API_KEY</code> in <code>.env</code>) for real use.' })));
          } else wrap.append(row);
        }
        wrap.append(el('p', { class: 'hint', text: 'Capabilities are probed live. Disabled operations (e.g. patching/in-between without an edit-capable provider) are hidden or marked unavailable throughout the app — nothing here is simulated.' }));
        return wrap;
      },
      actions: [{ label: 'Done', class: 'btn' }],
    });
  });

  $('#btn-settings').addEventListener('click', () => {
    dialog({
      title: 'Settings & local data',
      width: 520,
      content: close => el('div', { style: 'display:flex;flex-direction:column;gap:10px' },
        checkInput({ label: 'Local autosave (IndexedDB)', checked: store.autosaveEnabled, onChange: v => { store.autosaveEnabled = v; if (!v) store.clearLocal(); toast(v ? 'Autosave on' : 'Autosave off — saved local snapshot removed'); } }).node,
        el('div', { class: 'row' },
          button('Clear local autosave now', async () => { await store.clearLocal(); toast('Local autosave removed.', 'ok'); }, { class: 'btn ghost' }),
          button('Purge unused cached images', async () => { await store.garbageCollect(); toast('Image cache pruned to referenced images.', 'ok'); }, { class: 'btn ghost' })),
        el('p', { class: 'hint', text: 'Images are stored in IndexedDB, not localStorage. "Save Project" produces the portable .spriteproject archive — use it for backups or moving machines.' }),
        el('p', { class: 'hint', text: `Undo history: ${store.past.length}/${50} entries.` })),
      actions: [{ label: 'Close', class: 'btn' }],
    });
  });

  // ------------------------------------------------------------ jobs drawer
  function renderJobs() {
    const drawer = $('#jobs-drawer');
    const active = store.jobs.filter(j => ['queued', 'generating', 'processing'].includes(j.status)).length;
    const badge = $('#jobs-count');
    badge.hidden = active === 0;
    badge.textContent = String(active);
    badge.parentElement.title = `Generation queue — ${active} active`;
    if (drawer.hidden) return;
    drawer.innerHTML = '';
    drawer.append(el('div', { class: 'panel-head' }, el('span', {}, `GENERATION QUEUE (${active} active / ${store.jobs.length} total)`),
      el('button', { class: 'icon-btn', 'aria-label': 'Close jobs', onClick: () => { drawer.hidden = true; } }, '✕')));
    if (!store.jobs.length) drawer.append(el('p', { class: 'dim small', text: 'No generation jobs yet.' }));
    for (const job of [...store.jobs].reverse().slice(0, 60)) {
      const row = el('div', { class: 'job-row' });
      row.append(
        el('div', { class: 'row' },
          el('span', { class: 'jlabel', text: job.label }),
          pillStatus(job.status)),
        el('div', { class: 'jmeta', text: `${job.animLabel ?? ''} · via ${job.providerId} · op ${job.op}` }),
        job.error ? el('div', { class: 'jmeta', style: 'color:var(--bad)', text: job.error }) : null,
        el('div', { class: 'job-progress' }, el('div', { style: `width:${job.status === 'complete' ? 100 : job.status === 'generating' ? 65 : 10}%` })),
        el('div', { class: 'jact' },
          ['queued', 'generating'].includes(job.status) ? button('Cancel', () => providers.cancel(job.id), { class: 'mini-btn' }) : null,
          ['failed', 'cancelled'].includes(job.status) ? button('Retry', () => providers.retry(job.id), { class: 'mini-btn' }) : null));
      drawer.append(row);
    }
  }

  function pillStatus(s) {
    const cls = { queued: 'pill-queued', generating: 'pill-generating', processing: 'pill-processing', complete: 'pill-complete', failed: 'pill-failed', cancelled: 'pill-cancelled' }[s];
    return el('span', { class: `pill ${cls}`, text: s.toUpperCase() });
  }

  // ------------------------------------------------------------ inspect animation dialog
  function inspectAnimationDialog() {
    const anim = store.activeAnim();
    if (!anim || !anim.frames.length) { toast('Select an animation with frames to inspect.', 'warn'); return; }
    const clip = {
      ...anim,
      frames: anim.frames.map(f => ({
        id: f.id, name: f.name, duration: f.duration, status: f.status,
        meta: { w: f.canvasDims?.w, h: f.canvasDims?.h },
        pivot: f.pivot, generationFailed: f.generationFailed,
      })),
    };
    const ch = store.activeChar();
    const palette = ch?.palette.locked ? ch.palette.colors : null;
    const report = inspectClip(clip, f => {
      const found = store.findFrame(f.id);
      if (!found?.frame.imageId) throw new Error('missing');
      return compositeForQa(found.frame);
    }, { palette });
    const rows = [
      ['Frames', report.frameCount],
      ['Total duration', `${(report.durationMs / 1000).toFixed(2)}s at per-frame timing`],
      ['Loop', report.loopMs != null ? `${(report.loopMs / 1000).toFixed(2)}s (${anim.loopMode})` : `one-shot`],
      ['Canvas dimensions', report.dimensions],
      ['Default FPS', report.fps],
      ['Approved / draft / rejected', `${anim.frames.filter(f => f.status === 'approved').length} / ${anim.frames.filter(f => f.status === 'draft').length} / ${anim.frames.filter(f => f.status === 'rejected').length}`],
      ['Failed generations', report.failedGenerations],
      ['Warnings', report.warnings.length ? `${report.warnings.length} (see list)` : 'none'],
    ];
    dialog({
      title: `Inspect: ${anim.name}`,
      width: 620,
      content: () => el('div', { style: 'display:flex;flex-direction:column;gap:8px' },
        el('table', { class: 'lineage-table' }, rows.map(([k, v]) => el('tr', {}, el('td', { text: k }), el('td', { text: String(v) })))),
        report.warnings.length
          ? el('div', { style: 'display:flex;flex-direction:column;gap:4px;max-height:300px;overflow:auto' },
              report.warnings.map(w => el('div', {
                class: 'qa-item', onClick: () => {
                  const found = store.findFrame(w.frameId);
                  if (found) { store.ui.selection = { frameIds: [w.frameId], currentIndex: found.index, candidateIds: [] }; store.emit('selection'); }
                },
              },
                el('span', { class: `q-sev sev-${w.severity}`, text: w.severity === 'warn' ? '⚠' : 'ℹ' }),
                el('span', { class: 'q-msg', text: w.message }))))
          : el('p', { class: 'hint', text: 'No deterministic continuity warnings. These checks measure pixel facts (bounds, palette, duplicates, baselines) — eyeball the result yourself before shipping.' })),
      actions: [{ label: 'Close', class: 'btn' }],
    });
    function compositeForQa(frame) {
      const target = imgStore.getImg(frame.imageId);
      return target;
    }
  }

  // ------------------------------------------------------------ drag & drop + paste
  window.addEventListener('dragover', e => { e.preventDefault(); });
  window.addEventListener('drop', async e => {
    e.preventDefault();
    const files = [...(e.dataTransfer?.files ?? [])].filter(f => f.type.startsWith('image/'));
    if (!files.length) return;
    if (store.ui.stage === 'slice') { stages.slice.importFiles(files); }
    else {
      for (const f of files) {
        try {
          const { frames } = await importImageFile(f);
          const ch = store.activeChar() ?? store.addCharacter(f.name.replace(/\.[^.]+$/, ''));
          if (frames.length > 1) {
            const anim = store.addAnimation(ch.id, { type: 'custom', name: f.name.replace(/\.[^.]+$/, ''), frameCount: frames.length });
            const list = [];
            for (let i = 0; i < frames.length; i++) {
              const mf = M.createFrame({ width: frames[i].img.width, height: frames[i].img.height, source: 'imported', name: `${f.name}_${i}` });
              mf.imageId = await imgStore.putImg(frames[i].img);
              mf.duration = frames[i].delayMs;
              mf.versions.push(M.frameVersion(mf, mf.imageId, 'v1', 'import'));
              list.push(mf);
            }
            store.insertFrames(anim.id, list, 0);
            toast(`Imported ${frames.length} frames from ${f.name} into new animation.`, 'ok');
          } else {
            const imageId = await imgStore.putImg(frames[0].img);
            store.addCandidate(ch.id, { id: M.uid('cand'), imageId, prompt: null, spec: null, rejected: false, createdAt: Date.now(), lineage: { provider: 'local-import', operation: 'import', prompt: null, createdAt: Date.now() } });
            toast(`Added ${f.name} to ${ch.name}'s candidate tray (CREATE stage).`, 'ok');
            setStage('create');
          }
        } catch (err) { toast(err.message, 'error'); }
      }
    }
  });
  window.addEventListener('paste', async e => {
    if (!store.ui.stage.includes('slice')) return;
    const item = [...(e.clipboardData?.items ?? [])].find(i => i.type.startsWith('image/'));
    if (item) {
      const file = item.getAsFile();
      if (file) stages.slice.importFiles([file]);
    }
  });

  // ------------------------------------------------------------ keyboard
  window.addEventListener('keydown', e => {
    const t = e.target;
    const typing = t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || t.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) {
      e.preventDefault();
      e.shiftKey ? store.redo() : store.undo();
      return;
    }
    if (typing) return;
    switch (e.key) {
      case ' ': e.preventDefault(); timeline.togglePlay(); break;
      case 'ArrowLeft': timeline.step(-1); break;
      case 'ArrowRight': timeline.step(1); break;
      case 'Home': timeline.seek(0); break;
      case 'End': timeline.seek((store.activeAnim()?.frames.length ?? 1) - 1); break;
      case 'Delete': case 'Backspace': {
        const anim = store.activeAnim();
        const ids = store.ui.selection.frameIds;
        if (anim && ids.length) {
          if (ids.length > 2 && !confirm(`Delete ${ids.length} selected frames?`)) return;
          store.removeFrames(anim.id, ids);
          store.ui.selection.currentIndex = Math.min(store.ui.selection.currentIndex, anim.frames.length - 1);
          store.emit('selection');
        }
        break;
      }
      case '+': case '=': canvasView.setZoom(1.25); break;
      case '-': canvasView.setZoom(0.8); break;
      case '0': canvasView.fit(); break;
      case '1': canvasView.view.zoom = 1; canvasView.view.panX = 0; canvasView.view.panY = 0; canvasView.requestRender(); break;
    }
  });

  // ------------------------------------------------------------ provider boot + autosave restore
  const saved = await store.loadLocalAutosave();
  if (saved?.project?.characters?.length) {
    try {
      manifestFromJson({ format: 'sprite-foundry-project', manifestVersion: 1, project: saved.project });
      store.loadProject(saved.project);
      $('#project-name').value = saved.project.name || 'Untitled Project';
      // images load lazily from IDB via ensure()
      setTimeout(() => {
        store.garbageCollect();
        for (const ch of store.project.characters) if (ch.masterImageId) imgStore.ensure(ch.masterImageId).catch(() => {});
      }, 300);
      toast('Restored previous session from local autosave.', 'ok');
    } catch (e) {
      console.warn('autosave invalid', e);
      toast('Local autosave was invalid and has been ignored. Start a new project or open a .spriteproject file.', 'warn');
    }
  } else {
    // fresh install: create an empty character so panels hook up immediately
    store.addCharacter('Character 1');
  }

  renderTree();
  renderProviderStatus();
  setStage('create');
  providers.refresh().then(renderProviderStatus);
  // announce readiness for screen readers
  $('#sr-status').textContent = 'Sprite Foundry ready.';
}

boot().catch(e => {
  console.error(e);
  document.body.append(el('pre', { style: 'color:#ff5d5d;padding:20px;white-space:pre-wrap' }, `Boot failed: ${e.stack || e.message}`));
});
