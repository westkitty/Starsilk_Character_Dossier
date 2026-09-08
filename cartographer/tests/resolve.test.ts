import { describe, expect, it } from 'vitest';
import {
  absenceLabel,
  allEventsOrdered,
  derivationContextFor,
  eventsFor,
  passesCanonFilter,
  resolveHistoricalState,
  resolveTimeFor,
} from '../src/core/resolve';
import {
  addEntity,
  addTimelineEvent,
  createProject,
  returnToParentTime,
  setTimeOverride,
} from '../src/core/project';
import type { StarMapProject } from '../src/core/types';

/**
 * A synthetic four-scope tree:
 *
 *   GALAXY (override: main-narrative)
 *    ├─ SECTOR-A (inherit)
 *    │    └─ SYSTEM-A1 (inherit)
 *    │         ├─ STAR-A
 *    │         └─ PLANET-A
 *    └─ SECTOR-B (inherit)
 *         └─ SYSTEM-B1 (inherit)
 *              └─ PLANET-B
 */
function tree() {
  let project = createProject({ title: 'Temporal Test', id: 'prj-time' });
  const sectorA = addEntity(project, { type: 'starfield', name: 'SECTOR-A', parentId: 'galaxy-root' });
  project = sectorA.project;
  const sectorB = addEntity(project, { type: 'starfield', name: 'SECTOR-B', parentId: 'galaxy-root' });
  project = sectorB.project;
  const systemA = addEntity(project, { type: 'system', name: 'SYSTEM-A1', parentId: sectorA.entity.id });
  project = systemA.project;
  const systemB = addEntity(project, { type: 'system', name: 'SYSTEM-B1', parentId: sectorB.entity.id });
  project = systemB.project;
  const starA = addEntity(project, { type: 'star', name: 'STAR-A', parentId: systemA.entity.id });
  project = starA.project;
  const planetA = addEntity(project, { type: 'planet', name: 'PLANET-A', parentId: systemA.entity.id });
  project = planetA.project;
  const planetB = addEntity(project, { type: 'planet', name: 'PLANET-B', parentId: systemB.entity.id });
  project = planetB.project;
  return {
    project,
    ids: {
      sectorA: sectorA.entity.id,
      sectorB: sectorB.entity.id,
      systemA: systemA.entity.id,
      systemB: systemB.entity.id,
      starA: starA.entity.id,
      planetA: planetA.entity.id,
      planetB: planetB.entity.id,
    },
  };
}

describe('galaxy inheritance', () => {
  it('propagates the galaxy time to every inheriting descendant', () => {
    const { project, ids } = tree();
    const at121 = setTimeOverride(project, 'galaxy-root', 121);
    const resolution = resolveHistoricalState(at121);
    for (const id of [ids.sectorA, ids.systemA, ids.starA, ids.planetA, ids.sectorB, ids.planetB]) {
      expect(resolution.get(id)!.resolution.time).toBe(121);
      expect(resolution.get(id)!.resolution.mode).toBe('inherit');
      expect(resolution.get(id)!.resolution.fromEntityId).toBe('galaxy-root');
    }
  });

  it('changing the galaxy time moves the whole inheriting tree', () => {
    const { project, ids } = tree();
    const before = resolveHistoricalState(setTimeOverride(project, 'galaxy-root', 0));
    expect(before.get(ids.planetA)!.resolution.time).toBe(0);
    const after = resolveHistoricalState(setTimeOverride(project, 'galaxy-root', 170));
    expect(after.get(ids.planetA)!.resolution.time).toBe(170);
    expect(after.get(ids.sectorB)!.resolution.time).toBe(170);
  });
});

