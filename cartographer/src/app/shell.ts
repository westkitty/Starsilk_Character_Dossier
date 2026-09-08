/**
 * Editor chrome.
 *
 * Builds the persistent DOM skeleton (header / hierarchy / viewport / inspector /
 * historical rail / simulation bar) once. Panels are filled by their own modules;
 * this file owns no state, which keeps the renderer free to assume the shell never
 * changes underneath it.
 *
 * Desktop layout:
 *   ┌ header ────────────────────────────────────────────────┐
 *   ├ hierarchy │           3D viewport          │ inspector ┤
 *   ├ historical time rail (scope / override / markers)      ┤
 *   ├ orbital simulation bar (play/pause, speed, toggles)    ┤
 *   └────────────────────────────────────────────────────────┘
 * Narrow screens collapse the side panels into drawers; the canvas stays primary.
 */

import { button, el, iconButton } from './dom';

export interface ShellRefs {
  root: HTMLElement;
  frame: HTMLElement;
  titleEl: HTMLElement;
  subtitleEl: HTMLElement;
  saveStateEl: HTMLElement;
  headerActions: HTMLElement;
  undoBtn: HTMLButtonElement;
  redoBtn: HTMLButtonElement;
  importBtn: HTMLButtonElement;
  exportBtn: HTMLButtonElement;
  demoBtn: HTMLButtonElement;
  helpBtn: HTMLButtonElement;
  viewerModeBtn: HTMLButtonElement;

  hierarchyPanel: HTMLElement;
  hierarchySearch: HTMLInputElement;
  hierarchyBody: HTMLElement;
  hierarchyActions: HTMLElement;

  viewport: HTMLElement;
  canvasHost: HTMLElement;
  overlay: HTMLElement;
  breadcrumbs: HTMLElement;
  viewportTools: HTMLElement;
  viewportBadges: HTMLElement;
  fallback: HTMLElement;

  inspectorPanel: HTMLElement;
  inspectorBody: HTMLElement;

  rail: HTMLElement;
  railScope: HTMLElement;
  railValue: HTMLElement;
  railStatus: HTMLElement;
  railMarkers: HTMLElement;
  railSlider: HTMLInputElement;
  railControls: HTMLElement;

  simBar: HTMLElement;
  simControls: HTMLElement;
  simToggles: HTMLElement;
  simStatus: HTMLElement;

  hierarchyToggle: HTMLButtonElement;
  inspectorToggle: HTMLButtonElement;

  dialogLayer: HTMLElement;
  liveRegion: HTMLElement;
}

