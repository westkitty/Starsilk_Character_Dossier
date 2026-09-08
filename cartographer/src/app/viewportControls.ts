/**
 * Viewport controls: camera tools, orbital simulation bar, breadcrumbs, badges,
 * and keyboard shortcuts.
 *
 * Every action here also exists as a visible control — the canvas is never the only
 * way to operate the tool.
 */

import { entityById, pathOf, removeEntity, TYPE_GLYPHS } from '../core/project';
import { SimulationClock, SPEED_PRESETS, labelForSpeed } from '../core/simulation';
import type { ProjectStore } from '../core/store';
import type { StarMapRenderer } from '../render/renderer';
import { button, el, iconButton } from './dom';
import { confirmDialog, type ShellRefs } from './shell';

export interface ViewportControlsOptions {
  refs: ShellRefs;
  store: ProjectStore;
  clock: SimulationClock;
  renderer: StarMapRenderer | null;
  onDeleteRequest?: (entityId: string) => void;
}

export class ViewportControls {
  private unsubscribeClock: (() => void) | null = null;
  private unsubscribeStore: (() => void) | null = null;
  private playBtn: HTMLButtonElement;
  private speedBtns: HTMLButtonElement[] = [];
  private customSpeed: HTMLInputElement;
  private labelBtn: HTMLButtonElement;
  private pathsBtn: HTMLButtonElement;
  private trailsBtn: HTMLButtonElement;
  private gridBtn: HTMLButtonElement;
  private analystBtn: HTMLButtonElement;
  private canonBtn: HTMLButtonElement;
  private keyHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(private readonly options: ViewportControlsOptions) {
    const { refs, clock } = options;

    /* simulation bar -------------------------------------------------- */
    this.playBtn = iconButton('⏸', 'Pause orbital simulation (Space)');
    this.playBtn.addEventListener('click', () => clock.togglePaused());

    const resetBtn = iconButton('⟲', 'Reset orbital simulation time');
    resetBtn.addEventListener('click', () => clock.reset());

    this.speedBtns = SPEED_PRESETS.map((speed) => {
      const btn = button(labelForSpeed(speed), { title: `Simulation speed ${labelForSpeed(speed)}` });
      btn.addEventListener('click', () => clock.setSpeed(speed));
      return btn;
    });

    this.customSpeed = el('input', {
      class: 'sktc-input',
      type: 'number',
      min: '0.01',
      step: '0.01',
      value: '1',
      style: 'width:74px',
      ariaLabel: 'Custom simulation speed multiplier',
    }) as HTMLInputElement;
    const customApply = button('SET', { title: 'Apply custom speed' });
    customApply.addEventListener('click', () => {
      const value = Number.parseFloat(this.customSpeed.value);
      if (Number.isFinite(value) && value > 0) clock.setSpeed(value);
      else this.customSpeed.value = String(clock.speed);
    });

    refs.simControls.append(
      this.playBtn,
      resetBtn,
      el('div', { class: 'sktc-sim__divider', ariaHidden: 'true' }),
      ...this.speedBtns,
      el('div', { class: 'sktc-rail__custom' }, [this.customSpeed, customApply]),
    );

    /* toggles --------------------------------------------------------- */
    this.labelBtn = button('LABELS', { title: 'Cycle label mode (L)' });
    this.labelBtn.addEventListener('click', () => this.cycleLabels());
    this.pathsBtn = button('PATHS', { title: 'Toggle orbit paths (P)' });
    this.pathsBtn.addEventListener('click', () => this.toggleSetting('showOrbitPaths'));
    this.trailsBtn = button('TRAILS', { title: 'Toggle movement trails (T)' });
    this.trailsBtn.addEventListener('click', () => this.toggleSetting('showTrails'));
    this.gridBtn = button('GRID', { title: 'Toggle reference plane' });
    this.gridBtn.addEventListener('click', () => this.toggleSetting('showReferenceGrid'));
    this.analystBtn = button('ANALYST', {
      title: 'ANALYST OVERLAY — NON-DIEGETIC topology (off by default)',
    });
    this.analystBtn.addEventListener('click', () => this.toggleSetting('showAnalystOverlay'));
    this.canonBtn = button('CANON ONLY', { title: 'Hide records that are not locked or working canon' });
    this.canonBtn.addEventListener('click', () => this.toggleSetting('canonOnly'));

    refs.simToggles.append(
      this.labelBtn,
      this.pathsBtn,
      this.trailsBtn,
      this.gridBtn,
      this.analystBtn,
      this.canonBtn,
    );

    /* viewport tools -------------------------------------------------- */
    const focusBtn = iconButton('◎', 'Focus selected (F)');
    focusBtn.addEventListener('click', () => this.focusSelected());
    const enterBtn = iconButton('⤓', 'Enter system (double-click a system in the atlas)');
    enterBtn.addEventListener('click', () => this.enterSelected());
    const upBtn = iconButton('⤒', 'Hierarchy up: system → sector → galaxy');
    upBtn.addEventListener('click', () => this.options.renderer?.goUp());
    const resetCamBtn = iconButton('⌂', 'Reset camera');
    resetCamBtn.addEventListener('click', () => this.options.renderer?.resetCamera());
    refs.viewportTools.append(focusBtn, enterBtn, upBtn, resetCamBtn);
  }

