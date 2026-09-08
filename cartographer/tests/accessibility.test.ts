// @vitest-environment jsdom
/**
 * Accessibility contract.
 *
 * The hierarchy must be operable without a pointer, every control must have an
 * accessible name, dialogs must trap focus and restore it, and no essential
 * operation may exist only inside the WebGL canvas.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { startEditor, type EditorHandle } from '../src/app/main';
import { createDemoProject } from '../src/core/demo';

let handle: EditorHandle | undefined;
let mount: HTMLElement | undefined;

const boot = () => {
  mount = document.createElement('div');
  document.body.append(mount);
  handle = startEditor({
    mount,
    project: createDemoProject(),
    headless: true,
    reducedMotion: true,
    memoryStorage: true,
  });
  return handle;
};

afterEach(() => {
  handle?.destroy();
  handle = undefined;
  mount?.remove();
  mount = undefined;
  document.body.innerHTML = '';
});

const q = (selector: string) => mount!.querySelector(selector);
const all = (selector: string) => [...mount!.querySelectorAll<HTMLElement>(selector)];
const byLabel = (text: string) =>
  all('button').find((b) => b.textContent?.trim() === text) as HTMLButtonElement | undefined;
const key = (target: Element, k: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
const dialog = () => q('.sktc-dialog') as HTMLElement | null;

describe('accessible hierarchy', () => {
  it('exposes an ARIA tree with levels, expansion, and selection', () => {
    boot();
    expect(q('#sktc-hierarchy [role="tree"], #sktc-hierarchy ul[role="group"], #sktc-hierarchy ul')).toBeTruthy();
    const rows = all('#sktc-hierarchy [role="treeitem"]');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.getAttribute('aria-level')).toBe('1');
    expect(rows[0]!.getAttribute('aria-selected')).toBe('false');
    // A row with children must advertise its expansion state.
    const expandable = rows.find((row) => row.hasAttribute('aria-expanded'));
    expect(expandable).toBeTruthy();
    expect(['true', 'false']).toContain(expandable!.getAttribute('aria-expanded'));
  });

  it('is fully keyboard operable', () => {
    const editor = boot();
    const store = editor.store;
    const rows = () => all('#sktc-hierarchy [role="treeitem"]');

    (rows()[0] as HTMLElement).focus();
    expect(document.activeElement).toBe(rows()[0]);

    // Down / up move the roving focus.
    key(document.activeElement!, 'ArrowDown');
    expect(document.activeElement).toBe(rows()[1]);
    key(document.activeElement!, 'ArrowUp');
    expect(document.activeElement).toBe(rows()[0]);

    // Right expands, then moves into the child.
    const first = rows()[0]!;
    key(first, 'ArrowRight');
    expect(store.ui.expandedIds).toContain(first.getAttribute('data-id') ?? '');
    key(rows()[0]!, 'ArrowRight');
    expect(document.activeElement).toBe(rows()[1]);

    // Left collapses an expanded branch.
    rows()[0]!.focus();
    key(rows()[0]!, 'ArrowLeft');
    expect(store.ui.expandedIds).not.toContain(rows()[0]!.getAttribute('data-id') ?? '');

    // Home / End jump to the ends of the list.
    key(document.activeElement!, 'End');
    expect(document.activeElement).toBe(rows()[rows().length - 1]);
    key(document.activeElement!, 'Home');
    expect(document.activeElement).toBe(rows()[0]);

    // Enter selects.
    key(rows()[0]!, 'Enter');
    expect(store.selectionId).toBe(rows()[0]!.getAttribute('data-id'));
    expect(rows()[0]!.getAttribute('aria-selected')).toBe('true');
  });

  it('filters with a labelled search field', () => {
    boot();
    const search = q('#sktc-hierarchy input[type="search"]') as HTMLInputElement;
    expect(search.getAttribute('aria-label') || search.getAttribute('placeholder')).toBeTruthy();
    expect(search.type).toBe('search');
  });
});

describe('accessible dialogs', () => {
  it('announces itself, traps Tab, and restores focus on close', async () => {
    boot();
    const opener = byLabel('EDIT PRESETS')!;
    opener.focus();
    opener.click();
    await new Promise((r) => setTimeout(r, 0));

    const dlg = dialog()!;
    expect(dlg.getAttribute('role')).toBe('dialog');
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(dlg.getAttribute('aria-label')).toContain('EDIT ERA PRESETS');

    // Tab cycles inside the dialog rather than escaping to the page.
    const focusables = [...dlg.querySelectorAll<HTMLElement>('input, select, textarea, button')];
    expect(focusables.length).toBeGreaterThan(2);
    focusables[0]!.focus();
    key(document.activeElement!, 'Tab');
    expect(dlg.contains(document.activeElement)).toBe(true);
    key(document.activeElement!, 'Tab');
    expect(dlg.contains(document.activeElement)).toBe(true);

    // Escape dismisses without writing, and focus returns to the opener.
    key(document.activeElement!, 'Escape');
    await new Promise((r) => setTimeout(r, 0));
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('labels the destructive confirmation as an alert dialog', async () => {
    const editor = boot();
    editor.store.select('moon-fallenstar-1');
    const row = all('#sktc-hierarchy [role="treeitem"]').find(
      (r) => r.getAttribute('data-id') === 'moon-fallenstar-1',
    );
    row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const deleteBtn = all('.sktc-tree-actions button').find(
      (b) => b.textContent?.trim() === 'DELETE',
    ) as HTMLButtonElement;
    deleteBtn.click();
    await new Promise((r) => setTimeout(r, 0));
    const dlg = dialog()!;
    expect(dlg.getAttribute('role')).toBe('alertdialog');
    expect(dlg.querySelector('#sktc-dialog-title')?.textContent).toBe('DELETE RECORD');
    expect(dlg.querySelector('#sktc-dialog-desc')?.textContent).toContain('FALLENSTAR PRIME I');
    expect(dlg.getAttribute('aria-labelledby')).toBe('sktc-dialog-title');
  });
});

describe('named controls and live regions', () => {
  it('gives every button an accessible name', () => {
    boot();
    const unnamed = all('button').filter((button) => {
      const text = button.textContent?.trim() ?? '';
      const label = button.getAttribute('aria-label') ?? '';
      const title = button.getAttribute('title') ?? '';
      return text === '' && label === '' && title === '';
    });
    expect(unnamed.map((b) => b.outerHTML.slice(0, 80))).toEqual([]);
  });

  it('exposes a polite live region and a status badge', () => {
    boot();
    const live = q('#sktc-announce')!;
    expect(live.getAttribute('role')).toBe('status');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(q('#sktc-save-state')?.getAttribute('role')).toBe('status');
  });

  it('labels landmarks, viewport, and rail', () => {
    boot();
    expect(q('main')?.getAttribute('aria-label')).toContain('viewport');
    expect(q('.sktc-rail')?.getAttribute('aria-label')).toBe('Historical time');
    expect(q('.sktc-sim')?.getAttribute('aria-label')).toBe('Orbital simulation');
    expect(q('#sktc-hierarchy')?.getAttribute('aria-label')).toBe('Hierarchy');
    expect(q('#sktc-inspector')?.getAttribute('aria-label')).toBe('Inspector');
    expect(q('.sktc-canvas-host')?.getAttribute('tabindex')).toBe('0');
    expect(q('.sktc-canvas-host')?.getAttribute('aria-label')).toBeTruthy();
  });

  it('reports the historical value as accessible text, not canvas pixels', () => {
    boot();
    const slider = q('.sktc-rail input[type="range"]') as HTMLInputElement;
    expect(slider.getAttribute('aria-valuetext')).toBeTruthy();
    expect(slider.getAttribute('aria-label')).toBeTruthy();
    const markers = all('.sktc-marker');
    expect(markers.length).toBeGreaterThan(3);
    for (const marker of markers) {
      expect(marker.tagName).toBe('BUTTON');
      expect(marker.getAttribute('aria-pressed')).toMatch(/^(true|false)$/);
      expect(marker.getAttribute('title')).toBeTruthy();
    }
  });

  it('marks destructive history in text as well as colour', () => {
    boot();
    handle!.store.select('star-aureal');
    handle!.store.setUi({ railScopeId: 'star-aureal' });
    const events = q('.sktc-rail__events')!;
    expect(events.getAttribute('role')).toBe('group');
    expect(events.textContent).toMatch(/collapse/i);
  });

  it('keeps a visible control for every canvas-only affordance', () => {
    boot();
    for (const label of ['FOCUS', 'ENTER', 'UP', 'RESET']) {
      const found = all('button').some((b) => (b.getAttribute('title') ?? '').toUpperCase().includes(label));
      expect(found, `no visible control for ${label}`).toBe(true);
    }
  });
});