describe('local overrides', () => {
  it('a sector override stops inheritance for that branch only', () => {
    const { project, ids } = tree();
    let next = setTimeOverride(project, 'galaxy-root', 121);
    next = setTimeOverride(next, ids.sectorA, 3);
    const resolution = resolveHistoricalState(next);

    expect(resolution.get(ids.sectorA)!.resolution.time).toBe(3);
    expect(resolution.get(ids.sectorA)!.resolution.mode).toBe('override');
    // Children of the overridden branch inherit its override.
    expect(resolution.get(ids.systemA)!.resolution.time).toBe(3);
    expect(resolution.get(ids.planetA)!.resolution.time).toBe(3);
    expect(resolution.get(ids.starA)!.resolution.time).toBe(3);
    // Siblings are untouched.
    expect(resolution.get(ids.sectorB)!.resolution.time).toBe(121);
    expect(resolution.get(ids.systemB)!.resolution.time).toBe(121);
    expect(resolution.get(ids.planetB)!.resolution.time).toBe(121);
  });

  it('a system override is local to that system', () => {
    const { project, ids } = tree();
    let next = setTimeOverride(project, 'galaxy-root', 'main-narrative');
    next = setTimeOverride(next, ids.systemA, 170);
    const resolution = resolveHistoricalState(next);
    expect(resolution.get(ids.systemA)!.resolution.time).toBe(170);
    expect(resolution.get(ids.starA)!.resolution.time).toBe(170);
    expect(resolution.get(ids.sectorA)!.resolution.time).toBe('main-narrative');
    expect(resolution.get(ids.systemB)!.resolution.time).toBe('main-narrative');
  });

  it('an object override affects only that object', () => {
    const { project, ids } = tree();
    let next = setTimeOverride(project, 'galaxy-root', 170);
    next = setTimeOverride(next, ids.planetA, 3);
    const resolution = resolveHistoricalState(next);
    expect(resolution.get(ids.planetA)!.resolution.time).toBe(3);
    expect(resolution.get(ids.planetA)!.resolution.mode).toBe('override');
    expect(resolution.get(ids.starA)!.resolution.time).toBe(170);
    expect(resolution.get(ids.systemA)!.resolution.time).toBe(170);
  });

  it('reports the supplying ancestor and depth', () => {
    const { project, ids } = tree();
    let next = setTimeOverride(project, 'galaxy-root', 121);
    next = setTimeOverride(next, ids.sectorA, 3);
    const resolution = resolveHistoricalState(next);
    const planet = resolution.get(ids.planetA)!.resolution;
    expect(planet.fromEntityId).toBe(ids.sectorA);
    expect(planet.depth).toBe(2);
    expect(planet.chain[planet.chain.length - 1]).toBe(ids.sectorA);
  });
});

describe('reset to parent time', () => {
  it('override → inherit immediately resolves against the parent', () => {
    const { project, ids } = tree();
    let next = setTimeOverride(project, 'galaxy-root', 121);
    next = setTimeOverride(next, ids.sectorA, 3);
    expect(resolveHistoricalState(next).get(ids.planetA)!.resolution.time).toBe(3);

    next = returnToParentTime(next, ids.sectorA);
    const resolution = resolveHistoricalState(next);
    expect(resolution.get(ids.sectorA)!.resolution.mode).toBe('inherit');
    expect(resolution.get(ids.sectorA)!.resolution.time).toBe(121);
    expect(resolution.get(ids.planetA)!.resolution.time).toBe(121);
  });

  it('a child keeps its own override when the parent resumes inheriting', () => {
    const { project, ids } = tree();
    let next = setTimeOverride(project, 'galaxy-root', 121);
    next = setTimeOverride(next, ids.sectorA, 3);
    next = setTimeOverride(next, ids.planetA, 170);
    next = returnToParentTime(next, ids.sectorA);
    const resolution = resolveHistoricalState(next);
    expect(resolution.get(ids.sectorA)!.resolution.time).toBe(121);
    expect(resolution.get(ids.planetA)!.resolution.time).toBe(170);
  });
});

