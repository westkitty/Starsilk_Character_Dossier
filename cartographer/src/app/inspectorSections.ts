/**
 * Inspector sections beyond identity and canon: HISTORICAL · ORBIT · VISUAL · TIMELINE.
 *
 * Every control writes through `store.commit`, so each edit is undoable and
 * autosaved, and none of them touch Three.js. Authored physical values stay exactly
 * as written; only the *display* fields describe compressed render scale.
 */

import { entityById } from '../core/project';
import { absenceLabel, describeResolution, type ResolvedEntity } from '../core/resolve';
import { describeTime } from '../core/time';
import {
  CANON_STATUS_LABELS,
  ENTITY_TYPE_LABELS,
  EVENT_TYPE_LABELS,
  type Entity,
  type TimeValue,
} from '../core/types';
import type { ProjectStore } from '../core/store';
import { button, el, field, nextFieldId } from './dom';
import { checkboxInput, numberInput, section } from './inspector';
import { confirmDeleteEvent, openEventForm } from './eventForm';
import type { ShellRefs } from './shell';

export interface SectionContext {
  refs: ShellRefs;
  store: ProjectStore;
  resolution: Map<string, ResolvedEntity>;
}

const AUTHORING = (store: ProjectStore) => !store.authoringEnabled;

function patchEntity(
  store: ProjectStore,
  entityId: string,
  label: string,
  mutate: (entity: Entity) => void,
): void {
  store.commit(label, (draft) => {
    const target = entityById(draft, entityId);
    if (target) mutate(target);
  });
}

/* ------------------------------------------------------------------ *
 * HISTORICAL
 * ------------------------------------------------------------------ */

export function renderHistorical(ctx: SectionContext, entity: Entity): HTMLElement {
  const { store, resolution } = ctx;
  const state = resolution.get(entity.id);
  const project = store.project;

  const body: Node[] = [];
  if (!state) {
    body.push(el('p', { class: 'sktc-hint', text: 'No historical resolution available.' }));
  } else {
    const described = describeResolution(project, state);
    body.push(
      el('dl', { class: 'sktc-kv' }, [
        el('dt', { text: 'RESOLVED' }),
        el('dd', { text: described.value }),
        el('dt', { text: 'MODE' }),
        el('dd', { text: described.mode }),
        el('dt', { text: described.mode === 'OVERRIDE' ? 'SET ON' : 'INHERITED FROM' }),
        el('dd', { text: described.source }),
        el('dt', { text: 'STATE' }),
        el('dd', {
          text: state.present
            ? state.effectiveType === 'blackHole' && state.starCollapsed
              ? 'PRESENT — COLLAPSED'
              : 'PRESENT'
            : `ABSENT${state.absenceReason ? ` ${absenceLabel(state.absenceReason)}` : ''}`,
        }),
        el('dt', { text: 'TYPE NOW' }),
        el('dd', {
          text: ENTITY_TYPE_LABELS[state.effectiveType] ?? state.effectiveType.toUpperCase(),
        }),
        el('dt', { text: 'EVENTS' }),
        el('dd', {
          text: `${state.appliedEvents.length} applied · ${state.pendingEvents.length} pending`,
        }),
      ]),
    );

    if (state.starCollapsed) {
      body.push(
        el('p', {
          class: 'sktc-warning',
          text: 'STARSiLK EXTRACTION COLLAPSE — pulling Starsilk from the centre of a star collapses it immediately into a black hole and destroys its star system.',
        }),
      );
    }
    if (state.systemDestroyed) {
      body.push(
        el('p', {
          class: 'sktc-warning',
          text: 'SYSTEM HISTORICALLY DESTROYED — its worlds are absent at this era. Scrubbing backwards restores the earlier visualisation only; nothing is resurrected.',
        }),
      );
    }
    if (!state.present && state.absenceReason === 'before-creation') {
      body.push(
        el('p', {
          class: 'sktc-note',
          text: 'This record has a creation event later than the resolved era, so it does not exist yet here.',
        }),
      );
    }
  }

  const returnBtn = button('RETURN TO PARENT TIME', {
    title: 'Remove this entity’s override and inherit from its parent again',
    class: 'sktc-btn sktc-btn--wide',
  });
  returnBtn.disabled = AUTHORING(store) || entity.parentId === null || state?.resolution.mode !== 'override';
  returnBtn.addEventListener('click', () => {
    store.commit(`Return ${entity.name} to parent time`, (draft) => {
      const target = entityById(draft, entity.id);
      if (target) target.time = { mode: 'inherit' };
    });
    store.setStatus(`${entity.name.toUpperCase()} now inherits its parent’s historical time.`, 'neutral');
  });

  const scopeBtn = button('EDIT THIS SCOPE ON THE RAIL', {
    class: 'sktc-btn sktc-btn--wide',
    title: 'Point the historical rail at this entity',
  });
  scopeBtn.addEventListener('click', () => {
    store.select(entity.id);
    store.setUi({ railScopeId: entity.id });
  });

  body.push(returnBtn, scopeBtn);
  return section('HISTORICAL', body);
}

