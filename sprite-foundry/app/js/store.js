// store.js — central application state: project model, selection, UI state,
// bounded undo/redo (snapshot-based; images are immutable so snapshots are
// cheap), IDB autosave, and every mutating domain action.
import * as M from './lib/model.js';
import { collectImageIds } from './lib/serialize.js';

const HISTORY_LIMIT = 50;

export class Store {
  constructor(imgStore) {
    this.imgStore = imgStore;
    this.project = M.createProject();
    this.ui = defaultUi();
    this.jobs = [];
    this.past = [];
    this.future = [];
    this.listeners = new Map(); // topic → Set(fn)
    this.autosaveEnabled = true;
    this._autosaveTimer = null;
    this._coalesceKey = null;
  }

  // ------------------------------------------------------------ pub/sub

  on(topic, fn) {
    if (!this.listeners.has(topic)) this.listeners.set(topic, new Set());
    this.listeners.get(topic).add(fn);
    return () => this.listeners.get(topic).delete(fn);
  }
  emit(topic, payload) {
    for (const fn of this.listeners.get(topic) ?? []) { try { fn(payload); } catch (e) { console.error(topic, e); } }
    for (const fn of this.listeners.get('*') ?? []) { try { fn(topic, payload); } catch (e) { console.error('*', e); } }
  }
  changed(what = 'project') { this.emit(what); this.scheduleAutosave(); }

  // ------------------------------------------------------------ helpers

  activeChar() { return this.project.characters.find(c => c.id === this.project.activeCharacterId) ?? null; }
  activeAnim() {
    const ch = this.activeChar();
    return ch?.animations.find(a => a.id === ch.activeAnimationId) ?? null;
  }
  findChar(id) { return this.project.characters.find(c => c.id === id) ?? null; }
  findAnim(animId) {
    for (const ch of this.project.characters) {
      const a = ch.animations.find(x => x.id === animId);
      if (a) return { anim: a, char: ch };
    }
    return null;
  }
  findFrame(frameId) {
    for (const ch of this.project.characters) for (const anim of ch.animations) {
      const idx = anim.frames.findIndex(f => f.id === frameId);
      if (idx >= 0) return { frame: anim.frames[idx], anim, char: ch, index: idx };
    }
    return null;
  }

  // ------------------------------------------------------------ history

  snapshot() {
    return JSON.stringify({ project: this.project, selection: this.ui.selection });
  }
  restore(json) {
    const { project, selection } = JSON.parse(json);
    this.project = project;
    this.ui.selection = selection;
  }
  /**
   * Every model mutation goes through here. label=null → no history entry
   * (transient preview). coalesceKey merges rapid-fire edits (typing, drags).
   */
  mutate(label, fn, { coalesceKey = null } = {}) {
    if (label != null) {
      if (coalesceKey && this._coalesceKey === coalesceKey && this.past.length) {
        // merge with previous entry — do not push again
      } else {
        this.past.push(this.snapshot());
        if (this.past.length > HISTORY_LIMIT) this.past.shift();
        this.future.length = 0;
        this._coalesceKey = coalesceKey;
      }
    }
    fn(this.project);
    this.scheduleAutosave();
    this.emit('project');
    this.emit('history');
  }
  commitCoalesce() { this._coalesceKey = null; }

  undo() {
    if (!this.past.length) return false;
    this.future.push(this.snapshot());
    this.restore(this.past.pop());
    this._coalesceKey = null;
    this.emit('project'); this.emit('history');
    return true;
  }
  redo() {
    if (!this.future.length) return false;
    this.past.push(this.snapshot());
    this.restore(this.future.pop());
    this._coalesceKey = null;
    this.emit('project'); this.emit('history');
    return true;
  }

  // ------------------------------------------------------------ project actions

  newProject(name) {
    this.mutate('new project', p => {
      Object.assign(p, M.createProject(name || 'Untitled Project'));
      this.ui.selection = { frameIds: [], currentIndex: 0 };
    });
    this.past.length = 0; this.future.length = 0;
  }

  loadProject(project) {
    this.past.length = 0; this.future.length = 0;
    this.project = project;
    this.ui.selection = { frameIds: [], currentIndex: 0 };
    this.emit('project'); this.emit('history');
    this.scheduleAutosave();
  }

  addCharacter(name) {
    let ch;
    this.mutate('add character', p => {
      ch = M.createCharacter(name || `Character ${p.characters.length + 1}`);
      p.characters.push(ch);
      p.activeCharacterId = ch.id;
    });
    return ch;
  }

  renameCharacter(id, name) {
    this.mutate('rename character', p => { const c = p.characters.find(x => x.id === id); if (c) c.name = name; }, { coalesceKey: `rename-${id}` });
  }

