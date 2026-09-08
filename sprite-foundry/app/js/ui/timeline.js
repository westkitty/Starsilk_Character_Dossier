// timeline.js — animation timeline strip: honors selection, multi-selection,
// drag reorder, per-frame timing/approval, transport controls.
import { el, $, toast } from './components.js';

export class Timeline {
  constructor(store, root, genops) {
    this.store = store;
    this.root = root;
    this.genops = genops;
    this.zoom = 1; // thumb scale multiplier
    this.dragState = null;
    store.on('project', () => this.render());
    store.on('selection', () => this.render());
    store.on('playing', () => this.highlightPlaying());
    store.on('frame-image', () => this.render());
    store.on('history', () => this.render());
  }

  get anim() { return this.store.activeAnim(); }

  render() {
    const store = this.store;
    const anim = this.anim;
    this.root.innerHTML = '';
    // transport
    const transport = el('div', { class: 'transport' });
    if (!anim) {
      transport.append(el('span', { class: 'dim', text: 'No animation selected — create one in the project panel or MOTION stage' }));
    } else {
      const playBtn = el('button', { class: 'tbtn', 'aria-label': store.ui.playing ? 'Pause' : 'Play', title: 'Play/Pause (Space)', onClick: () => this.togglePlay() }, store.ui.playing ? '⏸' : '▶');
      transport.append(
        playBtn,
        tbtn('⏮', 'First', () => this.seek(0)),
        tbtn('◀', 'Previous frame (←)', () => this.step(-1)),
        tbtn('▶|', 'Next frame (→)', () => this.step(1)),
        tbtn('⏭', 'Last', () => this.seek(anim.frames.length - 1)),
        el('span', { class: 'tsep' }),
        loopBtn(store, anim, 'loop', 'Loop'),
        loopBtn(store, anim, 'once', 'Once'),
        loopBtn(store, anim, 'pingpong', 'Ping-pong'),
        el('span', { class: 'tsep' }),
        (() => {
          const fps = el('input', { type: 'number', min: 1, max: 60, value: anim.defaultFPS, class: 'fps-input', title: 'Default FPS', 'aria-label': 'Default frames per second' });
          fps.addEventListener('change', () => store.updateAnim(anim.id, { defaultFPS: Math.max(1, Math.min(60, Number(fps.value) || 8)) }));
          return el('label', { class: 'fps-wrap' }, 'fps', fps);
        })(),
        tbtn('⟲', 'Reverse order', () => {
          store.mutate('reverse frames', () => { anim.frames.reverse(); });
        }),
        tbtn('⧉', 'Duplicate sequence', () => {
          store.mutate('duplicate sequence', () => {
            anim.frames = [...anim.frames, ...anim.frames.map(f => {
              const c = JSON.parse(JSON.stringify(f));
              c.id = M_uid(); c.status = 'draft';
              return c;
            })];
          });
        }),
        el('span', { class: 'tsep' }),
        tbtn('−', 'Timeline zoom out', () => { this.zoom = Math.max(0.5, this.zoom - 0.25); this.render(); }),
        tbtn('+', 'Timeline zoom in', () => { this.zoom = Math.min(2.5, this.zoom + 0.25); this.render(); }),
        (() => {
          const tag = el('input', { type: 'text', value: anim.name, class: 'anim-name-input', 'aria-label': 'Animation name', title: 'Animation name' });
          tag.addEventListener('change', () => store.updateAnim(anim.id, { name: tag.value || 'clip' }, 'rename animation', false));
          return tag;
        })(),
        el('span', { class: 'dim small', text: `${anim.frames.length} frames · ${anim.direction} · ${anim.loopMode}` }),
      );
    }
    // frames strip
    const strip = el('div', { class: 'timeline-strip', role: 'listbox', 'aria-label': 'Frames', 'aria-orientation': 'horizontal' });
    if (anim) {
      anim.frames.forEach((frame, i) => strip.append(this.thumb(frame, i)));
      const addBtn = el('button', { class: 'frame-add', title: 'Add empty frame', onClick: () => this.addEmptyFrame() }, '+');
      strip.append(addBtn);
    }
    this.root.append(transport, strip);
    this.highlightPlaying();
    this.wireSelectionStore();
  }

  togglePlay() {
    const ui = this.store.ui;
    if (!ui.playing && this.anim?.frames.length) {
      ui.playing = true;
      ui.playbackDir = 1;
    } else ui.playing = false;
    this.store.emit('playing');
  }
  seek(i) {
    const anim = this.anim;
    if (!anim) return;
    this.store.ui.selection.currentIndex = Math.max(0, Math.min(anim.frames.length - 1, i));
    this.store.ui.playIndex = this.store.ui.selection.currentIndex;
    this.store.emit('selection');
    this.store.emit('view');
  }
  step(d) {
    const anim = this.anim;
    if (!anim) return;
    this.seek(this.store.ui.selection.currentIndex + d);
  }
  setFps(v) { const a = this.anim; if (a) this.store.updateAnim(a.id, { defaultFPS: v }); }

  highlightPlaying() {
    const anim = this.anim;
    const idx = this.store.ui.selection.currentIndex;
    this.root.querySelectorAll('.frame-thumb').forEach((node, i) => {
      node.classList.toggle('playing', this.store.ui.playing && i === idx);
      node.setAttribute('aria-current', this.store.ui.playing && i === idx ? 'true' : 'false');
      node.classList.toggle('current', i === idx);
    });
  }