  mount(): void {
    const { store, clock } = this.options;
    this.unsubscribeClock = clock.subscribe(() => this.render());
    this.unsubscribeStore = store.subscribe(() => this.render());

    this.keyHandler = (event: KeyboardEvent) => {
      // Embedded builds must never steal keystrokes from the host document:
      // ignore anything that did not originate inside this component.
      const target = event.target as Node | null;
      if (target && !this.options.refs.root.contains(target)) return;
      this.onKeyDown(event);
    };
    document.addEventListener('keydown', this.keyHandler);
    this.render();
  }

  destroy(): void {
    this.unsubscribeClock?.();
    this.unsubscribeStore?.();
    if (this.keyHandler) document.removeEventListener('keydown', this.keyHandler);
  }

  /* ------------------------------------------------------------ actions */

  focusSelected(): void {
    const id = this.options.store.selectionId;
    if (!id) return;
    this.options.renderer?.focusEntity(id);
    this.announce(`Focused ${entityById(this.options.store.project, id)?.name ?? id}`);
  }

  enterSelected(): void {
    const id = this.options.store.selectionId;
    if (!id) return;
    const entity = entityById(this.options.store.project, id);
    if (!entity) return;
    if (entity.type === 'system') this.options.renderer?.enterSystem(entity.id);
    else if (entity.type === 'starfield') this.options.renderer?.enterSector(entity.id);
    else {
      const systemId = this.options.renderer?.systemIdFor(entity.id);
      if (systemId) this.options.renderer?.enterSystem(systemId);
    }
  }

  private cycleLabels(): void {
    const order = ['none', 'selected', 'major', 'all'] as const;
    const current = this.options.store.project.settings.render.labelMode;
    const next = order[(order.indexOf(current) + 1) % order.length]!;
    this.updateSettings((settings) => {
      settings.labelMode = next;
    }, `Labels: ${next.toUpperCase()}`);
  }

  private toggleSetting(key: 'showOrbitPaths' | 'showTrails' | 'showReferenceGrid' | 'showAnalystOverlay' | 'canonOnly'): void {
    const current = this.options.store.project.settings.render[key];
    this.updateSettings((settings) => {
      settings[key] = !current;
    }, `${key} ${!current ? 'ON' : 'OFF'}`);
    this.options.renderer?.invalidate();
  }

  private updateSettings(mutate: (settings: ProjectSettingsLike) => void, message: string): void {
    this.options.store.commit(message, (draft) => {
      mutate(draft.settings.render as unknown as ProjectSettingsLike);
    });
  }

  private announce(message: string): void {
    this.options.refs.liveRegion.textContent = message;
  }

