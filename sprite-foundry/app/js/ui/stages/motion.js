// stages/motion.js — MOTION stage: Motion Blueprint, keyframe-first
// generation, pose/skeleton mode, directional sets, in-between generation.
import { el, $, toast, dialog, field, textInput, numberInput, selectInput, checkInput, button, section } from '../components.js';
import * as M from '../../lib/model.js';
import { defaultBlueprint, keyframeIndices, genomeAsymmetryWarning, MIRROR_PAIRS } from '../../lib/model.js';
import { poseSequence, poseFor } from '../../lib/skeleton.js';
import { flipHorizontal } from '../../lib/img.js';
import { blobToImgData } from '../../browser.js';

export class MotionStage {
  constructor(ctx) {
    this.ctx = ctx;
    this.genSpec = { width: 256, height: 256, seed: -1, styleId: 'pixel-art', customStylePrompt: '', background: 'white' };
  }

  get ch() { return this.ctx.store.activeChar(); }
  get anim() { return this.ctx.store.activeAnim(); }

  activate() { this.renderSkeletonState(); }
  deactivate() {
    this.ctx.store.ui.poseEdit = null;
    this.ctx.store.ui.view.tool = 'pan';
  }

  render(root) {
    const { store } = this.ctx;
    root.innerHTML = '';
    const ch = this.ch;
    if (!ch) { root.append(el('p', { class: 'dim', text: 'Add a character first.' })); return; }
    if (!ch.masterImageId) {
      root.append(el('p', { class: 'hint', style: 'color:var(--warn)', text: '⚠ Set a Master Reference in CREATE before directing motion — master identity is the authority for every generated frame.' }));
    }
    const anim = this.anim;
    root.append(this.animPicker());
    if (!anim) {
      root.append(section('MOTION BLUEPRINT', el('p', { class: 'hint', text: 'Create an animation (project panel → ＋ new animation) to direct motion.' })));
      return;
    }
    root.append(
      this.blueprintEditor(anim),
      this.poseSection(anim),
      this.generateSection(anim),
      this.betweenSection(anim),
      this.directionSection(anim));
  }

  // ---------------------------------------------------------------- animation picker

  animPicker() {
    const { store } = this.ctx;
    const ch = this.ch;
    const sel = el('select', { 'aria-label': 'Active animation' },
      ch.animations.map(a => el('option', { value: a.id, text: `${a.name} (${a.type} · ${a.direction} · ${a.frames.length}f)`, selected: a.id === ch.activeAnimationId })));
    sel.addEventListener('change', () => {
      store.mutate(null, () => { ch.activeAnimationId = sel.value; });
      store.ui.selection = { frameIds: [], currentIndex: 0, candidateIds: [] };
      store.emit('selection');
      this.ctx.setStage('motion');
    });
    const row = el('div', { class: 'row' }, sel,
      button('＋ New', () => this.ctx.addAnimationDialog(ch.id), { class: 'mini-btn' }));
    return section('ANIMATION', row);
  }

  // ---------------------------------------------------------------- blueprint