describe('historical events', () => {
  function withRing(): { project: StarMapProject; ringId: string; planetId: string } {
    const base = tree();
    let project = base.project;
    const ring = addEntity(project, {
      type: 'bloodRing',
      name: 'BLOOD RING',
      parentId: base.ids.planetA,
    });
    project = ring.project;
    // The creation event belongs to the ring itself: absent before, present after.
    const withEvent = addTimelineEvent(project, ring.entity.id, {
      time: 3,
      label: 'Blood Ring formed',
      eventType: 'bloodRingCreated',
      canonStatus: 'locked',
      sourceNote: 'Test fixture.',
    });
    return { project: withEvent.project, ringId: ring.entity.id, planetId: base.ids.planetA };
  }

  it('a Blood Ring is absent before its creation event and present after', () => {
    const { project, ringId } = withRing();
    const before = resolveHistoricalState(setTimeOverride(project, 'galaxy-root', 0));
    expect(before.get(ringId)!.present).toBe(false);
    expect(before.get(ringId)!.absenceReason).toBe('before-creation');

    const at = resolveHistoricalState(setTimeOverride(project, 'galaxy-root', 3));
    expect(at.get(ringId)!.present).toBe(true);
    expect(at.get(ringId)!.creationTime).toBe(3);

    const after = resolveHistoricalState(setTimeOverride(project, 'galaxy-root', 121));
    expect(after.get(ringId)!.present).toBe(true);
  });

  it('the planet stays present either side of the ring formation', () => {
    const { project, planetId } = withRing();
    for (const time of [0, 3, 170]) {
      const resolution = resolveHistoricalState(setTimeOverride(project, 'galaxy-root', time));
      expect(resolution.get(planetId)!.present).toBe(true);
    }
  });

  it('a destruction event removes the record from that time onwards', () => {
    const base = tree();
    const withEvent = addTimelineEvent(base.project, base.ids.planetA, {
      time: 121,
      label: 'World lost',
      eventType: 'destroyed',
      canonStatus: 'working',
      sourceNote: 'Test fixture.',
    });
    const before = resolveHistoricalState(setTimeOverride(withEvent.project, 'galaxy-root', 120));
    expect(before.get(base.ids.planetA)!.present).toBe(true);
    const at = resolveHistoricalState(setTimeOverride(withEvent.project, 'galaxy-root', 121));
    expect(at.get(base.ids.planetA)!.present).toBe(false);
    expect(at.get(base.ids.planetA)!.absenceReason).toBe('destroyed');
    expect(at.get(base.ids.planetA)!.destructionTime).toBe(121);
  });

  it('a rename patch changes the effective name only after the event', () => {
    const base = tree();
    const withEvent = addTimelineEvent(base.project, base.ids.planetA, {
      time: 121,
      label: 'Redesignated',
      eventType: 'renamed',
      canonStatus: 'schematic',
      sourceNote: 'Test fixture.',
      statePatch: { name: 'PLANET-A (REDESIGNATED)' },
    });
    const before = resolveHistoricalState(setTimeOverride(withEvent.project, 'galaxy-root', 3));
    expect(before.get(base.ids.planetA)!.effectiveName).toBe('PLANET-A');
    const after = resolveHistoricalState(setTimeOverride(withEvent.project, 'galaxy-root', 121));
    expect(after.get(base.ids.planetA)!.effectiveName).toBe('PLANET-A (REDESIGNATED)');
  });

  it('events resolve in chronological order regardless of authored order', () => {
    const base = tree();
    let project = addTimelineEvent(base.project, base.ids.planetA, {
      time: 170,
      label: 'Later patch',
      eventType: 'visualChanged',
      canonStatus: 'schematic',
      sourceNote: 'b',
      statePatch: { color: '#ffffff' },
    }).project;
    project = addTimelineEvent(project, base.ids.planetA, {
      time: 3,
      label: 'Earlier patch',
      eventType: 'visualChanged',
      canonStatus: 'schematic',
      sourceNote: 'a',
      statePatch: { color: '#000000' },
    }).project;

    const early = resolveHistoricalState(setTimeOverride(project, 'galaxy-root', 3));
    expect(early.get(base.ids.planetA)!.properties.color).toBe('#000000');
    const late = resolveHistoricalState(setTimeOverride(project, 'galaxy-root', 170));
    expect(late.get(base.ids.planetA)!.properties.color).toBe('#ffffff');
    expect(late.get(base.ids.planetA)!.appliedEvents.map((e) => e.label)).toEqual([
      'Earlier patch',
      'Later patch',
    ]);
  });
});

describe('Starsilk extraction collapse', () => {
  function collapsing() {
    const base = tree();
    const withEvent = addTimelineEvent(base.project, base.ids.starA, {
      time: 'post-siege-wall',
      label: 'Starsilk extraction — stellar collapse',
      eventType: 'starsilkExtractionCollapse',
      canonStatus: 'working',
      sourceNote: 'Test fixture.',
      statePatch: { type: 'blackHole' },
    });
    return { project: withEvent.project, ids: base.ids };
  }

  it('before the event: a star and an extant system', () => {
    const { project, ids } = collapsing();
    const resolution = resolveHistoricalState(setTimeOverride(project, 'galaxy-root', 170));
    expect(resolution.get(ids.starA)!.effectiveType).toBe('star');
    expect(resolution.get(ids.starA)!.starCollapsed).toBe(false);
    expect(resolution.get(ids.systemA)!.systemDestroyed).toBe(false);
    expect(resolution.get(ids.planetA)!.present).toBe(true);
  });

  it('after the event: a black hole and a historically destroyed system', () => {
    const { project, ids } = collapsing();
    const resolution = resolveHistoricalState(
      setTimeOverride(project, 'galaxy-root', 'post-siege-wall'),
    );
    const star = resolution.get(ids.starA)!;
    expect(star.effectiveType).toBe('blackHole');
    expect(star.starCollapsed).toBe(true);
    expect(star.present).toBe(true);
    expect(resolution.get(ids.systemA)!.systemDestroyed).toBe(true);
    expect(resolution.get(ids.planetA)!.present).toBe(false);
    expect(resolution.get(ids.planetA)!.absenceReason).toBe('system-destroyed');
  });

  it('scrubbing backwards restores the earlier visualisation without deleting the event', () => {
    const { project, ids } = collapsing();
    const after = resolveHistoricalState(setTimeOverride(project, 'galaxy-root', 'post-siege-wall'));
    expect(after.get(ids.starA)!.effectiveType).toBe('blackHole');
    const before = resolveHistoricalState(setTimeOverride(project, 'galaxy-root', 170));
    expect(before.get(ids.starA)!.effectiveType).toBe('star');
    expect(eventsFor(project, ids.starA)).toHaveLength(1);
  });

  it('a system override earlier than the collapse keeps its worlds', () => {
    const { project, ids } = collapsing();
    let next = setTimeOverride(project, 'galaxy-root', 'post-siege-wall');
    next = setTimeOverride(next, ids.systemA, 121);
    const resolution = resolveHistoricalState(next);
    expect(resolution.get(ids.systemA)!.systemDestroyed).toBe(false);
    expect(resolution.get(ids.planetA)!.present).toBe(true);
    // The star itself still resolves at 121 through the system override.
    expect(resolution.get(ids.starA)!.effectiveType).toBe('star');
  });
});

