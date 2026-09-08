// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { startEditor, type EditorHandle } from '../src/app/main';
import { createDemoProject } from '../src/core/demo';
import { parseProject } from '../src/core/schema';

/** Headless integration smoke: drives the real UI modules against jsdom. */
function boot() {
  const mount = document.createElement('div');
  document.body.append(mount);
  const handle = startEditor({
    mount,
    project: createDemoProject(),
    headless: true,
    reducedMotion: true,
    memoryStorage: true,
  });
  const q = (selector: string) => mount.querySelector(selector);
  const all = (selector: string) => [...mount.querySelectorAll(selector)];
  return { mount, handle, q, all };
}

const nodeFor = (all: (s: string) => Element[], name: string) =>
  all('#sktc-hierarchy li').find((node) => node.querySelector('.sktc-node-name')?.textContent === name);

let handle: EditorHandle | undefined;

afterEach(() => {
  handle?.destroy();
  handle = undefined;
  document.body.innerHTML = '';
});

describe('editor integration (headless)', () => {
  it('mounts the shell, hierarchy, rail, and inspector', () => {
    const ui = boot();
    handle = ui.handle;
    expect(ui.q('.sktc')).toBeTruthy();
    expect(ui.q('.sktc-viewport')).toBeTruthy();
    expect(ui.q('.sktc-rail__controls')).toBeTruthy();
    expect(ui.q('#sktc-inspector')).toBeTruthy();
    expect(ui.q('#sktc-announce')?.getAttribute('aria-live')).toBe('polite');
    expect(ui.q('#sktc-save-state')?.getAttribute('role')).toBe('status');
    // A fresh project seeds with the root expanded.
    expect(ui.all('#sktc-hierarchy li').length).toBeGreaterThanOrEqual(1);
    for (const id of ['sector-fallenstar', 'sector-pharos', 'sector-aureal', 'sector-halven']) {
      ui.handle.store.toggleExpanded(id);
    }
    expect(ui.all('#sktc-hierarchy li').length).toBeGreaterThan(5);
  });

  it('marks the Blood Ring absent before Year 3 and present from Year 3', () => {
    const ui = boot();
    handle = ui.handle;
    const store = ui.handle.store;

    store.setUi({ view: 'galaxy' });
    store.setUi({ railScopeId: 'ring-fallenstar' });

    store.select('ring-fallenstar');
    expect(ui.q('#sktc-inspector')?.textContent).toContain('HISTORICAL');

    const setGalaxy = (time: number) => {
      store.commit(`Set galaxy time ${time}`, (draft) => {
        draft.entities = draft.entities.map((e) =>
          e.id === 'galaxy-root'
            ? { ...e, time: { mode: 'override' as const, overrideValue: time } }
            : e,
        );
      });
    };

    setGalaxy(0);
    const absent = nodeFor(ui.all, 'FIRST BLOOD RING');
    expect(absent?.classList.contains('sktc-node--absent')).toBe(true);
    expect(absent?.textContent).toContain('ABSENT');
    expect(ui.q('#sktc-inspector')?.textContent).toContain('NOT YET FORMED');

    setGalaxy(3);
    const present = nodeFor(ui.all, 'FIRST BLOOD RING');
    expect(present?.classList.contains('sktc-node--absent')).toBe(false);
    expect(present?.textContent).toContain('Y3');
    expect(present?.getAttribute('title')).toBeNull();
    expect((present?.querySelector('.sktc-node-tag') as HTMLElement).title).toMatch(/inherited|override/i);
  });

  it('shows the stellar collapse state in the hierarchy and inspector', () => {
    const ui = boot();
    handle = ui.handle;
    const store = ui.handle.store;

    store.toggleExpanded('sector-aureal');
    store.commit('post-war', (draft) => {
      draft.entities = draft.entities.map((e) =>
        e.id === 'galaxy-root'
          ? { ...e, time: { mode: 'override' as const, overrideValue: 'post-siege-wall' as const } }
          : e,
      );
    });
    store.select('system-aureal');
    store.toggleExpanded('system-aureal');
    const text = ui.q('#sktc-inspector')?.textContent ?? '';
    expect(text).toContain('SYSTEM HISTORICALLY DESTROYED');
    const starNode = nodeFor(ui.all, 'AUREAL PRIMARY');
    expect(starNode?.textContent).toContain('BLACK HOLE');
  });

  it('keeps sibling sectors on the galaxy era while an override branch stays pinned', () => {
    const ui = boot();
    handle = ui.handle;
    const store = ui.handle.store;
    store.commit('galaxy to year 0', (draft) => {
      draft.entities = draft.entities.map((e) =>
        e.id === 'galaxy-root'
          ? { ...e, time: { mode: 'override' as const, overrideValue: 0 } }
          : e,
      );
    });
    const halven = nodeFor(ui.all, "HAL'VEN CLUSTER");
    expect(halven?.textContent).toContain('Y121');
    const pharos = nodeFor(ui.all, 'PHAROS NEBULA');
    expect(pharos?.textContent).toContain('Y0');
  });

  it('undo and redo restore the previous historical state', () => {
    const ui = boot();
    handle = ui.handle;
    const store = ui.handle.store;

    store.commit('override galaxy', (draft) => {
      draft.entities = draft.entities.map((e) =>
        e.id === 'galaxy-root'
          ? { ...e, time: { mode: 'override' as const, overrideValue: 170 } }
          : e,
      );
    });
    expect(nodeFor(ui.all, 'PHAROS NEBULA')?.textContent).toContain('Y170');

    store.undo();
    expect(nodeFor(ui.all, 'PHAROS NEBULA')?.textContent).toContain('MAIN NARRATIVE');

    store.redo();
    expect(nodeFor(ui.all, 'PHAROS NEBULA')?.textContent).toContain('Y170');
  });

  it('exports a schema-valid project through the toolbar action', async () => {
    const ui = boot();
    handle = ui.handle;
    // Clicking export must not throw (the download itself is a no-op in jsdom).
    expect(() =>
      ui.q('#sktc-export')?.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    ).not.toThrow();

    // The document itself must round-trip.
    const parsed = parseProject(JSON.stringify(ui.handle.projectSnapshot()));
    expect(parsed.ok).toBe(true);
    expect(parsed.project?.entities.length).toBeGreaterThan(20);
  });

  it('keeps the orbital clock independent of historical time', () => {
    const ui = boot();
    handle = ui.handle;
    const store = ui.handle.store;
    const before = ui.handle.clock.days;
    store.commit('change era', (draft) => {
      draft.entities = draft.entities.map((e) =>
        e.id === 'galaxy-root'
          ? { ...e, time: { mode: 'override' as const, overrideValue: 3 } }
          : e,
      );
    });
    expect(ui.handle.clock.days).toBe(before);
    ui.handle.clock.setSpeed(10);
    ui.handle.clock.advance(0.05);
    expect(ui.handle.clock.days).toBeGreaterThan(before);
    expect(ui.handle.clock.speed).toBe(10);
  });

  it('reloads the demo plate through the store without throwing', () => {
    const ui = boot();
    handle = ui.handle;
    expect(() => ui.handle.store.loadProject(createDemoProject())).not.toThrow();
    expect(ui.all('#sktc-hierarchy li').length).toBeGreaterThanOrEqual(1);
  });

  it('drives historical time from the rail preset markers', () => {
    const ui = boot();
    handle = ui.handle;
    const store = ui.handle.store;

    const marker = ui
      .all('.sktc-marker')
      .find((m) => (m.getAttribute('title') ?? '').includes('YEAR 3')) as HTMLButtonElement | undefined;
    expect(marker, 'expected a YEAR 3 preset marker on the rail').toBeTruthy();
    marker!.click();

    const galaxy = store.project.entities.find((e) => e.id === 'galaxy-root')!;
    expect(galaxy.time?.mode).toBe('override');
    expect(galaxy.time?.overrideValue).toBe(3);
    expect(ui.q('.sktc-rail__value')?.textContent).toContain('YEAR 3');
    expect(ui.q('.sktc-rail__status')?.textContent).toContain('OVERRIDE');
    expect(ui.q('#sktc-hierarchy')?.textContent).toContain('Y3');
  });

  it('scrubs the rail slider and reports the resolved era as accessible value text', () => {
    const ui = boot();
    handle = ui.handle;
    const slider = ui.q('.sktc-rail input[type="range"]') as HTMLInputElement | null;
    expect(slider).toBeTruthy();
    const stops = Number(slider!.max) + 1;
    expect(stops).toBeGreaterThanOrEqual(6);

    slider!.value = String(stops - 1);
    slider!.dispatchEvent(new Event('input', { bubbles: true }));

    expect(ui.q('.sktc-rail__value')?.textContent).toBeTruthy();
    expect(slider!.getAttribute('aria-valuetext')).toBe(ui.q('.sktc-rail__value')?.textContent);
  });

  it('lists the authored events of the rail scope, including destructive ones', () => {
    const ui = boot();
    handle = ui.handle;
    const store = ui.handle.store;

    store.select('star-aureal');
    store.setUi({ railScopeId: 'star-aureal' });
    const events = ui.q('.sktc-rail__events');
    expect(events?.textContent).toMatch(/starsilk extraction/i);
    expect(events?.querySelector('.sktc-marker--destructive')).toBeTruthy();

    // Pinning a scope with no authored events shows the empty state.
    store.setUi({ railScopeId: 'sector-halven' });
    expect(ui.q('.sktc-rail__events')?.textContent).toContain('NO AUTHORED EVENTS ON THIS SCOPE');
    expect(ui.q('.sktc-rail__value')?.textContent).toContain('YEAR 121');
  });

  it('re-renders the time rail scope controls for the selection', () => {
    const ui = boot();
    handle = ui.handle;
    const store = ui.handle.store;
    store.setUi({ view: 'galaxy', railScopeId: null });
    store.select('system-fallenstar');
    const scope = ui.q('.sktc-rail__scope select') as HTMLSelectElement | null;
    expect(scope).toBeTruthy();
    const labels = [...(scope?.options ?? [])].map((o) => o.textContent ?? '');
    expect(labels.some((label) => label.includes('FALLENSTAR SYSTEM'))).toBe(true);
    expect(labels.some((label) => label.includes('SYSTEM ·'))).toBe(true);
  });
});