  blueprintEditor(anim) {
    const { store } = this.ctx;
    const bp = anim.blueprint ?? defaultBlueprint(anim.type, anim.frames.length || 8);
    if (!anim.blueprint) anim.blueprint = bp;
    const upd = (patch, label = 'edit blueprint') => store.updateAnim(anim.id, { blueprint: { ...anim.blueprint, ...patch } }, label);
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:7px' });
    wrap.append(
      textInput({ label: 'Animation description', value: bp.description, placeholder: 'e.g. determined walk with a slight lantern sway', onChange: v => upd({ description: v }) }).node,
      el('div', { class: 'row' },
        numberInput({ label: 'Frames', value: bp.frameCount, min: 2, max: 64, onChange: v => upd({ frameCount: Math.max(2, Math.min(64, v)) }) }).node,
        selectInput({ label: 'Loop mode', options: [{ value: 'loop', label: 'loop' }, { value: 'once', label: 'once' }, { value: 'pingpong', label: 'ping-pong' }], value: anim.loopMode, onChange: v => store.updateAnim(anim.id, { loopMode: v }) }).node),
      textInput({ label: 'Contact points / constraints', value: bp.contactPoints, placeholder: 'e.g. foot contact on frames 1 and 5', onChange: v => upd({ contactPoints: v }) }).node,
      textInput({ label: 'Motion emphasis', value: bp.emphasis, placeholder: 'e.g. heavy stomps, cape follows late', onChange: v => upd({ emphasis: v }) }).node,
      el('div', { class: 'row' },
        textInput({ label: 'Starting pose', value: bp.startPose, onChange: v => upd({ startPose: v }) }).node,
        textInput({ label: 'Ending pose', value: bp.endPose, onChange: v => upd({ endPose: v }) }).node),
      el('div', { class: 'row' },
        checkInput({ label: 'Anticipation (frame 1)', checked: bp.anticipation, onChange: v => upd({ anticipation: v }) }).node,
        checkInput({ label: 'Follow-through (last frame)', checked: bp.followThrough, onChange: v => upd({ followThrough: v }) }).node));
    // key poses table
    const poses = el('div', { style: 'display:flex;flex-direction:column;gap:3px' });
    for (let i = 0; i < bp.frameCount; i++) {
      const idx = i;
      const isKey = keyframeIndices(bp).includes(idx);
      const kp = anim.blueprint.keyPoses[idx] ?? { index: idx, description: '' };
      while (anim.blueprint.keyPoses.length < bp.frameCount) anim.blueprint.keyPoses.push({ index: anim.blueprint.keyPoses.length, description: `pose ${anim.blueprint.keyPoses.length + 1}` });
      const input = el('input', { type: 'text', value: kp.description, 'aria-label': `Pose for frame ${idx + 1}` });
      input.addEventListener('change', () => {
        store.mutate('edit key pose', () => { anim.blueprint.keyPoses[idx] = { index: idx, description: input.value }; });
      });
      poses.append(el('div', { class: 'row', style: 'gap:4px' },
        el('span', { class: 'small', style: `width:44px;color:${isKey ? 'var(--teal)' : 'var(--dim)'}`, text: `${isKey ? '◆' : '·'} f${idx + 1}` }),
        input));
    }
    wrap.append(section('KEY POSES (◆ = generated first)', poses));
    return section('MOTION BLUEPRINT', wrap);
  }

  // ---------------------------------------------------------------- pose / skeleton

  poseSection(anim) {
    const { store } = this.ctx;
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:7px' });
    const hasPoseSupport = false; // provider-side skeletal conditioning is NOT assumed
    wrap.append(el('p', { class: 'hint', text: 'Pose guides are editable stick-figure keyframes. Current providers do not accept skeletal conditioning directly, so poses are preserved as generation context (rendered into prompts as pose descriptions) and drawn as guides on the canvas — never presented as direct conditioning.' }));
    const seq = anim.poseSequence ?? null;
    if (!seq) {
      wrap.append(button('GENERATE POSE SEQUENCE', () => {
        store.mutate('pose sequence', () => {
          anim.poseSequence = poseSequence(anim.type, anim.blueprint?.frameCount ?? anim.frames.length ?? 8);
        });
        toast(`Pose sequence template created for "${anim.type}" — edit poses on the canvas.`);
      }, { class: 'btn' }));
      wrap.append(el('p', { class: 'hint', text: 'Uses a deterministic humanoid template for the animation type as a starting point for hand-edited posing.' }));
    } else {
      const idx = Math.min(store.ui.selection.currentIndex, seq.length - 1);
      wrap.append(
        el('div', { class: 'row' },
          el('span', { class: 'small', text: `poses: ${seq.length} · editing frame ${idx + 1}` }),
          button('Edit pose on canvas', () => this.startPoseEdit(anim, idx), { class: 'mini-btn' }),
          button('Template again', () => store.mutate('pose sequence', () => { anim.poseSequence = poseSequence(anim.type, seq.length); }), { class: 'mini-btn' }),
          button('Clear poses', () => store.mutate('pose sequence', () => { delete anim.poseSequence; store.ui.poseEdit = null; }), { class: 'mini-btn' })),
        el('p', { class: 'hint', text: 'Drag joints on the canvas. A teal skeleton overlays the current frame.' }));
      if (store.ui.poseEdit) this.attachPoseDrag(anim);
    }
    return section('POSE / SKELETON', wrap);
  }