export function createShell(host: HTMLElement): ShellRefs {
  const root = el('div', {
    class: 'sktc',
    dataset: { drawer: 'none' },
  });

  /* header ------------------------------------------------------------ */
  const titleEl = el('span', { class: 'sktc-brand-name', text: 'STARSiLK TEMPORAL CARTOGRAPHER' });
  const subtitleEl = el('span', {
    class: 'sktc-brand-sub',
    text: 'ADMINISTRATION CARTOGRAPHIC ARCHIVE · SECTOR COPY',
  });
  const saveStateEl = el('span', {
    class: 'sktc-badge',
    id: 'sktc-save-state',
    text: 'SAVED',
    role: 'status',
    ariaLive: 'polite',
  });

  const undoBtn = iconButton('↶', 'Undo (Ctrl+Z)');
  const redoBtn = iconButton('↷', 'Redo (Ctrl+Shift+Z)');
  const importBtn = button('IMPORT', { title: 'Import project JSON' });
  const exportBtn = button('EXPORT', { title: 'Export project JSON' });
  const demoBtn = button('DEMO', { title: 'Load the STARSiLK demonstration map' });
  const viewerModeBtn = button('VIEWER', {
    title: 'Toggle read-only viewer mode (the embeddable dossier surface)',
  });
  const helpBtn = iconButton('?', 'Keyboard shortcuts and canon notes');

  const hierarchyToggle = iconButton('☰', 'Hierarchy', undefined, { class: 'sktc-drawer-toggle' });
  const inspectorToggle = iconButton('⚙', 'Inspector', undefined, { class: 'sktc-drawer-toggle' });

  const headerActions = el('div', { class: 'sktc-actions' }, [
    saveStateEl,
    undoBtn,
    redoBtn,
    importBtn,
    exportBtn,
    demoBtn,
    viewerModeBtn,
    helpBtn,
    hierarchyToggle,
    inspectorToggle,
  ]);

  const header = el('header', { class: 'sktc-header' }, [
    el('div', { class: 'sktc-brand' }, [
      el('span', { class: 'sktc-brand-mark', text: '◈', ariaHidden: 'true' }),
      titleEl,
      subtitleEl,
    ]),
    el('div', { class: 'sktc-header-spacer' }),
    headerActions,
  ]);

  /* hierarchy panel --------------------------------------------------- */
  const hierarchySearch = el('input', {
    class: 'sktc-search',
    type: 'search',
    placeholder: 'SEARCH ENTITIES',
    ariaLabel: 'Search entities',
  }) as HTMLInputElement;

  const hierarchyBody = el('div', {
    class: 'sktc-panel-body sktc-panel-body--flush',
    role: 'tree',
    ariaLabel: 'Entity hierarchy',
    tabIndex: 0,
  });
  const hierarchyActions = el('div', { class: 'sktc-tree-actions' });
  const hierarchyPanel = el('section', {
    class: 'sktc-panel sktc-panel--left',
    id: 'sktc-hierarchy',
    ariaLabel: 'Hierarchy',
  }, [
    el('div', { class: 'sktc-panel-head' }, [
      el('span', { class: 'sktc-panel-title', text: 'HIERARCHY' }),
    ]),
    el('div', { style: 'padding:6px' }, [hierarchySearch]),
    hierarchyBody,
    hierarchyActions,
  ]);

  /* viewport ---------------------------------------------------------- */
  const canvasHost = el('div', { class: 'sktc-canvas-host', style: 'position:absolute;inset:0' });
  const overlay = el('div', { class: 'sktc-viewport-overlay', ariaHidden: 'true' });
  const breadcrumbs = el('nav', { class: 'sktc-breadcrumbs', ariaLabel: 'Cartographic position' });
  const viewportTools = el('div', { class: 'sktc-viewport-tools' });
  const viewportBadges = el('div', { class: 'sktc-viewport-badge' });
  const fallback = el('div', { class: 'sktc-viewport-fallback' }, [
    el('div', {}, [
      el('p', { text: 'INITIALISING CARTOGRAPHIC SURFACE' }),
      el('p', { class: 'sktc-hint', text: 'WebGL is required for the 3D atlas. The hierarchy, historical rail, and inspector remain usable.' }),
    ]),
  ]);
  const viewport = el('main', {
    class: 'sktc-viewport',
    ariaLabel: '3D star map viewport',
  }, [canvasHost, overlay, breadcrumbs, viewportTools, viewportBadges, fallback]);

  /* inspector --------------------------------------------------------- */
  const inspectorBody = el('div', { class: 'sktc-panel-body' });
  const inspectorPanel = el('section', {
    class: 'sktc-panel sktc-panel--right',
    id: 'sktc-inspector',
    ariaLabel: 'Inspector',
  }, [
    el('div', { class: 'sktc-panel-head' }, [
      el('span', { class: 'sktc-panel-title', text: 'INSPECTOR' }),
    ]),
    inspectorBody,
  ]);

  /* historical rail --------------------------------------------------- */
  const railValue = el('div', { class: 'sktc-rail__value', text: '—' });
  const railStatus = el('div', { class: 'sktc-rail__status' });
  const railScope = el('div', { class: 'sktc-rail__scope' }, [
    el('div', { class: 'sktc-rail__title', text: 'HISTORICAL TIME · SCOPE' }),
    railValue,
    railStatus,
  ]);
  const railMarkers = el('div', {
    class: 'sktc-rail__markers',
    role: 'group',
    ariaLabel: 'Historical era markers',
  });
  const railSlider = el('input', {
    class: 'sktc-slider',
    type: 'range',
    min: '0',
    max: '0',
    step: '1',
    value: '0',
    ariaLabel: 'Scrub historical era',
  }) as HTMLInputElement;
  const railControls = el('div', { class: 'sktc-rail__controls' });
  const rail = el('section', { class: 'sktc-rail', ariaLabel: 'Historical time' }, [
    railScope,
    el('div', { class: 'sktc-rail__track' }, [railMarkers, railSlider, railControls]),
  ]);

  /* simulation bar ---------------------------------------------------- */
  const simControls = el('div', { class: 'sktc-sim__group' });
  const simToggles = el('div', { class: 'sktc-sim__group' });
  const simStatus = el('span', { class: 'sktc-sim__status', text: 'READY' });
  const simBar = el('section', { class: 'sktc-sim', ariaLabel: 'Orbital simulation' }, [
    el('span', { class: 'sktc-sim__label', text: 'ORBITAL SIMULATION' }),
    el('div', { class: 'sktc-sim__divider', ariaHidden: 'true' }),
    simControls,
    el('div', { class: 'sktc-sim__divider', ariaHidden: 'true' }),
    simToggles,
    el('div', { class: 'sktc-sim__spacer' }),
    simStatus,
  ]);

  const dialogLayer = el('div', { class: 'sktc-dialog-layer' });
  const liveRegion = el('div', {
    class: 'sktc-sr-only',
    id: 'sktc-announce',
    role: 'status',
    ariaLive: 'polite',
  });

  const frame = el('div', { class: 'sktc-frame' }, [
    header,
    hierarchyPanel,
    viewport,
    inspectorPanel,
    rail,
    simBar,
    dialogLayer,
    liveRegion,
  ]);

  root.append(frame);
  host.textContent = '';
  host.append(root);

  return {
    root,
    frame,
    titleEl,
    subtitleEl,
    saveStateEl,
    headerActions,
    undoBtn,
    redoBtn,
    importBtn,
    exportBtn,
    demoBtn,
    helpBtn,
    viewerModeBtn,
    hierarchyPanel,
    hierarchySearch,
    hierarchyBody,
    hierarchyActions,
    viewport,
    canvasHost,
    overlay,
    breadcrumbs,
    viewportTools,
    viewportBadges,
    fallback,
    inspectorPanel,
    inspectorBody,
    rail,
    railScope,
    railValue,
    railStatus,
    railMarkers,
    railSlider,
    railControls,
    simBar,
    simControls,
    simToggles,
    simStatus,
    hierarchyToggle,
    inspectorToggle,
    dialogLayer,
    liveRegion,
  };
}