describe('determinism and filters', () => {
  it('resolution is deterministic for identical input', () => {
    const { project, ids } = tree();
    const withTime = setTimeOverride(project, 'galaxy-root', 121);
    const a = resolveHistoricalState(withTime);
    const b = resolveHistoricalState(withTime);
    for (const id of Object.keys(ids).map((key) => ids[key as keyof typeof ids])) {
      expect(a.get(id)!.resolution).toEqual(b.get(id)!.resolution);
      expect(a.get(id)!.present).toBe(b.get(id)!.present);
    }
    expect(JSON.stringify([...a.entries()].map(([k, v]) => [k, v.resolution]))).toBe(
      JSON.stringify([...b.entries()].map(([k, v]) => [k, v.resolution])),
    );
  });

  it('resolveTimeFor falls back to the main narrative for an unscoped root', () => {
    const project = createProject();
    project.entities[0]!.time = { mode: 'inherit' };
    expect(resolveTimeFor(project, 'galaxy-root').time).toBe('main-narrative');
  });

  it('canon-only filter hides provisional and schematic records', () => {
    const base = tree();
    const resolution = resolveHistoricalState(base.project, { canonOnly: true });
    // createProject + addEntity default to the project's defaultCanonStatus (schematic)
    expect(resolution.get(base.ids.planetA)!.present).toBe(false);
    expect(resolution.get(base.ids.planetA)!.absenceReason).toBe('canon-filtered');
    expect(passesCanonFilter('locked', true)).toBe(true);
    expect(passesCanonFilter('schematic', true)).toBe(false);
    expect(passesCanonFilter('schematic', false)).toBe(true);
  });

  it('ancestor absence cascades to descendants', () => {
    const base = tree();
    const withEvent = addTimelineEvent(base.project, base.ids.sectorA, {
      time: 3,
      label: 'Sector lost',
      eventType: 'destroyed',
      canonStatus: 'working',
      sourceNote: 'Test fixture.',
    });
    const resolution = resolveHistoricalState(
      setTimeOverride(withEvent.project, 'galaxy-root', 121),
    );
    expect(resolution.get(base.ids.sectorA)!.present).toBe(false);
    expect(resolution.get(base.ids.systemA)!.present).toBe(false);
    expect(resolution.get(base.ids.systemA)!.absenceReason).toBe('ancestor-absent');
    expect(resolution.get(base.ids.planetA)!.present).toBe(false);
    expect(resolution.get(base.ids.sectorB)!.present).toBe(true);
  });

  it('orders every project event along the historical axis', () => {
    const base = tree();
    let project = addTimelineEvent(base.project, base.ids.planetA, {
      time: 170,
      label: 'Late',
      eventType: 'annotation',
      canonStatus: 'working',
      sourceNote: 'x',
    }).project;
    project = addTimelineEvent(project, base.ids.sectorA, {
      time: 'pre-war',
      label: 'Early',
      eventType: 'annotation',
      canonStatus: 'working',
      sourceNote: 'x',
    }).project;
    project = addTimelineEvent(project, base.ids.starA, {
      time: 3,
      label: 'Middle',
      eventType: 'annotation',
      canonStatus: 'working',
      sourceNote: 'x',
    }).project;
    expect(allEventsOrdered(project).map((entry) => entry.event.label)).toEqual([
      'Early',
      'Middle',
      'Late',
    ]);
  });

  it('exposes readable absence reasons', () => {
    expect(absenceLabel('system-destroyed')).toMatch(/SYSTEM DESTROYED/);
    expect(absenceLabel('before-creation')).toMatch(/NOT YET FORMED/);
  });

  it('bridges into the renderer without leaking era concepts', () => {
    const { project, ids } = tree();
    const resolution = resolveHistoricalState(setTimeOverride(project, 'galaxy-root', 121));
    const context = derivationContextFor(resolution);
    const entity = project.entities.find((e) => e.id === ids.planetA)!;
    expect(context.present(ids.planetA)).toBe(true);
    expect(context.effectiveType(entity)).toBe('planet');
    expect(context.annotate?.(entity)).toBeDefined();
  });
});