  startPoseEdit(anim, idx) {
    const { store, canvasView } = this.ctx;
    const joints = JSON.parse(JSON.stringify(anim.poseSequence[idx]));
    const ch = this.ch;
    store.ui.poseEdit = { animId: anim.id, index: idx, joints, unitPx: (anim.frames[0]?.canvasDims?.h ?? ch.spriteDefaults?.h ?? 64) / 2.6 };
    store.ui.view.tool = 'skeleton';
    canvasView.toolHandler = this.poseTool(anim);
    canvasView.requestRender();
  }

  poseTool(anim) {
    const { store, canvasView } = this.ctx;
    let dragging = null;
    return {
      down: (pt) => {
        const pose = store.ui.poseEdit;
        if (!pose) return null;
        const px = canvasView.posePx;
        if (!px) return null;
        let best = null, bestD = 14 / (canvasView.view.zoom || 1);
        for (const [j, p] of Object.entries(px)) {
          const dx = p.x - (canvasView.topLeft.x + pt.x * canvasView.view.zoom);
          const dy = p.y - (canvasView.topLeft.y + pt.y * canvasView.view.zoom);
          const d = Math.hypot(dx, dy) / (canvasView.view.zoom || 1);
          if (d < bestD) { bestD = d; best = j; }
        }
        if (!best) return null;
        dragging = { kind: 'joint', joint: best };
        return dragging;
      },
      move: (drag, pt) => {
        const pose = store.ui.poseEdit;
        if (!pose || !drag.joint) return;
        const size = canvasView.contentSize();
        const groundY = (anim.groundY ?? 0.92) * size.h;
        const unitPx = pose.unitPx;
        pose.joints[drag.joint] = { x: (pt.x - size.w / 2) / unitPx, y: (pt.y - groundY) / unitPx };
        canvasView.requestRender();
      },
      up: () => {
        const pose = store.ui.poseEdit;
        if (!pose) return;
        store.mutate('edit pose', () => {
          if (!anim.poseSequence) anim.poseSequence = [];
          anim.poseSequence[pose.index] = pose.joints;
        });
        store.emit('view');
      },
      hover: () => 'grab',
    };
  }

  /* keep pose overlay bound to selection changes */
  renderSkeletonState() { /* pose overlay renders via canvasView when ui.poseEdit set */ }

  attachPoseDrag() { /* handled through poseTool on startPoseEdit */ }

  // ---------------------------------------------------------------- generation