/* ------------------------------------------------------------------ *
 * ORBIT
 * ------------------------------------------------------------------ */

export function renderOrbit(ctx: SectionContext, entity: Entity): HTMLElement | null {
  const { store } = ctx;
  if (entity.type === 'galaxy' || entity.type === 'starfield' || entity.type === 'largeScaleStructure') {
    return renderPosition(ctx, entity);
  }
  const orbit = entity.orbit;
  if (!orbit) return renderPosition(ctx, entity);

  const num = (
    key: keyof typeof orbit,
    label: string,
    hint: string,
    options: { step?: number; min?: number } = {},
  ) =>
    field(
      nextFieldId('orb'),
      label,
      numberInput(
        orbit[key],
        (value) =>
          patchEntity(store, entity.id, `Edit ${label}`, (target) => {
            if (target.orbit) target.orbit[key] = value;
          }),
        { step: options.step ?? 0.001, min: options.min, ariaLabel: label },
      ),
      hint,
    );

  const body: Node[] = [
    el('div', { class: 'sktc-row' }, [
      num('semiMajorAxis', 'SEMI-MAJOR AXIS', 'Authored physical distance.'),
      num('period', 'PERIOD', 'Authored orbital period (days).'),
    ]),
    el('div', { class: 'sktc-row' }, [
      num('eccentricity', 'ECCENTRICITY', '0 ≤ e < 1.', { step: 0.01, min: 0 }),
      num('inclination', 'INCLINATION', 'Degrees.', { step: 0.5 }),
    ]),
    el('div', { class: 'sktc-row' }, [
      num('ascendingNode', 'ASC. NODE', 'Longitude of ascending node, degrees.', { step: 1 }),
      num('argumentOfPeriapsis', 'ARG. PERIAPSIS', 'Degrees.', { step: 1 }),
    ]),
    el('div', { class: 'sktc-row' }, [
      num('meanAnomalyAtEpoch', 'MEAN ANOMALY', 'Degrees at epoch.', { step: 1 }),
      num('epoch', 'EPOCH', 'Day count the elements are quoted at.', { step: 1 }),
    ]),
    el('p', {
      class: 'sktc-note',
      text: 'AUTHORED VALUES · the renderer compresses distance for legibility and never writes back to these fields.',
    }),
  ];

  const positioned = renderPosition(ctx, entity);
  const orbitSection = section('ORBIT', body);
  const wrap = el('div', {}, [orbitSection]);
  if (positioned) wrap.append(positioned);
  return wrap;
}