  removeCharacter(id) {
    this.mutate('remove character', p => {
      p.characters = p.characters.filter(c => c.id !== id);
      if (p.activeCharacterId === id) p.activeCharacterId = p.characters[0]?.id ?? null;
    });
  }

  setMaster(charId, imageId, source = 'candidate') {
    this.mutate('set master', p => {
      const c = p.characters.find(x => x.id === charId);
      if (c) { c.masterImageId = imageId; c.masterSource = source; }
    });
  }

  addCandidate(charId, candidate) {
    // candidates arrive without history spam: they are results, keep undo sane
    this.mutate(null, p => { p.characters.find(c => c.id === charId)?.candidates.push(candidate); });
  }

  updateCandidate(charId, candId, patch) {
    this.mutate(null, p => {
      const c = p.characters.find(x => x.id === charId);
      const cand = c?.candidates.find(x => x.id === candId);
      if (cand) Object.assign(cand, patch);
    });
  }

  removeCandidate(charId, candId) {
    this.mutate('reject candidate', p => {
      const c = p.characters.find(x => x.id === charId);
      if (c) c.candidates = c.candidates.filter(x => x.id !== candId);
    });
  }

  updateGenome(charId, updater) {
    this.mutate('edit genome', p => { const c = p.characters.find(x => x.id === charId); if (c) updater(c.genome); }, { coalesceKey: `genome-${charId}` });
  }

  addAnimation(charId, opts = {}) {
    let anim;
    this.mutate('add animation', p => {
      const c = p.characters.find(x => x.id === charId);
      anim = M.createAnimation(opts.name, opts.type ?? 'custom', opts.direction ?? 'south');
      if (opts.blueprint !== null) anim.blueprint = M.defaultBlueprint(anim.type, opts.frameCount ?? 8);
      anim.defaultFPS = opts.fps ?? 8;
      c.animations.push(anim);
      c.activeAnimationId = anim.id;
    });
    return anim;
  }

  updateAnim(animId, patch, label = 'edit animation', coalesce = true) {
    this.mutate(label, () => {
      const found = this.findAnim(animId);
      if (found) Object.assign(found.anim, patch);
    }, { coalesceKey: coalesce ? `anim-${animId}` : null });
  }

  removeAnimation(animId) {
    this.mutate('remove animation', p => {
      const found = this.findAnim(animId);
      if (!found) return;
      found.char.animations = found.char.animations.filter(a => a.id !== animId);
      if (found.char.activeAnimationId === animId) found.char.activeAnimationId = found.char.animations[0]?.id ?? null;
    });
  }

  duplicateAnimation(animId) {
    let copy;
    this.mutate('duplicate animation', () => {
      const found = this.findAnim(animId);
      if (!found) return;
      copy = JSON.parse(JSON.stringify(found.anim));
      copy.id = M.uid('anim');
      copy.name = `${copy.name} copy`;
      copy.frames.forEach(f => { f.id = M.uid('frame'); });
      found.char.animations.push(copy);
      found.char.activeAnimationId = copy.id;
    });
    return copy;
  }

  // ------------------------------------------------------------ frame actions

  insertFrames(animId, frames, index) {
    this.mutate('insert frames', () => {
      const found = this.findAnim(animId);
      if (found) found.anim.frames = M.insertFrames(found.anim.frames, frames, index);
    });
  }

  removeFrames(animId, ids) {
    this.mutate('remove frames', () => {
      const found = this.findAnim(animId);
      if (found) found.anim.frames = M.removeFrameIds(found.anim.frames, ids);
    });
    this.ui.selection.frameIds = this.ui.selection.frameIds.filter(id => !ids.includes(id));
  }

  moveFrames(animId, ids, targetIndex) {
    this.mutate('reorder frames', () => {
      const found = this.findAnim(animId);
      if (found) found.anim.frames = M.moveFrames(found.anim.frames, ids, targetIndex);
    });
  }

  duplicateFrames(animId, ids) {
    this.mutate('duplicate frames', () => {
      const found = this.findAnim(animId);
      if (!found) return;
      const copies = found.anim.frames.filter(f => ids.includes(f.id)).map(M.duplicateFrame);
      const at = Math.max(...found.anim.frames.map((f, i) => ids.includes(f.id) ? i : -1)) + 1;
      found.anim.frames = M.insertFrames(found.anim.frames, copies, at);
    });
  }

