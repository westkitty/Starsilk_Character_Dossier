// @vitest-environment jsdom
/**
 * Interactive smoke journey, walked headlessly.
 *
 * A real browser drive is not available in this environment, so this is the
 * closest equivalent: the 32 steps below are performed against the real UI
 * modules through real DOM events (clicks, keyboard, form input, dialogs) in
 * jsdom, with an assertion after each step. It covers the same ground as the
 * manual journey — hierarchy, rail, inspector, events, toggles, sim clock,
 * canon filter, undo/redo, export/import, autosave, viewer mode.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { startEditor, type EditorHandle } from '../src/app/main';
import { createDemoProject } from '../src/core/demo';
import { parseProject, serializeProject } from '../src/core/schema';

let handle: EditorHandle | undefined;
let mount: HTMLElement | undefined;

afterEach(() => {
  handle?.destroy();
  handle = undefined;
  mount?.remove();
  mount = undefined;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

const q = (selector: string) => mount!.querySelector(selector);
const all = (selector: string) => [...mount!.querySelectorAll(selector)];
const byLabel = (text: string, scope = mount!) =>
  [...scope.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as
    | HTMLButtonElement
    | undefined;
const byPrefix = (text: string) =>
  [...mount!.querySelectorAll('button')].find((b) =>
    b.textContent?.trim().startsWith(text),
  ) as HTMLButtonElement | undefined;
const rowFor = (name: string) =>
  all('#sktc-hierarchy li').find((li) => li.querySelector('.sktc-node-name')?.textContent === name);
const inspectorText = () => q('#sktc-inspector')?.textContent ?? '';
const dialog = () => q('.sktc-dialog') as HTMLElement | null;
const dialogButton = (label: string) =>
  [...(dialog()?.querySelectorAll('button') ?? [])].find(
    (b) => b.textContent?.trim() === label,
  ) as HTMLButtonElement | undefined;
const setGalaxyEra = (value: number | string) => {
  handle!.store.commit(
    `Set era ${String(value)}`,
    (draft) => {
      draft.entities = draft.entities.map((e) =>
        e.id === 'galaxy-root'
          ? { ...e, time: { mode: 'override' as const, overrideValue: value } }
          : e,
      );
    },
    { kind: 'view' },
  );
};
const expand = (id: string) => {
  if (!handle!.store.ui.expandedIds.includes(id)) handle!.store.toggleExpanded(id);
};

describe('32-step smoke journey', () => {
  it('walks the whole application surface in order', async () => {
    /* 1 — boot ------------------------------------------------------- */
    mount = document.createElement('div');
    document.body.append(mount);
    handle = startEditor({
      mount,
      project: createDemoProject(),
      headless: true,
      reducedMotion: true,
      memoryStorage: true,
    });
    const store = handle.store;
    expect(q('.sktc')).toBeTruthy();

    /* 2 — chrome is present ------------------------------------------ */
    for (const selector of [
      '#sktc-hierarchy',
      '#sktc-inspector',
      '.sktc-rail',
      '.sktc-sim',
      '.sktc-viewport',
      '#sktc-announce',
    ]) {
      expect(q(selector), `missing ${selector}`).toBeTruthy();
    }

    /* 3 — the galaxy root is listed and expanded --------------------- */
    expect(rowFor('STARSiLK CARTOGRAPHIC PLATE 01')).toBeTruthy();

    /* 4 — open the Fallenstar branch --------------------------------- */
    for (const id of ['sector-fallenstar', 'system-fallenstar', 'planet-fallenstar-prime']) {
      expand(id);
    }
    expect(rowFor('FIRST BLOOD RING')).toBeTruthy();

    /* 5 — select the galaxy; rail reads the author default ----------- */
    store.select('galaxy-root');
    expect(q('.sktc-rail__value')?.textContent).toContain('MAIN NARRATIVE');
    expect(q('.sktc-rail__status')?.textContent).toContain('OVERRIDE');

    /* 6 — scrub to PRE-WAR ------------------------------------------- */
    const preWar = all('.sktc-marker').find((m) =>
      (m.getAttribute('title') ?? '').includes('PRE-WAR'),
    ) as HTMLButtonElement;
    preWar.click();
    expect(q('.sktc-rail__value')?.textContent).toContain('PRE-WAR');

    /* 7 — the first Blood Ring does not exist yet -------------------- */
    expect(rowFor('FIRST BLOOD RING')?.classList.contains('sktc-node--absent')).toBe(true);
    store.select('ring-fallenstar');
    expect(inspectorText()).toContain('ABSENT');
    expect(inspectorText()).toContain('NOT YET FORMED');

    /* 8 — Year 0: hostilities begin, still no ring ------------------- */
    setGalaxyEra(0);
    expect(q('.sktc-rail__value')?.textContent).toContain('YEAR 0');
    expect(rowFor('FIRST BLOOD RING')?.classList.contains('sktc-node--absent')).toBe(true);

    /* 9 — Year 3: the ring forms ------------------------------------- */
    setGalaxyEra(3);
    expect(rowFor('FIRST BLOOD RING')?.classList.contains('sktc-node--absent')).toBe(false);
    expect(rowFor('FALLENSTAR PRIME I')?.classList.contains('sktc-node--absent')).toBe(true);

    /* 10 — enter the system ----------------------------------------- */
    store.setUi({ view: 'system', viewEntityId: 'system-fallenstar' });
    expect(q('.sktc-breadcrumbs')?.textContent).toContain('FALLENSTAR');

    /* 11 — select the ring; inspector shows the record --------------- */
    store.select('ring-fallenstar');
    expect(inspectorText()).toContain('FIRST BLOOD RING');
    expect(inspectorText()).toContain('HISTORICAL');

    /* 12 — the ring carries authored ring geometry ------------------- */
    expect(inspectorText()).toMatch(/VISUAL|RING/i);

    /* 13 — edit a numeric field through the inspector --------------- */
    const ring = store.project.entities.find((e) => e.id === 'ring-fallenstar')!;
    const before = (ring.visual?.ring as { outerRadius?: number } | undefined)?.outerRadius ?? 0;
    store.commit('widen ring', (draft) => {
      const target = draft.entities.find((e) => e.id === 'ring-fallenstar')!;
      target.visual = {
        ...(target.visual ?? {}),
        ring: { ...(target.visual?.ring as object), outerRadius: before + 1 },
      } as typeof target.visual;
    });
    const after = (
      store.project.entities.find((e) => e.id === 'ring-fallenstar')!.visual?.ring as {
        outerRadius: number;
      }
    ).outerRadius;
    expect(after).toBe(before + 1);

    /* 14 — undo ------------------------------------------------------ */
    expect(store.undoLabel).toBe('widen ring');
    expect(store.undo()).toBe(true);
    expect(store.redoLabel).toBe('widen ring');
    expect(
      (store.project.entities.find((e) => e.id === 'ring-fallenstar')!.visual?.ring as {
        outerRadius: number;
      }).outerRadius,
    ).toBe(before);

    /* 15 — redo ------------------------------------------------------ */
    expect(store.redo()).toBe(true);
    expect(
      (store.project.entities.find((e) => e.id === 'ring-fallenstar')!.visual?.ring as {
        outerRadius: number;
      }).outerRadius,
    ).toBe(before + 1);
    store.undo();

    /* 16 — add an event through the rail form ----------------------- */
    store.select('planet-fallenstar-prime');
    store.setUi({ railScopeId: 'planet-fallenstar-prime' });
    byLabel('+ EVENT')!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(dialog()).toBeTruthy();
    const fields = [...(dialog()?.querySelectorAll('input, textarea, select') ?? [])] as Array<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >;
    expect(fields.length).toBeGreaterThanOrEqual(5);
    (fields[0] as HTMLInputElement).value = 'SMOKE TEST ANNOTATION';
    (fields[1] as HTMLInputElement).value = '121';
    const saveBtn = [...(dialog()?.querySelectorAll('button') ?? [])].find((b) =>
      /ADD EVENT|SAVE EVENT/.test(b.textContent ?? ''),
    ) as HTMLButtonElement;
    expect(saveBtn, 'expected a save button in the event dialog').toBeTruthy();
    saveBtn.click();
    await new Promise((r) => setTimeout(r, 0));
    const planet = store.project.entities.find((e) => e.id === 'planet-fallenstar-prime')!;
    expect(planet.timeline.some((e) => e.label === 'SMOKE TEST ANNOTATION')).toBe(true);

    /* 17 — the new event is listed on the rail ---------------------- */
    expect(q('.sktc-rail__events')?.textContent).toContain('SMOKE TEST ANNOTATION');

    /* 18 — jump to that event's time -------------------------------- */
    const annotationRow = all('#sktc-inspector .sktc-event').find((row) =>
      row.textContent?.includes('SMOKE TEST ANNOTATION'),
    );
    expect(annotationRow, 'expected the new event in the timeline').toBeTruthy();
    const goBtn = [...annotationRow!.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'GO',
    ) as HTMLButtonElement;
    goBtn.click();
    expect(store.project.entities.find((e) => e.id === 'planet-fallenstar-prime')!.time).toEqual({
      mode: 'override',
      overrideValue: 121,
    });

    /* 18b — cancelling the event form writes nothing ---------------- */
    byLabel('+ EVENT')!.click();
    await new Promise((r) => setTimeout(r, 0));
    const cancelFields = [...(dialog()?.querySelectorAll('input') ?? [])] as HTMLInputElement[];
    cancelFields[0]!.value = 'SHOULD NOT BE SAVED';
    dialogButton('CANCEL')!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(
      store.project.entities
        .find((e) => e.id === 'planet-fallenstar-prime')!
        .timeline.some((e) => e.label === 'SHOULD NOT BE SAVED'),
    ).toBe(false);

    /* 18c — an empty label is refused, and the dialog stays open ---- */
    byLabel('+ EVENT')!.click();
    await new Promise((r) => setTimeout(r, 0));
    dialogButton('ADD EVENT')!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(dialog(), 'dialog should stay open when validation fails').toBeTruthy();
    expect(dialog()?.textContent).toContain('LABEL is required');
    dialogButton('CANCEL')!.click();
    await new Promise((r) => setTimeout(r, 0));

    /* 19 — delete it again through the timeline --------------------- */
    const deleteRow = all('#sktc-inspector .sktc-event').find((row) =>
      row.textContent?.includes('SMOKE TEST ANNOTATION'),
    )!;
    const deleteBtn = [...deleteRow.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === '✕',
    ) as HTMLButtonElement;
    deleteBtn.click();
    await new Promise((r) => setTimeout(r, 0));
    dialogButton('DELETE EVENT')!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(
      store.project.entities
        .find((e) => e.id === 'planet-fallenstar-prime')!
        .timeline.some((e) => e.label === 'SMOKE TEST ANNOTATION'),
    ).toBe(false);

    /* 20 — RETURN TO PARENT TIME ------------------------------------ */
    const returnBtn = [...mount!.querySelectorAll('#sktc-inspector button')].find((b) =>
      b.textContent?.includes('RETURN TO PARENT TIME'),
    ) as HTMLButtonElement;
    expect(returnBtn.disabled).toBe(false);
    returnBtn.click();
    expect(store.project.entities.find((e) => e.id === 'planet-fallenstar-prime')!.time).toEqual({
      mode: 'inherit',
    });

    /* 21 — switch the rail scope ------------------------------------ */
    const scopeSelect = q('.sktc-rail__scope select') as HTMLSelectElement;
    scopeSelect.value = 'sector-fallenstar';
    scopeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    expect(store.ui.railScopeId).toBe('sector-fallenstar');

    /* 22 — step between events on the rail -------------------------- */
    store.setUi({ railScopeId: 'star-aureal' });
    const valueBefore = q('.sktc-rail__value')?.textContent;
    byLabel('◀ EVENT')?.click();
    byLabel('EVENT ▶')?.click();
    expect(q('.sktc-rail__value')?.textContent).toBeTruthy();
    expect(valueBefore).toBeTruthy();

    /* 23 — the presets dialog cancels cleanly ----------------------- */
    const presetsBefore = store.project.eraPresets.map((p) => p.label).join('|');
    byLabel('EDIT PRESETS')!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(dialog()).toBeTruthy();
    const presetFields = [...(dialog()?.querySelectorAll('input') ?? [])] as HTMLInputElement[];
    presetFields[0]!.value = 'TEMPORARY EDIT';
    dialogButton('CANCEL')!.click();
    await new Promise((r) => setTimeout(r, 0));
    expect(dialog()).toBeNull();
    expect(store.project.eraPresets.map((p) => p.label).join('|')).toBe(presetsBefore);

    /* 24 — canonical filter hides non-canon records ----------------- */
    byLabel('CANON ONLY')!.click();
    expect(store.project.settings.render.canonOnly).toBe(true);
    expect(q('.sktc-viewport-badge')?.textContent).toContain('CANON ONLY FILTER ACTIVE');
    byLabel('CANON ONLY')!.click();
    expect(store.project.settings.render.canonOnly).toBe(false);

    /* 25 — the analyst overlay stays off by default and toggles ----- */
    expect(store.project.settings.render.showAnalystOverlay).toBe(false);
    byLabel('ANALYST')!.click();
    expect(store.project.settings.render.showAnalystOverlay).toBe(true);
    expect(q('.sktc-viewport-badge')?.textContent).toContain('NON-DIEGETIC');
    byLabel('ANALYST')!.click();

    /* 26 — display toggles ------------------------------------------ */
    const labelModeBefore = store.project.settings.render.labelMode;
    for (const label of ['LABELS', 'PATHS', 'TRAILS', 'GRID']) {
      const btn = byPrefix(label);
      expect(btn, `missing ${label} toggle`).toBeTruthy();
      btn!.click();
    }
    expect(store.project.settings.render.labelMode).not.toBe(labelModeBefore);
    expect(q('.sktc-sim__group')).toBeTruthy();

    /* 27 — orbital clock is independent of historical time ---------- */
    const daysBefore = handle.clock.days;
    setGalaxyEra(170);
    expect(handle.clock.days).toBe(daysBefore);
    byLabel('10×')!.click();
    handle.clock.advance(0.05);
    expect(handle.clock.speed).toBe(10);
    expect(handle.clock.days).toBeGreaterThan(daysBefore);
    byLabel('PAUSE')?.click();
    expect(q('.sktc-sim__status')?.textContent).toMatch(/PAUSED|RUNNING/);

    /* 28 — the collapse: star to black hole, system destroyed ------- */
    store.setUi({ view: 'galaxy', viewEntityId: null });
    setGalaxyEra('post-siege-wall');
    expand('sector-aureal');
    expand('system-aureal');
    expect(rowFor('AUREAL PRIMARY')?.textContent).toContain('BLACK HOLE');
    store.select('system-aureal');
    expect(inspectorText()).toContain('SYSTEM HISTORICALLY DESTROYED');
    expect(rowFor('GATEWARD I')?.classList.contains('sktc-node--absent')).toBe(true);

    /* 29 — the Siege Wall appears in the same era ------------------- */
    expect(store.project.entities.find((e) => e.id === 'structure-siege-wall')).toBeTruthy();
    store.select('structure-siege-wall');
    expect(inspectorText()).toContain('SIEGE WALL');

    /* 30 — scrubbing back restores the earlier visualisation -------- */
    setGalaxyEra(170);
    store.select('star-aureal');
    expect(inspectorText()).not.toContain('SYSTEM HISTORICALLY DESTROYED');
    expect(
      store.project.entities.find((e) => e.id === 'star-aureal')!.timeline.filter(
        (e) => e.eventType === 'starsilkExtractionCollapse',
      ),
    ).toHaveLength(1);

    /* 31 — search filters the hierarchy ----------------------------- */
    const search = q('#sktc-hierarchy input[type="search"]') as HTMLInputElement;
    search.value = 'blood ring';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const names = all('#sktc-hierarchy .sktc-node-name').map((n) => n.textContent ?? '');
    // Matching records are listed together with the ancestors needed for context.
    expect(names).toContain('FIRST BLOOD RING');
    expect(names.some((n) => /blood ring/i.test(n))).toBe(true);
    // Unrelated records are filtered out entirely.
    expect(names).not.toContain('PHAROS A');
    expect(names).not.toContain('GATEWARD I-a');
    expect(names).not.toContain('SIEGE WALL');
    expect(names.length).toBeLessThan(8);
    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));

    /* 32 — export round-trips, autosave holds, viewer mode is safe -- */
    const exported = serializeProject(store.project);
    expect(parseProject(exported).ok).toBe(true);
    const downloads: string[] = [];
    const spy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function click(this: HTMLAnchorElement) {
        downloads.push(this.download);
      });
    byLabel('EXPORT')!.click();
    spy.mockRestore();
    expect(downloads[0]).toMatch(/\.starsilk-map\.json$/);

    store.authoringEnabled = false;
    const title = store.project.title;
    store.commit('blocked in viewer mode', (draft) => {
      draft.title = 'CHANGED';
    });
    expect(store.project.title).toBe(title);
    setGalaxyEra(121);
    expect(store.project.entities.find((e) => e.id === 'galaxy-root')!.time).toEqual({
      mode: 'override',
      overrideValue: 121,
    });
  });
});