  async requestDelete(entityId: string): Promise<void> {
    const project = this.options.store.project;
    const entity = entityById(project, entityId);
    if (!entity) return;
    if (entity.parentId === null) {
      await this.showStatus('The galaxy root cannot be deleted.', 'warn');
      return;
    }
    const doomed = [entity.name, ...pathOf(project, entityId).length >= 0 ? [] : []];
    const descendants = project.entities.filter((candidate) => {
      let cursor: string | null = candidate.parentId;
      const seen = new Set<string>();
      while (cursor && !seen.has(cursor)) {
        if (cursor === entityId) return true;
        seen.add(cursor);
        cursor = entityById(project, cursor)?.parentId ?? null;
      }
      return false;
    });
    void doomed;
    const confirmed = await confirmDialog(this.options.refs, {
      title: 'DELETE RECORD',
      message: `Delete “${entity.name}” from the project? This removes the record and everything parented to it. It can be undone with Ctrl+Z.`,
      details: descendants.length > 0
        ? [`Also deleted: ${descendants.map((d) => d.name).join(', ')}`]
        : undefined,
      confirmLabel: 'DELETE',
      tone: 'danger',
    });
    if (!confirmed) return;
    this.options.store.commit(`Delete ${entity.name}`, (draft) => {
      draft.entities = removeEntity(draft, entityId).entities;
    });
    this.options.store.select(null);
    this.announce(`Deleted ${entity.name}`);
    this.options.onDeleteRequest?.(entityId);
  }

  private async showStatus(message: string, tone: 'neutral' | 'warn' | 'danger' = 'neutral'): Promise<void> {
    this.options.store.setStatus(message, tone);
  }

  /* ------------------------------------------------------------ keyboard */

  private onKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const typing =
      !!target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    const mod = event.ctrlKey || event.metaKey;

