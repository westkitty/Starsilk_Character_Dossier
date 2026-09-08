// genops.js — generation orchestration: candidates, keyframe-first animation,
// in-betweens, frame repair/variation, lineage recording. Every job flows
// through the provider queue; every result lands in the model with
// destination-id guards so late async responses can't clobber newer edits.
import * as M from './lib/model.js';
import { buildCharacterPrompt, buildFramePrompt, buildBetweenPrompt } from './lib/prompt.js';
import { blobToImgData } from './browser.js';

export class GenOps {
  constructor(store, registry) {
    this.store = store;
    this.registry = registry;
  }

  providerId() { return this.registry.activeId; }

  // ---------------------------------------------------------------- character candidates

  async generateCandidates(charId, createSpec, count = 1) {
    const char = this.store.findChar(charId);
    if (!char) throw new Error('No character selected');
    const { prompt, negative } = buildCharacterPrompt({ ...createSpec, genome: char.genome });
    for (let i = 0; i < count; i++) {
      const seed = createSpec.seed >= 0 ? createSpec.seed + i : -1;
      const spec = { prompt, negative, width: createSpec.width, height: createSpec.height, seed, background: createSpec.background === 'transparent-request' ? 'transparent' : undefined };
      this.registry.enqueue({
        label: `Candidate ${char.candidates.length + i + 1}`,
        op: 'generate',
        providerId: this.providerId(),
        spec,
        animLabel: char.name,
        onDone: async (result, job) => {
          const img = await blobToImgData(result.blob);
          const imageId = await this.store.imgStore.putImg(img);
          // stale guard: character may be gone
          if (!this.store.findChar(charId)) return;
          this.store.addCandidate(charId, {
            id: M.uid('cand'), imageId, prompt, negative,
            seed: spec.seed, spec: snapshotSpec(createSpec),
            rejected: false, createdAt: Date.now(),
            lineage: {
              provider: result.meta.provider, model: result.meta.model ?? null, operation: 'character-candidate',
              prompt, negativePrompt: negative, seed: spec.seed >= 0 ? spec.seed : null,
              references: char.references.filter(r => r.roles.includes('identity') || r.roles.includes('style')).map(r => r.imageId),
              parentFrames: [], createdAt: Date.now(),
              requestedDims: { w: createSpec.width, h: createSpec.height },
              resultDims: { w: img.width, h: img.height },
              jobId: job.id,
            },
          });
        },
      });
    }
  }

  varyCandidate(charId, candId) {
    const char = this.store.findChar(charId);
    const cand = char?.candidates.find(c => c.id === candId);
    if (!cand) return;
    const spec = { ...cand.spec, seed: (cand.seed ?? 0) + 1 + Math.floor(Math.random() * 9999) };
    if (this.providerId() === 'pollinations' && spec.seed < 0) spec.seed = Math.floor(Math.random() * 1e6);
    return this.generateCandidates(charId, spec, 1);
  }

  regenerateCandidate(charId, candId) {
    const char = this.store.findChar(charId);
    const cand = char?.candidates.find(c => c.id === candId);
    if (!cand) return;
    return this.generateCandidates(charId, { ...cand.spec, seed: -1 }, 1);
  }

  // ---------------------------------------------------------------- animation (keyframe-first)

  /**
   * Generate keyframes only (indices from keyframeIndices()), in place on an
   * FRAME_SLOT list: anim.motionGen = { slots: [{index, frameId|null}] }.
   * Slots holding real frames already (approved) are skipped unless force.
   */
  async generateKeyframes(charId, animId, genSpec) {
    const char = this.store.findChar(charId);
    const anim = char?.animations.find(a => a.id === animId);
    if (!char?.masterImageId) throw new Error('Set a Master Reference before generating motion — master identity is authoritative');
    if (!anim) throw new Error('No animation');
    const bp = anim.blueprint;
    const keys = M.keyframeIndices(bp);
    await this.genFrameIndices(char, anim, keys, genSpec, 'keyframe');
  }