function renderPosition(ctx: SectionContext, entity: Entity): HTMLElement | null {
  const { store } = ctx;
  if (!entity.position) return null;
  const axis = (key: 'x' | 'y' | 'z') =>
    field(
      nextFieldId('pos'),
      key.toUpperCase(),
      numberInput(
        entity.position![key],
        (value) =>
          patchEntity(store, entity.id, `Edit position ${key}`, (target) => {
            if (target.position) target.position[key] = value;
          }),
        { step: 0.5, ariaLabel: `Position ${key}` },
      ),
    );
  return section('POSITION', [
    el('div', { class: 'sktc-row sktc-row--3' }, [axis('x'), axis('y'), axis('z')]),
    el('p', {
      class: 'sktc-hint',
      text: `Authored unit: ${entity.position.unit ?? store.project.settings.units.length}. ${
        entity.meta.canonStatus === 'schematic' ? 'SCHEMATIC / NON-CANON POSITION.' : ''
      }`,
    }),
  ]);
}

/* ------------------------------------------------------------------ *
 * VISUAL
 * ------------------------------------------------------------------ */

export function renderVisual(ctx: SectionContext, entity: Entity): HTMLElement | null {
  const { store } = ctx;
  const visual = entity.visual ?? {};
  const setVisual = <K extends string>(key: K, value: unknown, label: string) =>
    patchEntity(store, entity.id, label, (target) => {
      target.visual = { ...(target.visual ?? {}), [key]: value };
    });

  const body: Node[] = [
    el('div', { class: 'sktc-row' }, [
      field(
        nextFieldId('vis'),
        'DISPLAY RADIUS',
        numberInput(typeof visual.displayRadius === 'number' ? visual.displayRadius : 2, (value) =>
          setVisual('displayRadius', value, 'Edit display radius'),
        { step: 0.1, min: 0.05, ariaLabel: 'Display radius' }),
        'Compressed render scale — not an authored physical size.',
      ),
      field(
        nextFieldId('vis'),
        'COLOUR',
        el('input', {
          class: 'sktc-input',
          type: 'color',
          value: typeof visual.color === 'string' ? visual.color : '#7fa8c9',
          ariaLabel: 'Body colour',
          onChange: (event: Event) =>
            setVisual('color', (event.target as HTMLInputElement).value, 'Edit colour'),
        }),
      ),
    ]),
    el('div', { class: 'sktc-row' }, [
      field(
        nextFieldId('vis'),
        'ROUGHNESS',
        numberInput(typeof visual.roughness === 'number' ? visual.roughness : 0.8, (value) =>
          setVisual('roughness', value, 'Edit roughness'),
        { step: 0.05, min: 0, ariaLabel: 'Roughness' }),
      ),
      field(
        nextFieldId('vis'),
        'BANDING',
        numberInput(typeof visual.banding === 'number' ? visual.banding : 0.2, (value) =>
          setVisual('banding', value, 'Edit banding'),
        { step: 0.05, min: 0, ariaLabel: 'Surface banding' }),
      ),
    ]),
    el('div', { class: 'sktc-row' }, [
      field(
        nextFieldId('vis'),
        'FACETS',
        numberInput(typeof visual.facets === 'number' ? visual.facets : 3, (value) =>
          setVisual('facets', Math.round(value), 'Edit facets'),
        { step: 1, min: 0, ariaLabel: 'Facet detail' }),
        '0 = smooth, higher = more stylized facets.',
      ),
      field(
        nextFieldId('vis'),
        'EMISSIVE',
        el('input', {
          class: 'sktc-input',
          type: 'color',
          value: typeof visual.emissive === 'string' ? visual.emissive : '#000000',
          ariaLabel: 'Emissive colour',
          onChange: (event: Event) =>
            setVisual('emissive', (event.target as HTMLInputElement).value, 'Edit emissive'),
        }),
      ),
    ]),
  ];

  if (visual.atmosphere && typeof visual.atmosphere === 'object') {
    const atmosphere = visual.atmosphere as { enabled: boolean; color: string; intensity: number };
    body.push(
      checkboxInput(atmosphere.enabled, 'ATMOSPHERE', (checked) =>
        patchEntity(store, entity.id, 'Toggle atmosphere', (target) => {
          const current = (target.visual?.atmosphere ?? { color: '#a6efff', intensity: 0.3 }) as {
            color: string;
            intensity: number;
            enabled?: boolean;
          };
          target.visual = {
            ...(target.visual ?? {}),
            atmosphere: { color: current.color, intensity: current.intensity, enabled: checked },
          };
        }),
      ),
      el('div', { class: 'sktc-row' }, [
        field(
          nextFieldId('vis'),
          'ATMOSPHERE COLOUR',
          el('input', {
            class: 'sktc-input',
            type: 'color',
            value: atmosphere.color,
            ariaLabel: 'Atmosphere colour',
            onChange: (event: Event) =>
              patchEntity(store, entity.id, 'Edit atmosphere colour', (target) => {
                const current = target.visual?.atmosphere;
                target.visual = {
                  ...(target.visual ?? {}),
                  atmosphere: {
                    enabled: current?.enabled ?? true,
                    color: (event.target as HTMLInputElement).value,
                    intensity: current?.intensity ?? 0.3,
                  },
                };
              }),
          }),
        ),
        field(
          nextFieldId('vis'),
          'ATMOSPHERE INTENSITY',
          numberInput(atmosphere.intensity, (value) =>
            patchEntity(store, entity.id, 'Edit atmosphere intensity', (target) => {
              const current = target.visual?.atmosphere;
              target.visual = {
                ...(target.visual ?? {}),
                atmosphere: {
                  enabled: current?.enabled ?? true,
                  color: current?.color ?? '#a6efff',
                  intensity: value,
                },
              };
            }),
          { step: 0.05, min: 0, ariaLabel: 'Atmosphere intensity' }),
        ),
      ]),
    );
  }

  if (visual.ring && typeof visual.ring === 'object') {
    const ring = visual.ring as unknown as Record<string, number | string>;
    const ringNumber = (key: string, label: string, step: number) =>
      field(
        nextFieldId('ring'),
        label,
        numberInput(Number(ring[key] ?? 0), (value) =>
          patchEntity(store, entity.id, `Edit ring ${label}`, (target) => {
            const current = (target.visual?.ring ?? {}) as unknown as Record<string, unknown>;
            target.visual = {
              ...(target.visual ?? {}),
              ring: { ...current, [key]: value },
            } as unknown as Entity['visual'];
          }),
        { step, ariaLabel: label }),
      );
    body.push(
      el('p', {
        class: 'sktc-warning',
        text: 'BLOOD RING — a huge solid orbital band built from the processed remains and biospheric material of a murdered world. Not an asteroid belt, not decorative rings.',
      }),
      el('div', { class: 'sktc-row' }, [
        ringNumber('innerRadius', 'INNER RADIUS', 0.05),
        ringNumber('outerRadius', 'OUTER RADIUS', 0.05),
      ]),
      el('div', { class: 'sktc-row' }, [
        ringNumber('thickness', 'THICKNESS', 0.02),
        ringNumber('inclination', 'INCLINATION', 1),
      ]),
      el('div', { class: 'sktc-row' }, [
        ringNumber('striations', 'STRIATIONS', 1),
        field(
          nextFieldId('ring'),
          'MATERIAL COLOUR',
          el('input', {
            class: 'sktc-input',
            type: 'color',
            value: String(ring.color ?? '#6d1a26'),
            ariaLabel: 'Ring material colour',
            onChange: (event: Event) =>
              patchEntity(store, entity.id, 'Edit ring colour', (target) => {
                const current = (target.visual?.ring ?? {}) as unknown as Record<string, unknown>;
                target.visual = {
                  ...(target.visual ?? {}),
                  ring: { ...current, color: (event.target as HTMLInputElement).value },
                } as unknown as Entity['visual'];
              }),
          }),
        ),
      ]),
    );
  }

  body.push(
    checkboxInput(visual.labelVisible !== false, 'LABEL VISIBLE', (checked) =>
      setVisual('labelVisible', checked, 'Toggle label'),
    ),
  );

  return section('VISUAL', body);
}