    if (mod && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        if (this.options.store.redo()) this.announce(`Redid: ${this.options.store.undoLabel ?? 'change'}`);
      } else if (this.options.store.undo()) {
        this.announce(`Undid: ${this.options.store.redoLabel ?? 'change'}`);
      }
      return;
    }
    if (mod && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      this.options.store.redo();
      return;
    }
    if (typing) return;

    switch (event.key) {
      case ' ':
        event.preventDefault();
        this.options.clock.togglePaused();
        break;
      case 'f':
      case 'F':
        event.preventDefault();
        this.focusSelected();
        break;
      case 'l':
      case 'L':
        event.preventDefault();
        this.cycleLabels();
        break;
      case 't':
      case 'T':
        event.preventDefault();
        this.toggleSetting('showTrails');
        break;
      case 'p':
      case 'P':
        event.preventDefault();
        this.toggleSetting('showOrbitPaths');
        break;
      case 'Delete':
      case 'Backspace': {
        const id = this.options.store.selectionId;
        if (id) {
          event.preventDefault();
          void this.requestDelete(id);
        }
        break;
      }
      case 'Escape':
        this.options.store.setUi({ drawer: 'none' });
        this.options.store.select(null);
        break;
      default:
        break;
    }
  }

  /* ------------------------------------------------------------ render */

  render(): void {
    const { refs, store, clock } = this.options;
    const snapshot = clock.snapshot();

    this.playBtn.textContent = snapshot.paused ? '▶' : '⏸';
    this.playBtn.setAttribute('aria-label', snapshot.paused ? 'Play orbital simulation (Space)' : 'Pause orbital simulation (Space)');
    this.playBtn.setAttribute('aria-pressed', String(snapshot.paused));

    for (let i = 0; i < this.speedBtns.length; i += 1) {
      const preset = SPEED_PRESETS[i]!;
      const active = !snapshot.paused && Math.abs(snapshot.speed - preset) < 1e-6;
      this.speedBtns[i]!.setAttribute('aria-pressed', String(active));
    }
    if (document.activeElement !== this.customSpeed) {
      const isPreset = SPEED_PRESETS.some((s) => Math.abs(s - snapshot.speed) < 1e-6);
      if (!isPreset) this.customSpeed.value = String(snapshot.speed);
    }

    refs.simStatus.textContent = `${snapshot.paused ? 'PAUSED' : 'RUNNING'} · ${labelForSpeed(snapshot.speed)} · T+${snapshot.time.toFixed(1)}s · ${clock.days.toFixed(0)}d`;

    const render = store.project.settings.render;
    this.labelBtn.textContent = `LABELS ${render.labelMode.toUpperCase()}`;
    this.labelBtn.setAttribute('aria-pressed', String(render.labelMode !== 'none'));
    this.pathsBtn.setAttribute('aria-pressed', String(render.showOrbitPaths));
    this.trailsBtn.setAttribute('aria-pressed', String(render.showTrails));
    this.gridBtn.setAttribute('aria-pressed', String(render.showReferenceGrid));
    this.analystBtn.setAttribute('aria-pressed', String(render.showAnalystOverlay));
    this.canonBtn.setAttribute('aria-pressed', String(render.canonOnly));

    this.renderBreadcrumbs();
    this.renderBadges();
  }

  private renderBreadcrumbs(): void {
    const { refs, store, renderer } = this.options;
    const project = store.project;
    const targetId = store.ui.viewEntityId ?? store.selectionId;
    const chain = targetId ? pathOf(project, targetId) : [project.entities.find((e) => e.parentId === null)!].filter(Boolean);
    refs.breadcrumbs.textContent = '';

    const root = project.entities.find((e) => e.parentId === null);
    const entries = root ? [root, ...chain.filter((e) => e.id !== root.id)] : chain;
    const unique: typeof entries = [];
    for (const entry of entries) {
      if (!unique.some((e) => e.id === entry.id)) unique.push(entry);
    }

    unique.forEach((entity, index) => {
      const isCurrent = index === unique.length - 1;
      const crumb = el('button', {
        class: 'sktc-crumb',
        type: 'button',
        text: entity.name,
        ariaCurrent: isCurrent ? 'true' : undefined,
        onClick: () => {
          store.select(entity.id);
          if (entity.type === 'system') renderer?.enterSystem(entity.id);
          else if (entity.type === 'starfield') renderer?.enterSector(entity.id);
          else if (entity.type === 'galaxy') renderer?.goUp();
        },
      });
      refs.breadcrumbs.append(crumb);
      if (index < unique.length - 1) {
        refs.breadcrumbs.append(el('span', { class: 'sktc-crumb-sep', text: '›', ariaHidden: 'true' }));
      }
    });
  }

  private renderBadges(): void {
    const { refs, store } = this.options;
    refs.viewportBadges.textContent = '';
    const project = store.project;
    const selection = store.selectionId ? entityById(project, store.selectionId) : null;

    const viewLabel =
      store.ui.view === 'system'
        ? 'SYSTEM VIEW'
        : store.ui.view === 'sector'
          ? 'SECTOR VIEW'
          : 'GALAXY VIEW';
    refs.viewportBadges.append(el('span', { class: 'sktc-badge sktc-badge--thread', text: viewLabel }));

    if (selection) {
      refs.viewportBadges.append(
        el('span', { class: 'sktc-badge' }, [
          el('span', { class: 'sktc-badge__tick', text: TYPE_GLYPHS[selection.type] ?? '·' }),
          ` SELECTED: ${selection.name}`,
        ]),
      );
      if (selection.meta.canonStatus === 'schematic') {
        refs.viewportBadges.append(
          el('span', { class: 'sktc-badge sktc-badge--warn', text: 'SCHEMATIC / NON-CANON POSITION' }),
        );
      }
    }

    if (project.settings.render.showAnalystOverlay) {
      refs.viewportBadges.append(
        el('span', { class: 'sktc-badge sktc-badge--warn', text: 'ANALYST OVERLAY — NON-DIEGETIC' }),
      );
    }

    const wall = project.entities.find(
      (entity) =>
        entity.type === 'largeScaleStructure' &&
        ((entity.visual?.structure as string | undefined) === 'siegeWall' ||
          (entity.meta.tags ?? []).some((tag) => tag.toLowerCase() === 'siege-wall') ||
          /siege wall/i.test(entity.name)),
    );
    if (wall) {
      refs.viewportBadges.append(
        el('span', {
          class: 'sktc-badge',
          text: 'SIEGE WALL = STELLAR ABSENCE · PROCEDURAL RENDER NODES, NO CANON NODE COUNT',
        }),
      );
    }

    if (project.settings.render.canonOnly) {
      refs.viewportBadges.append(el('span', { class: 'sktc-badge sktc-badge--ok', text: 'CANON ONLY FILTER ACTIVE' }));
    }
  }
}

/** Structural alias so the settings mutator stays typed without importing the whole model. */
type ProjectSettingsLike = {
  labelMode: 'none' | 'selected' | 'major' | 'all';
  showOrbitPaths: boolean;
  showTrails: boolean;
  showReferenceGrid: boolean;
  showAnalystOverlay: boolean;
  canonOnly: boolean;
};

/** Convenience for tests: build a clock preset label. */
export function speedLabel(speed: number): string {
  return labelForSpeed(speed);
}

export { button };