  /** Generate the remaining (bridge) frames sequentially, conditioned on neighbours. */
  async generateRemaining(charId, animId, genSpec) {
    const char = this.store.findChar(charId);
    const anim = char?.animations.find(a => a.id === animId);
    const bp = anim?.blueprint;
    if (!bp) throw new Error('Animation has no blueprint');
    const missing = anim.frames.map((f, i) => ({ f, i })).filter(x => !x.f.imageId || x.f.status === 'rejected').map(x => x.i);
    const todo = missing.length ? missing : [...Array(bp.frameCount).keys()].filter(i => !anim.frames[i]);
    if (!todo.length) throw new Error('Nothing left to generate — all blueprint frames exist');
    await this.genFrameIndices(char, anim, todo, genSpec, 'frame');
  }

  async genFrameIndices(char, anim, indices, genSpec, kind) {
    const bp = anim.blueprint;
    const palette = char.palette.locked ? char.palette.colors : null;
    for (const index of indices) {
      const { prompt, negative } = buildFramePrompt({
        characterDesc: M.genomeFragments?.length ? undefined : undefined,
        genome: char.genome,
        blueprint: bp, frameIndex: index, totalFrames: bp.frameCount,
        direction: anim.direction, styleId: genSpec.styleId, customStylePrompt: genSpec.customStylePrompt,
        palette, background: genSpec.background,
      });
      const prevIdx = index - 1, nextIdx = index + 1;
      const prevFrame = anim.frames[prevIdx], nextFrame = anim.frames[nextIdx];
      const lineage = {
        provider: null, model: null, operation: kind === 'keyframe' ? 'keyframe' : 'animation-frame',
        prompt, negativePrompt: negative, seed: genSpec.seed >= 0 ? genSpec.seed + index : null,
        masterReference: char.masterImageId,
        references: [], parentFrames: [],
        createdAt: null, requestedDims: { w: genSpec.width, h: genSpec.height }, resultDims: null, jobId: null,
        motionBlueprint: { description: bp.description, keyPose: bp.keyPoses[index]?.description },
      };
      this.registry.enqueue({
        label: `${anim.name} — frame ${index + 1}/${bp.frameCount}`,
        op: 'generate',
        providerId: this.providerId(),
        spec: { prompt, negative, width: genSpec.width, height: genSpec.height, seed: lineage.seed ?? -1, refs: await this.refFiles(char, prevFrame, nextFrame, kind), background: genSpec.background === 'transparent-request' ? 'transparent' : undefined },
        animLabel: `${char.name} · ${anim.name} (${anim.direction})`,
        destId: animId,
        onDone: async (result, job) => {
          if (!this.store.findAnim(animId)) return; // stale guard
          const img = await blobToImgData(result.blob);
          const imageId = await this.store.imgStore.putImg(img);
          lineage.provider = result.meta.provider; lineage.model = result.meta.model ?? null;
          lineage.createdAt = Date.now(); lineage.jobId = job.id;
          lineage.resultDims = { w: img.width, h: img.height };
          this.store.mutate(null, () => {
            const found = this.store.findAnim(animId);
            if (!found) return;
            const a = found.anim;
            let frame = a.frames[index];
            if (!frame) {
              frame = M.createFrame({ width: img.width, height: img.height, source: 'generated', name: `${a.name}_${String(index + 1).padStart(2, '0')}` });
              frame.duration = Math.round(1000 / (a.defaultFPS || 8));
              frame.versions.push(M.frameVersion(frame, imageId, 'v1', kind));
              frame.imageId = imageId;
              frame.lineage = lineage;
              frame.canvasDims = { w: img.width, h: img.height };
              while (a.frames.length < index) a.frames.push(null);
              if (a.frames.length === index) a.frames.push(frame);
              else a.frames[index] = frame;
              a.frames = a.frames.filter(Boolean);
            } else {
              frame.versions.push(M.frameVersion(frame, frame.imageId, `v${frame.versions.length + 1}`, 'previous'));
              frame.versions.push(M.frameVersion(frame, imageId, `v${frame.versions.length + 1}`, kind));
              frame.imageId = imageId;
              frame.lineage = lineage;
            }
          });
        },
      });
    }
  }