/** Accessible confirmation dialog (focus-trapped, Escape-dismissable). */
export interface ConfirmOptions {
  title: string;
  message: string;
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'neutral' | 'danger';
}

export function confirmDialog(refs: ShellRefs, options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const confirmBtn = button(options.confirmLabel ?? 'CONFIRM', {
      class:
        options.tone === 'danger'
          ? 'sktc-btn sktc-btn--danger'
          : 'sktc-btn sktc-btn--primary',
    });
    const cancelBtn = button(options.cancelLabel ?? 'CANCEL', { class: 'sktc-btn' });

    const dialog = el('div', {
      class: 'sktc-dialog',
      role: 'alertdialog',
      ariaModal: 'true',
      ariaLabelledby: 'sktc-dialog-title',
      ariaDescribedby: 'sktc-dialog-desc',
    }, [
      el('h2', { id: 'sktc-dialog-title', text: options.title }),
      el('p', { id: 'sktc-dialog-desc', text: options.message }),
      options.details && options.details.length > 0
        ? el('ul', { class: 'sktc-dialog__list' }, options.details.map((d) => el('li', { text: d })))
        : null,
      el('div', { class: 'sktc-dialog__actions' }, [cancelBtn, confirmBtn]),
    ]);

    const backdrop = el('div', { class: 'sktc-dialog-backdrop' }, [dialog]);
    refs.dialogLayer.append(backdrop);

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const close = (result: boolean) => {
      backdrop.remove();
      document.removeEventListener('keydown', onKey, true);
      previouslyFocused?.focus?.();
      resolve(result);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(false);
        return;
      }
      if (event.key === 'Tab') {
        const focusables = [cancelBtn, confirmBtn];
        const index = focusables.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault();
        const next = event.shiftKey
          ? focusables[(index - 1 + focusables.length) % focusables.length]!
          : focusables[(index + 1) % focusables.length]!;
        next.focus();
      }
    };

    document.addEventListener('keydown', onKey, true);
    cancelBtn.addEventListener('click', () => close(false));
    confirmBtn.addEventListener('click', () => close(true));
    backdrop.addEventListener('mousedown', (event) => {
      if (event.target === backdrop) close(false);
    });
    confirmBtn.focus();
  });
}

/** Non-blocking modal for help / import errors. */
export function infoDialog(refs: ShellRefs, title: string, body: Node[]): Promise<void> {
  return new Promise((resolve) => {
    const closeBtn = button('CLOSE', { class: 'sktc-btn sktc-btn--primary' });
    const dialog = el('div', {
      class: 'sktc-dialog',
      role: 'dialog',
      ariaModal: 'true',
      ariaLabel: title,
    }, [el('h2', { text: title }), ...body, el('div', { class: 'sktc-dialog__actions' }, [closeBtn])]);
    const backdrop = el('div', { class: 'sktc-dialog-backdrop' }, [dialog]);
    refs.dialogLayer.append(backdrop);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const close = () => {
      backdrop.remove();
      document.removeEventListener('keydown', onKey, true);
      previouslyFocused?.focus?.();
      resolve();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKey, true);
    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('mousedown', (event) => {
      if (event.target === backdrop) close();
    });
    closeBtn.focus();
  });
}