  /** Replace a frame's pixels — pushes the old image into version history. */
  async replaceFrameImage(frameId, img, { label = 'replace', op = 'replace', recordVersion = true } = {}) {
    const imageId = await this.imgStore.putImg(img);
    this.mutate(op, () => {
      const found = this.ui && this.findFrame(frameId);
      if (!found) return;
      const f = found.frame;
      if (recordVersion && f.imageId && f.versions[f.versions.length - 1]?.imageId !== f.imageId) {
        f.versions.push(M.frameVersion(f, f.imageId, `v${f.versions.length + 1}`, 'previous'));
      }
      f.imageId = imageId;
      if (recordVersion) f.versions.push(M.frameVersion(f, imageId, `v${f.versions.length + 1}`, label));
      f.sourceDims = { w: img.width, h: img.height };
      // keep canvas dims (stabilization decides that), but if frame had
      // foreign dims adopt the new image as the working canvas
      f.canvasDims = found.frame.canvasDims || { w: img.width, h: img.height };
    });
    return imageId;
  }

  setFramePatch(animId, frameId, patch, label = 'edit frame', coalesce = 'frame') {
    this.mutate(label, () => {
      const found = this.findAnim(animId);
      const f = found?.anim.frames.find(x => x.id === frameId);
      if (f) Object.assign(f, patch);
    }, { coalesceKey: coalesce === false ? null : `${coalesce}-${frameId}` });
  }

  setFrameVersion(frameId, versionId) {
    this.mutate('restore version', () => {
      const found = this.findFrame(frameId);
      const v = found?.frame.versions.find(x => x.id === versionId);
      if (found && v) found.frame.imageId = v.imageId;
    });
  }

  deleteFrameVersion(frameId, versionId) {
    this.mutate('delete version', () => {
      const found = this.findFrame(frameId);
      if (!found) return;
      const f = found.frame;
      if (f.versions.length <= 1) return;
      const v = f.versions.find(x => x.id === versionId);
      if (!v) return;
      f.versions = f.versions.filter(x => x.id !== versionId);
      if (f.imageId === v.imageId) f.imageId = f.versions[f.versions.length - 1].imageId;
    });
  }

  applyPivotToClip(animId, pivot) {
    this.mutate('apply pivot to clip', () => {
      const found = this.findAnim(animId);
      if (found) found.anim.frames.forEach(f => { f.pivot = { ...pivot }; });
    });
  }

  stabilize(animId, assignments /* Map frameId → {offset, canvasDims?, newImageId?} */) {
    this.mutate('stabilize sequence', () => {
      const found = this.findAnim(animId);
      if (!found) return;
      for (const f of found.anim.frames) {
        const a = assignments.get(f.id);
        if (!a) continue;
        if (a.offset) f.offset = a.offset;
        if (a.canvasDims) f.canvasDims = a.canvasDims;
      }
    });
  }

  // ------------------------------------------------------------ jobs

  addJob(job) { this.jobs.push(job); this.emit('jobs'); }
  updateJob(id, patch) {
    const j = this.jobs.find(x => x.id === id);
    if (j) { Object.assign(j, patch); this.emit('jobs'); }
  }
  jobByDest(destId) { return this.jobs.find(j => j.destId === destId); }

  // ------------------------------------------------------------ autosave

  scheduleAutosave() {
    if (!this.autosaveEnabled) return;
    clearTimeout(this._autosaveTimer);
    this._autosaveTimer = setTimeout(() => this.saveLocal(), 800);
  }

  async saveLocal() {
    if (!this.autosaveEnabled) return;
    try {
      await this.imgStore.kvSet('autosave', { savedAt: Date.now(), project: this.project });
      this.emit('autosaved');
    } catch (e) { console.warn('autosave failed', e); }
  }

  async loadLocalAutosave() {
    try { return await this.imgStore.kvGet('autosave'); } catch { return null; }
  }

  async clearLocal() {
    try { await this.imgStore.kvDel('autosave'); } catch { /* fine */ }
  }

  async garbageCollect() { await this.imgStore.collectGarbage(collectImageIds(this.project)); }
}

function defaultUi() {
  return {
    stage: 'create',
    selection: { frameIds: [], currentIndex: 0, candidateIds: [] },
    view: {
      zoom: null, panX: 0, panY: 0, nearest: true,
      overlay: { pivot: true, ground: true, grid: false, onion: 0, onionOpacity: 0.35, boxes: true, points: true, bbox: false, trail: 0, sliceRects: true, packRects: true },
      bg: 'checkerboard',
      tool: 'pan',
    },
    playing: false,
    playIndex: 0,
    compare: { mode: 'off', aId: null, bId: null, trailN: 3, fps: 8, frames: [] },
    slice: null,  // set by slice stage
    pack: null,   // set by pack stage
    playbackDir: 1,
    pendingRepair: null,
    statusText: '',
  };
}