  thumb(frame, i) {
    const store = this.store;
    const ui = store.ui;
    const selected = ui.selection.frameIds.includes(frame.id);
    const size = 56 * this.zoom;
    const statusLetter = frame.status === 'approved' ? 'A' : frame.status === 'rejected' ? 'R' : 'D';
    const node = el('div', {
      class: `frame-thumb status-${frame.status} ${selected ? 'selected' : ''}`,
      role: 'option', 'aria-selected': String(selected), tabindex: '0',
      title: `${i + 1}. ${frame.name || frame.id}\n${frame.duration}ms · ${frame.status}${frame.boxes?.length ? `\n${frame.boxes.length} box(es)` : ''}${frame.points?.length ? ` · ${frame.points.length} point(s)` : ''}`,
      style: `width:${size}px`,
    });
    const uv = Number(i) + 1;
    const num = el('span', { class: 'frame-num', text: String(uv) });
    const imgWrap = el('div', { class: 'frame-img-wrap' });
    const thumb = frame.imageId ? store.imgStore.getThumb(frame.imageId) : null;
    if (thumb) {
      imgWrap.append(el('img', { src: thumb, alt: '', draggable: 'false' }));
    } else if (frame.imageId) {
      imgWrap.append(el('span', { class: 'frame-empty', text: '…' }));
      store.imgStore.ensure(frame.imageId).then(() => {
        const t = store.imgStore.getThumb(frame.imageId);
        const wrap = node.querySelector('.frame-img-wrap');
        if (t && wrap) { wrap.innerHTML = ''; wrap.append(el('img', { src: t, alt: '', draggable: 'false' })); }
      }).catch(() => {});
    } else {
      imgWrap.append(el('span', { class: 'frame-empty', text: '∅' }));
    }
    const badges = el('div', { class: 'frame-badges' },
      el('span', { class: `badge badge-${frame.status}`, title: `status: ${frame.status}` }, statusLetter),
      frame.generationFailed ? el('span', { class: 'badge badge-failed', title: 'generation failed' }, '!') : null);
    node.append(num, imgWrap, badges);
    // interactions
    node.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      this.potentialDrag = { frameId: frame.id, index: i, startX: e.clientX, moved: false, ids: selected ? ui.selection.frameIds : [frame.id] };
      const onMove = mv => {
        if (!this.potentialDrag || this.potentialDrag.moved) return;
        if (Math.abs(mv.clientX - this.potentialDrag.startX) > 6) {
          this.potentialDrag.moved = true;
          this.startDrag(node, this.potentialDrag);
        }
      };
      const onUp = mv => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        if (this.potentialDrag && !this.potentialDrag.moved) this.handleClick(frame, i, mv);
        this.potentialDrag = null;
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
    node.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.handleClick(frame, i, e); }
    });
    return node;
  }

  handleClick(frame, i, e) {
    const ui = this.store.ui;
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      const set = new Set(ui.selection.frameIds);
      if (set.has(frame.id)) set.delete(frame.id); else set.add(frame.id);
      ui.selection.frameIds = [...set];
    } else {
      ui.selection.frameIds = [frame.id];
    }
    ui.selection.currentIndex = i;
    ui.playIndex = i;
    this.store.emit('selection');
    this.store.emit('view');
  }

  startDrag(node, state) {
    const anim = this.anim;
    if (!anim) return;
    const strip = this.root.querySelector('.timeline-strip');
    let over = null;
    node.classList.add('dragging');
    const onMove = e => {
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.frame-thumb');
      strip.querySelectorAll('.frame-thumb').forEach(n => n.classList.remove('drop-target'));
      over = null;
      if (target && strip.contains(target)) {
        target.classList.add('drop-target');
        over = [...strip.querySelectorAll('.frame-thumb')].indexOf(target);
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      node.classList.remove('dragging');
      strip.querySelectorAll('.frame-thumb').forEach(n => n.classList.remove('drop-target'));
      if (over != null) {
        const ids = state.ids;
        const current = anim.frames.filter(f => ids.includes(f.id)).map(f => anim.frames.indexOf(f));
        this.store.moveFrames(anim.id, ids, over > Math.max(...current) ? over - (ids.length - 1) : over);
        this.store.ui.selection.currentIndex = anim.frames.findIndex(f => f.id === state.frameId);
        this.store.emit('selection');
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  addEmptyFrame() {
    const anim = this.anim;
    if (!anim) return;
    toast('Empty frames are placeholders — generate onto them or replace their pixels (see FRAMES stage). Creating blank frame.');
    import('../lib/model.js').then(M => {
      const size = this.store.activeChar()?.spriteDefaults ?? { w: 256, h: 256 };
      const f = M.createFrame({ width: size.w, height: size.h, source: 'derived' });
      f.duration = Math.round(1000 / (anim.defaultFPS || 8));
      this.store.insertFrames(anim.id, [f], anim.frames.length);
    });
  }

  wireSelectionStore() { /* selection lives in store.ui; nothing extra */ }
}

function tbtn(label, title, onClick) {
  return el('button', { class: 'tbtn', title, 'aria-label': title, onClick }, label);
}
function loopBtn(store, anim, mode, label) {
  return el('button', {
    class: `tbtn ${anim.loopMode === mode ? 'active' : ''}`, title: `${label} playback`,
    'aria-pressed': String(anim.loopMode === mode),
    onClick: () => store.updateAnim(anim.id, { loopMode: mode }),
  }, label === 'Loop' ? '🔁' : label === 'Once' ? '➡' : '🔃');
}
function M_uid() { return `frame_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`; }