  /** Reference files for conditioning when the provider supports multi-image edits. */
  async refFiles(char, prevFrame, nextFrame, kind) {
    const caps = await this.registry.caps(this.providerId());
    if (!caps.references) return undefined;
    const files = [];
    const ids = [char.masterImageId];
    if (kind === 'frame') {
      if (prevFrame?.imageId && prevFrame.status !== 'rejected') ids.push(prevFrame.imageId);
      if (nextFrame?.imageId && nextFrame.status !== 'rejected') ids.push(nextFrame.imageId);
    }
    for (const id of [...new Set(ids)].filter(Boolean)) {
      const blob = await this.store.imgStore.getBlob(id);
      if (blob) files.push(new File([blob], `${id}.png`, { type: 'image/png' }));
    }
    return files.length ? files : undefined;
  }

  // ---------------------------------------------------------------- in-between

  async generateBetween(charId, animId, frameAId, frameBId, count = 1) {
    const caps = await this.registry.caps(this.providerId());
    if (!caps.between && !caps.references) {
      throw new Error('The active provider cannot condition on reference frames, so true in-betweening is unavailable with it. Switch to an OpenAI provider or add frames by hand.');
    }
    const char = this.store.findChar(charId);
    const found = this.store.findAnim(animId);
    const anim = found?.anim;
    const idxA = anim.frames.findIndex(f => f.id === frameAId);
    const idxB = anim.frames.findIndex(f => f.id === frameBId);
    if (idxA < 0 || idxB < 0 || idxB - idxA < 1) throw new Error('Frame A must come before Frame B');
    const a = anim.frames[idxA], b = anim.frames[idxB];
    const bp = anim.blueprint ?? { frameCount: anim.frames.length, keyPoses: [], loop: anim.loopMode === 'loop', description: `${anim.type} animation` };
    const palette = char.palette.locked ? char.palette.colors : null;
    const poseA = bp.keyPoses?.[idxA]?.description ?? `pose ${idxA + 1}`;
    const poseB = bp.keyPoses?.[idxB]?.description ?? `pose ${idxB + 1}`;
    const totalGap = count + 1;
    for (let k = 1; k <= count; k++) {
      const t = k / totalGap;
      const { prompt, negative } = buildBetweenPrompt({
        genome: char.genome, blueprint: bp,
        frameIndex: Math.min(bp.frameCount - 1, idxA + k), totalFrames: bp.frameCount,
        direction: anim.direction, palette, t, poseA, poseB,
      });
      const lineage = {
        provider: null, model: null, operation: 'in-between',
        prompt, negativePrompt: negative, seed: null,
        masterReference: char.masterImageId,
        references: [a.imageId, b.imageId], parentFrames: [a.id, b.id],
        createdAt: null, requestedDims: { w: a.canvasDims.w, h: a.canvasDims.h }, resultDims: null, jobId: null,
      };
      this.registry.enqueue({
        label: `${anim.name} — between ${idxA + 1}↔${idxB + 1} (${k}/${count})`,
        op: caps.between ? 'between' : 'edit',
        providerId: this.providerId(),
        spec: { prompt, negative, refs: await this.allRefFiles(char, [a.imageId, b.imageId]), width: a.canvasDims.w, height: a.canvasDims.h },
        animLabel: `${char.name} · ${anim.name}`,
        destId: animId,
        onDone: async (result, job) => {
          const foundNow = this.store.findAnim(animId);
          if (!foundNow) return;
          const stillA = foundNow.anim.frames.findIndex(f => f.id === frameAId);
          const stillB = foundNow.anim.frames.findIndex(f => f.id === frameBId);
          if (stillA < 0 || stillB < 0 || stillB <= stillA) return; // endpoints moved — refuse to guess
          // endpoints must remain untouched
          const img = await blobToImgData(result.blob);
          const imageId = await this.store.imgStore.putImg(img);
          lineage.provider = result.meta.provider; lineage.model = result.meta.model ?? null;
          lineage.createdAt = Date.now(); lineage.jobId = job.id;
          lineage.resultDims = { w: img.width, h: img.height };
          this.store.mutate(`in-between ${idxA + 1}↔${idxB + 1}`, () => {
            const f = M.createFrame({ width: img.width, height: img.height, source: 'generated', name: `${anim.name}_btwn${k}` });
            f.canvasDims = { ...a.canvasDims };
            f.duration = a.duration;
            f.pivot = { ...a.pivot };
            f.versions.push(M.frameVersion(f, imageId, 'v1', 'in-between'));
            f.imageId = imageId;
            f.lineage = lineage;
            const fresh = this.store.findAnim(animId);
            const aNow = fresh.anim.frames.findIndex(x => x.id === frameAId);
            fresh.anim.frames = M.insertFrames(fresh.anim.frames, [f], aNow + 1);
          });
        },
      });
    }
  }