  generateSection(anim) {
    const { store, genops, providers } = this.ctx;
    const ch = this.ch;
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:7px' });
    const g = this.genSpec;
    wrap.append(
      el('div', { class: 'row' },
        numberInput({ label: 'Width', value: g.width, min: 64, max: 1280, step: 64, onChange: v => g.width = v }).node,
        numberInput({ label: 'Height', value: g.height, min: 64, max: 1280, step: 64, onChange: v => g.height = v }).node,
        numberInput({ label: 'Seed (−1 random)', value: g.seed, min: -1, onChange: v => g.seed = v }).node),
      selectInput({ label: 'Style', options: [{ value: 'pixel-art', label: 'Pixel Art' }, { value: 'clean-2d', label: 'Clean 2D' }, { value: 'cel', label: 'Cel-shaded' }, { value: 'custom', label: 'Custom' }], value: g.styleId, onChange: v => g.styleId = v }).node,
      g.styleId === 'custom' ? textInput({ label: 'Custom style prompt', value: g.customStylePrompt, onChange: v => g.customStylePrompt = v }).node : null,
      el('div', { class: 'btn-group' },
        button(`1 · GENERATE KEYFRAMES (${keyframeIndices(anim.blueprint ?? { frameCount: anim.frames.length || 8 }).length})`, async () => {
          try {
            const caps = await providers.caps(providers.activeId);
            if (!caps?.t2i) throw new Error('No usable generation provider (open the provider dialog).');
            await genops.generateKeyframes(ch.id, anim.id, g);
            toast('Keyframe jobs queued. Key poses land in the timeline as they complete — inspect and approve them BEFORE generating the rest.', 'ok', 7000);
          } catch (e) { toast(e.message, 'error'); }
        }, { class: 'btn' }),
        button('2 · GENERATE REMAINING FRAMES', async () => {
          try {
            const caps = await providers.caps(providers.activeId);
            if (!caps?.t2i) throw new Error('No usable generation provider.');
            await genops.generateRemaining(ch.id, anim.id, g);
            toast('Bridge-frame jobs queued — each is conditioned on the blueprint, the genome and neighbouring frames where the provider supports references.', 'ok', 6000);
          } catch (e) { toast(e.message, 'error'); }
        }, { class: 'btn ghost' })),
      el('p', { class: 'hint', text: 'Keyframe-first: spend a few calls validating key poses before filling the gap. Master stays authoritative — defective frames are repaired individually in FRAMES, never by rerolling the whole set.' }));
    return section('GENERATE MOTION', wrap);
  }

  // ---------------------------------------------------------------- in-between

  betweenSection(anim) {
    const { store, genops, providers } = this.ctx;
    const ch = this.ch;
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:7px' });
    const opts = anim.frames.map((f, i) => ({ value: f.id, label: `frame ${i + 1} ${f.name ?? ''}`.trim() }));
    if (anim.frames.length < 2) {
      wrap.append(el('p', { class: 'hint', text: 'Need at least two frames in the clip.' }));
      return section('AI IN-BETWEENING', wrap);
    }
    const selA = selectInput({ label: 'Frame A (earlier)', options: opts, value: opts[0].value });
    const selB = selectInput({ label: 'Frame B (later)', options: opts, value: opts[Math.min(opts.length - 1, 2)].value });
    const count = numberInput({ label: 'In-between frames', value: 2, min: 1, max: 6 });
    const statusEl = el('p', { class: 'hint', text: 'Checking provider in-between capability…' });
    const goBtn = button('GENERATE BETWEEN', async () => {
      goBtn.disabled = true;
      try {
        await genops.generateBetween(ch.id, anim.id, selA.input.value, selB.input.value, Math.max(1, Math.min(6, count.input.value || 1)));
        toast('In-between job(s) queued — endpoints will be left untouched and both parents recorded in lineage.', 'ok');
      } catch (e) { toast(e.message, 'error'); }
      finally { goBtn.disabled = false; }
    }, { class: 'btn' });
    providers.caps(providers.activeId).then(caps => {
      const ok = caps.between || caps.references;
      goBtn.disabled = !ok;
      statusEl.textContent = ok
        ? 'Provider accepts multiple references — endpoints + master frame condition the bridge frames.'
        : 'Active provider cannot condition on existing frames → true in-betweening unavailable (not simulated). Switch provider, or fix poses manually.';
      statusEl.style.color = ok ? 'var(--ok)' : 'var(--warn)';
    });
    wrap.append(selA.node, selB.node, count.node, statusEl, goBtn);
    return section('AI IN-BETWEENING', wrap);
  }

  // ---------------------------------------------------------------- directional sets