/* ------------------------------------------------------------------ *
 * TIMELINE
 * ------------------------------------------------------------------ */

export function renderTimeline(ctx: SectionContext, entity: Entity): HTMLElement {
  const { store, refs, resolution } = ctx;
  const project = store.project;
  const state = resolution.get(entity.id);
  const appliedIds = new Set((state?.appliedEvents ?? []).map((event) => event.id));
  const now = state?.resolution.time ?? 'main-narrative';

  const events = [...entity.timeline].sort((a, b) => {
    const ax = typeof a.time === 'number' ? a.time : Number.MAX_SAFE_INTEGER / 2;
    const bx = typeof b.time === 'number' ? b.time : Number.MAX_SAFE_INTEGER / 2;
    return ax - bx;
  });

  const body: Node[] = [];
  if (events.length === 0) {
    body.push(el('p', { class: 'sktc-hint', text: 'No authored events on this record.' }));
  }

  for (const event of events) {
    const applied = appliedIds.has(event.id);
    const destructive =
      event.eventType === 'destroyed' ||
      event.eventType === 'bloodRingDestroyed' ||
      event.eventType === 'starsilkExtractionCollapse';
    const rowClass = `sktc-event${applied ? ' sktc-event--active' : ' sktc-event--future'}${
      destructive ? ' sktc-event--destructive' : ''
    }`;

    const editBtn = button('EDIT', { class: 'sktc-btn sktc-btn--icon', title: 'Edit event' });
    editBtn.disabled = AUTHORING(store);
    editBtn.addEventListener('click', () =>
      void openEventForm({ refs, store, entityId: entity.id, event }),
    );
    const deleteBtn = button('✕', { class: 'sktc-btn sktc-btn--icon sktc-btn--danger', title: 'Delete event' });
    deleteBtn.disabled = AUTHORING(store);
    deleteBtn.addEventListener('click', () => void confirmDeleteEvent(refs, store, entity.id, event));
    const jumpBtn = button('GO', { class: 'sktc-btn sktc-btn--icon', title: 'Move the scope to this event’s time' });
    jumpBtn.disabled = AUTHORING(store);
    jumpBtn.addEventListener('click', () => {
      store.commit(`Jump to ${event.label}`, (draft) => {
        const target = entityById(draft, entity.id);
        if (target) target.time = { mode: 'override', overrideValue: event.time };
      });
      store.select(entity.id);
      store.setUi({ railScopeId: entity.id });
    });

    body.push(
      el('div', { class: rowClass }, [
        el('span', { class: 'sktc-event__mark', text: applied ? '◆' : '◇', ariaHidden: 'true' }),
        el('div', {}, [
          el('div', { class: 'sktc-event__head' }, [
            el('span', { class: 'sktc-event__time', text: describeTime(event.time, project.eraPresets) }),
            el('span', { class: 'sktc-event__label', text: event.label }),
            el('span', { class: 'sktc-event__type', text: EVENT_TYPE_LABELS[event.eventType] }),
          ]),
          el('div', { class: 'sktc-event__body' }, [
            `${applied ? 'APPLIED' : 'PENDING'} · ${CANON_STATUS_LABELS[event.canonStatus]}`,
            event.sourceNote ? el('div', { text: event.sourceNote }) : null,
            event.statePatch
              ? el('div', { class: 'sktc-hint', text: `PATCH ${JSON.stringify(event.statePatch)}` })
              : null,
          ]),
          el('div', { class: 'sktc-event__actions' }, [jumpBtn, editBtn, deleteBtn]),
        ]),
      ]),
    );
  }

  const addBtn = button('+ ADD EVENT', {
    class: 'sktc-btn sktc-btn--wide',
    title: 'Add a historical event at the resolved era',
  });
  addBtn.disabled = AUTHORING(store);
  addBtn.addEventListener('click', () =>
    void openEventForm({ refs, store, entityId: entity.id, defaultTime: now as TimeValue }),
  );
  body.push(addBtn);

  return section('TIMELINE', body, el('span', { text: `${events.length}` }));
}