  // ---------------------------------------------------------------- frame-level ops

  async regenerateFrame(charId, frameId, genSpec) {
    const char = this.store.findChar(charId);
    const { frame, anim } = this.store.findFrame(frameId) ?? {};
    if (!frame || !char) return;
    const caps = await this.registry.caps(this.providerId());
    const index = anim.frames.indexOf(frame);
    const bp = anim.blueprint;
    let prompt, negative;
    if (frame.lineage?.prompt) ({ prompt, negative } = { prompt: frame.lineage.prompt, negative: frame.lineage.negativePrompt });
    else if (bp) ({ prompt, negative } = buildFramePrompt({ genome: char.genome, blueprint: bp, frameIndex: index, totalFrames: bp.frameCount, direction: anim.direction, palette: char.palette.locked ? char.palette.colors : null }));
    else ({ prompt, negative } = buildCharacterPrompt({ ...genSpec, genome: char.genome }));
    this.registry.enqueue({
      label: `Regenerate ${anim.name} frame ${index + 1}`,
      op: caps.references ? 'edit' : 'generate',
      providerId: this.providerId(),
      spec: { prompt, negative, width: frame.canvasDims.w, height: frame.canvasDims.h, refs: await this.allRefFiles(char, caps.references ? [char.masterImageId] : []), seed: -1 },
      animLabel: `${char.name} · ${anim.name}`,
      destId: frameId,
      onDone: async (result, job) => this.applyFrameResult(charId, frameId, job, result, 'regenerated'),
    });
  }

  async variationFrame(charId, frameId) {
    const { frame, anim } = this.store.findFrame(frameId) ?? {};
    const char = this.store.findChar(charId);
    if (!frame || !char) return;
    const caps = await this.registry.caps(this.providerId());
    const basePrompt = frame.lineage?.prompt;
    if (!basePrompt) throw new Error('This frame has no generation lineage to vary — use Regenerate with a prompt instead');
    const seed = frame.lineage.seed != null ? frame.lineage.seed + 1 : Math.floor(Math.random() * 1e6);
    this.registry.enqueue({
      label: `Variation of ${anim.name} frame ${anim.frames.indexOf(frame) + 1}`,
      op: 'generate',
      providerId: this.providerId(),
      spec: { prompt: basePrompt, negative: frame.lineage.negativePrompt, width: frame.canvasDims.w, height: frame.canvasDims.h, seed },
      animLabel: `${char.name} · ${anim.name}`,
      destId: frameId,
      onDone: async (result, job) => {
        const lineagePatch = { seed };
        this.applyFrameResult(charId, frameId, job, result, 'variation', lineagePatch);
      },
    });
  }