  directionSection(anim) {
    const { store } = this.ctx;
    const ch = this.ch;
    const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:7px' });
    const dirs = new Set(ch.animations.filter(a => a.type === anim.type).map(a => a.direction));
    wrap.append(
      el('p', { class: 'small', text: `Directions of "${anim.type}": ${[...dirs].join(', ') || 'none'}` }),
      el('div', { class: 'row' },
        selectInput({ label: 'Set size', options: [{ value: '1', label: '1 direction' }, { value: '2', label: '2 directions' }, { value: '4', label: '4 directions' }, { value: '8', label: '8 directions' }], value: '4', onChange: () => {} }).node),
      (() => {
        const sel = wrap.querySelector('select');
        return el('div', { class: 'btn-group' },
          button('GENERATE MIRRORED DIRECTIONS', async () => {
            const n = Number(sel.value);
            await this.mirrorDirections(anim, n);
          }, { class: 'btn ghost', title: 'Mirror existing frames into new directional clips (pixel flip)' }));
      })(),
      el('p', { class: 'hint', text: 'Mirroring is a real pixel flip: correct only for symmetric characters. The app checks the genome and warns about side-specific features — review mirrored clips before approving.' }));
    return section('DIRECTIONAL SET', wrap);
  }

  async mirrorDirections(anim, count) {
    const { store, imgStore } = this.ctx;
    const ch = this.ch;
    if (!anim.frames.length) { toast('Nothing to mirror — generate frames first.', 'warn'); return; }
    const sets = { 2: ['west', 'east'], 4: M.DIRECTIONS_4, 8: M.DIRECTIONS_8 };
    const wanted = sets[count] ?? M.DIRECTIONS_4;
    const have = new Set(ch.animations.filter(a => a.type === anim.type).map(a => a.direction));
    const mirrorable = wanted.filter(d => MIRROR_PAIRS[d] && have.has(MIRROR_PAIRS[d]) && !have.has(d));
    if (!mirrorable.length) {
      toast(`No mirrorable directions: need an existing opposite (e.g. for east you must have west). Existing: ${[...have].join(', ')}`, 'warn');
      return;
    }
    const warn = genomeAsymmetryWarning(ch.genome);
    if (warn && !confirm(`⚠ Mirror warning\n\n${warn}\n\nProceed with mirrored directions anyway?`)) return;
    for (const dir of mirrorable) {
      const src = ch.animations.find(a => a.type === anim.type && a.direction === MIRROR_PAIRS[dir]);
      if (!src) continue;
      const newAnim = M.createAnimation(src.name.replace(MIRROR_PAIRS[dir], dir), src.type, dir);
      newAnim.loopMode = src.loopMode;
      newAnim.defaultFPS = src.defaultFPS;
      newAnim.blueprint = src.blueprint ? JSON.parse(JSON.stringify(src.blueprint)) : null;
      const frames = [];
      for (const [i, f] of src.frames.entries()) {
        let imageId = null;
        if (f.imageId) {
          const img = imgStore.getImg(f.imageId);
          imageId = await imgStore.putImg(flipHorizontal(img));
        }
        const nf = M.createFrame({ width: f.canvasDims.w, height: f.canvasDims.h, source: 'mirrored', name: f.name.replace(MIRROR_PAIRS[dir], dir) });
        nf.imageId = imageId;
        nf.canvasDims = { ...f.canvasDims };
        nf.sourceDims = { ...f.sourceDims };
        nf.duration = f.duration;
        nf.pivot = { x: 1 - f.pivot.x, y: f.pivot.y };
        nf.points = (f.points ?? []).map(p => ({ ...p, x: 1 - p.x }));
        nf.boxes = (f.boxes ?? []).map(b => ({ ...b, id: M.uid('box'), x: 1 - b.x - b.w }));
        nf.offset = { x: -(f.offset?.x ?? 0), y: f.offset?.y ?? 0 };
        nf.status = 'draft';
        nf.lineage = { provider: 'local-transform', operation: 'mirror', parentFrames: [f.id], createdAt: Date.now(), prompt: null };
        nf.versions.push(M.frameVersion(nf, imageId, 'v1', 'mirror'));
        frames.push(nf);
      }
      newAnim.frames = frames;
      store.mutate(`mirror ${MIRROR_PAIRS[dir]}→${dir}`, () => {
        ch.animations.push(newAnim);
        ch.activeAnimationId = newAnim.id;
      });
    }
    toast(`Mirrored into: ${mirrorable.join(', ')} — review for asymmetric features before approving.`, 'warn', 7000);
    store.emit('ui');
  }
}