  /** Repair with a defect description; uses edit/inpaint when capable. */
  async repairFrame(charId, frameId, defectDesc, maskDataUrl = null) {
    const { frame, anim } = this.store.findFrame(frameId) ?? {};
    const char = this.store.findChar(charId);
    if (!frame?.imageId || !char) return;
    const caps = await this.registry.caps(this.providerId());
    if (!caps.edit && !caps.inpaint) {
      throw new Error('The active provider cannot edit or inpaint images, so localized repair is unavailable. Regenerate the frame instead, or switch to an OpenAI provider.');
    }
    const instruction = `Fix ONLY this defect on the existing sprite frame: ${defectDesc}. Preserve everything else exactly — same character, pose, palette, outline style, proportions and background.`;
    const useMask = !!maskDataUrl && caps.inpaint;
    const imageFile = await this.store.imgStore.getBlob(frame.imageId);
    this.registry.enqueue({
      label: `Repair ${anim.name} frame ${anim.frames.indexOf(frame) + 1}${useMask ? ' (masked)' : ''}`,
      op: useMask ? 'inpaint' : 'edit',
      providerId: this.providerId(),
      spec: { prompt: instruction, refs: [new File([imageFile], 'frame.png', { type: 'image/png' })], image: `frame`, mask: maskDataUrl, width: frame.canvasDims.w, height: frame.canvasDims.h },
      animLabel: `${char.name} · ${anim.name}`,
      destId: frameId,
      onDone: async (result, job) => this.applyFrameResult(charId, frameId, job, result, `repair: ${defectDesc.slice(0, 60)}`, { repairDescription: defectDesc }),
    });
  }

  async applyFrameResult(charId, frameId, job, result, op, lineagePatch = {}) {
    const found = this.store.findFrame(frameId);
    if (!found || this.store.findChar(charId) == null) return; // stale guard
    const { frame, anim } = found;
    const img = await blobToImgData(result.blob);
    const imageId = await this.store.imgStore.putImg(img);
    this.store.mutate(op, () => {
      if (frame.imageId) frame.versions.push(M.frameVersion(frame, frame.imageId, `v${frame.versions.length + 1}`, 'previous'));
      frame.imageId = imageId;
      frame.versions.push(M.frameVersion(frame, imageId, `v${frame.versions.length + 1}`, op));
      const old = frame.lineage ?? {};
      frame.lineage = {
        provider: result.meta.provider, model: result.meta.model ?? null,
        operation: op, prompt: old.prompt ?? null, negativePrompt: old.negativePrompt ?? null,
        seed: 'seed' in lineagePatch ? lineagePatch.seed : old.seed ?? null,
        masterReference: old.masterReference ?? null, references: old.references ?? [],
        parentFrames: old.parentFrames ?? [], createdAt: Date.now(), jobId: job.id,
        requestedDims: old.requestedDims ?? { w: img.width, h: img.height },
        resultDims: { w: img.width, h: img.height },
        ...lineagePatch,
      };
      frame.generationFailed = false;
    });
    this.store.emit('frame-image', frameId);
  }

  async allRefFiles(char, imageIds) {
    const files = [];
    const ids = [char.masterImageId, ...imageIds];
    for (const id of [...new Set(ids)].filter(Boolean)) {
      const blob = await this.store.imgStore.getBlob(id).catch(() => null);
      if (blob) files.push(new File([blob], `${id}.png`, { type: 'image/png' }));
    }
    return files;
  }
}

function snapshotSpec(spec) {
  return JSON.parse(JSON.stringify({
    prompt: spec.prompt, negative: spec.negative, styleId: spec.styleId, customStylePrompt: spec.customStylePrompt,
    view: spec.view, facing: spec.facing, width: spec.width, height: spec.height,
    background: spec.background, seed: spec.seed, count: spec.count,
  }));
}
