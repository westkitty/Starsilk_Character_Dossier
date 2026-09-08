import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createDemoProject } from '../src/core/demo';
import { parseProject, serializeProject, validateProject } from '../src/core/schema';
import { resolveHistoricalState, resolveTimeFor } from '../src/core/resolve';
import { deriveGalaxy, deriveSystemBodies } from '../src/render/derive';
import { setTimeOverride } from '../src/core/project';
import { BLOOD_ECLIPSE_WAR_YEARS } from '../src/core/time';

const demo = createDemoProject();

const at = (time: number | string) =>
  resolveHistoricalState(setTimeOverride(demo, 'galaxy-root', time));

describe('demo dataset integrity', () => {
  it('is a valid project document', () => {
    const result = validateProject(JSON.parse(serializeProject(demo)));
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('matches the committed data/starsilk-map.json byte for byte', () => {
    // The committed dataset is generated, never hand-edited: `npm run export:demo`.
    const onDisk = readFileSync(
      fileURLToPath(new URL('../data/starsilk-map.json', import.meta.url)),
      'utf8',
    );
    expect(onDisk.trim()).toBe(serializeProject(createDemoProject()).trim());
    expect(parseProject(onDisk).ok).toBe(true);
  });

  it('survives a JSON round trip', () => {
    const roundTrip = parseProject(serializeProject(demo));
    expect(roundTrip.ok).toBe(true);
    expect(roundTrip.project!.entities.length).toBe(demo.entities.length);
    expect(roundTrip.project!.title).toBe(demo.title);
  });

  it('proves multiple sectors, systems, planets, and a moon', () => {
    const types = demo.entities.map((e) => e.type);
    expect(types.filter((t) => t === 'starfield').length).toBeGreaterThanOrEqual(4);
    expect(types.filter((t) => t === 'system').length).toBeGreaterThanOrEqual(5);
    expect(types.filter((t) => t === 'planet').length).toBeGreaterThanOrEqual(5);
    expect(types.filter((t) => t === 'moon').length).toBeGreaterThanOrEqual(2);
    expect(types.filter((t) => t === 'bloodRing').length).toBeGreaterThanOrEqual(2);
  });

  it('differentiates canon statuses', () => {
    const statuses = new Set(demo.entities.map((e) => e.meta.canonStatus));
    for (const expected of ['locked', 'working', 'provisional', 'schematic']) {
      expect(statuses.has(expected as never)).toBe(true);
    }
  });

  it('labels every authored coordinate as schematic', () => {
    for (const entity of demo.entities) {
      if (!entity.position) continue;
      const note = `${entity.meta.sourceNote ?? ''} ${entity.meta.description ?? ''}`.toLowerCase();
      expect(note, `${entity.name} has a position without a schematic note`).toMatch(/schematic|invented/);
    }
  });

  it('keeps the war at 170 years and invents no post-war dates', () => {
    expect(BLOOD_ECLIPSE_WAR_YEARS).toBe(170);
    for (const entity of demo.entities) {
      for (const event of entity.timeline) {
        if (typeof event.time === 'number') {
          expect(event.time).toBeLessThanOrEqual(BLOOD_ECLIPSE_WAR_YEARS);
        }
      }
    }
  });

  it('leaves the main narrative undated', () => {
    const main = demo.eraPresets.find((p) => p.id === 'main-narrative')!;
    expect(main.time).toBeUndefined();
    expect(main.label).toBe('MAIN NARRATIVE — DATE UNSPECIFIED');
  });

  it('asserts no Siege Wall node count', () => {
    const wall = demo.entities.find((e) => e.id === 'structure-siege-wall')!;
    expect(wall.visual?.nodeCount).toBeUndefined();
    expect(String(wall.meta.sourceNote).toLowerCase()).toMatch(/no canon node count/);
    expect(String(wall.meta.description).toLowerCase()).toMatch(/not a literal wall/);
  });

  it('never describes Starsilk as sentient', () => {
    const text = JSON.stringify(demo).toLowerCase();
    // The document must state the negation and never claim consciousness.
    expect(text).toMatch(/not sentient/);
    expect(text).not.toMatch(/starsilk (is|was|be|being) (sentient|conscious|alive)/);
    expect(text).not.toMatch(/starsilk (wills|wants|chooses|decides)/);
    expect(text).toMatch(/literal, programmable cosmological substance/);
  });
});

describe('demo: Blood Ring history', () => {
  it('the first Blood Ring is absent before Year 3 and present from Year 3', () => {
    const before = at(0).get('ring-fallenstar')!;
    expect(before.present).toBe(false);
    expect(before.absenceReason).toBe('before-creation');

    const after = at(3).get('ring-fallenstar')!;
    expect(after.present).toBe(true);
    expect(after.creationTime).toBe(3);
    expect(after.canonStatus).toBe('locked');
  });

  it('Fallenstar Prime itself is present either side of the ring formation', () => {
    expect(at(0).get('planet-fallenstar-prime')!.present).toBe(true);
    expect(at(3).get('planet-fallenstar-prime')!.present).toBe(true);
  });

  it('the second ring forms at the Year 121 siege anchor in its own scope', () => {
    const galaxyAt = (galaxyTime: number | string, systemTime: number | string) =>
      resolveHistoricalState(
        setTimeOverride(setTimeOverride(demo, 'galaxy-root', galaxyTime), 'system-ruby', systemTime),
      );
    expect(galaxyAt(120, 120).get('ring-ruby')!.present).toBe(false);
    expect(galaxyAt(120, 121).get('ring-ruby')!.present).toBe(true);
  });

  it('stays at its Year 121 override even when the galaxy reads Year 0', () => {
    expect(at(0).get('ring-ruby')!.present).toBe(true);
    expect(at(0).get('system-ruby')!.resolution.time).toBe(121);
  });

  it('a Blood Ring is a first-class entity parented to a planet', () => {
    const ring = demo.entities.find((e) => e.id === 'ring-fallenstar')!;
    expect(ring.type).toBe('bloodRing');
    expect(ring.parentId).toBe('planet-fallenstar-prime');
    expect(ring.visual?.ring).toBeDefined();
  });
});

describe('demo: Starsilk extraction collapse', () => {
  it('before the event: a star and an extant system', () => {
    const resolution = at(170);
    expect(resolution.get('star-aureal')!.effectiveType).toBe('star');
    expect(resolution.get('system-aureal')!.systemDestroyed).toBe(false);
    expect(resolution.get('planet-aureal-1')!.present).toBe(true);
  });

  it('after the event: a black hole and a historically destroyed system', () => {
    const resolution = at('post-siege-wall');
    const star = resolution.get('star-aureal')!;
    expect(star.effectiveType).toBe('blackHole');
    expect(star.starCollapsed).toBe(true);
    expect(resolution.get('system-aureal')!.systemDestroyed).toBe(true);
    expect(resolution.get('planet-aureal-1')!.present).toBe(false);
    expect(resolution.get('planet-aureal-1')!.absenceReason).toBe('system-destroyed');
  });

  it('invents no survivors, debris belts, or replacement worlds', () => {
    const text = JSON.stringify(demo).toLowerCase();
    expect(text).not.toMatch(/accretion disk/);
    expect(text).not.toMatch(/survivor/);
  });
});

describe('demo: Siege Wall', () => {
  it('is absent before the post-war era and present after', () => {
    expect(at(170).get('structure-siege-wall')!.present).toBe(false);
    expect(at('post-siege-wall').get('structure-siege-wall')!.present).toBe(true);
  });

  it('derives as an absence structure, not a barrier', () => {
    const derived = deriveGalaxy(demo);
    const wall = derived.structures.find((s) => s.entityId === 'structure-siege-wall')!;
    expect(wall.kind).toBe('siegeWall');
    expect(wall.radius).toBeGreaterThan(10);
  });

  it('keeps the Drakken domain contained rather than annihilated', () => {
    const domain = demo.entities.find((e) => e.id === 'structure-drakken-domain')!;
    expect(String(domain.meta.description).toLowerCase()).toMatch(/contained/);
    expect(String(domain.meta.description).toLowerCase()).toMatch(/not annihilated/);
  });
});

describe('demo: hierarchical time', () => {
  it('the galaxy default is the main narrative', () => {
    expect(resolveTimeFor(demo, 'galaxy-root').time).toBe('main-narrative');
    expect(resolveTimeFor(demo, 'system-pharos-03').time).toBe('main-narrative');
  });

  it('a sector override applies to its branch only', () => {
    const resolution = resolveHistoricalState(demo);
    expect(resolution.get('sector-halven')!.resolution.mode).toBe('override');
    expect(resolution.get('sector-halven')!.resolution.time).toBe(121);
    expect(resolution.get('system-halven')!.resolution.time).toBe(121);
    expect(resolution.get('planet-halven-1')!.resolution.time).toBe(121);
    // Sibling branches keep inheriting the galaxy era.
    expect(resolution.get('sector-fallenstar')!.resolution.time).toBe('main-narrative');
    expect(resolution.get('sector-pharos')!.resolution.time).toBe('main-narrative');
    expect(resolution.get('system-pharos-03')!.resolution.time).toBe('main-narrative');
  });

  it('a system override applies to that system only', () => {
    const resolution = resolveHistoricalState(demo);
    expect(resolution.get('system-ruby')!.resolution.mode).toBe('override');
    expect(resolution.get('system-ruby')!.resolution.time).toBe(121);
    expect(resolution.get('ring-ruby')!.resolution.time).toBe(121);
    // Its sibling system in the same sector still inherits.
    expect(resolution.get('system-pharos-03')!.resolution.time).toBe('main-narrative');
    expect(resolution.get('sector-pharos')!.resolution.time).toBe('main-narrative');
  });

  it('an object override applies to that object only', () => {
    const resolution = resolveHistoricalState(demo);
    expect(resolution.get('moon-aureal-1')!.resolution.time).toBe(121);
    expect(resolution.get('moon-aureal-1')!.resolution.mode).toBe('override');
    expect(resolution.get('planet-aureal-1')!.resolution.time).toBe('main-narrative');
    expect(resolution.get('planet-aureal-1')!.resolution.mode).toBe('inherit');
  });

  it('a rename event takes effect at its anchor', () => {
    expect(at(3).get('planet-pharos-c')!.effectiveName).toBe('PHAROS OUTER MARKER');
    expect(at(121).get('planet-pharos-c')!.effectiveName).toBe('PHAROS III-c');
  });

  it('a destruction event removes a record from its anchor onwards', () => {
    expect(at(0).get('moon-fallenstar-1')!.present).toBe(true);
    expect(at(3).get('moon-fallenstar-1')!.present).toBe(false);
  });
});

describe('demo: renderer derivation', () => {
  it('derives the Fallenstar system with its ring at the resolved era', () => {
    const resolution = at(3);
    const bodies = deriveSystemBodies(
      setTimeOverride(demo, 'galaxy-root', 3),
      'system-fallenstar',
      {
        present: (id) => resolution.get(id)?.present ?? true,
        effectiveType: (entity) => resolution.get(entity.id)?.effectiveType ?? entity.type,
      },
    );
    const kinds = bodies.map((b) => b.kind);
    expect(kinds).toContain('star');
    expect(kinds).toContain('bloodRing');
    const ring = bodies.find((b) => b.kind === 'bloodRing')!;
    expect(ring.ring!.outerRadius).toBeGreaterThan(ring.ring!.innerRadius);
  });

  it('hides the ring when the era precedes its formation', () => {
    const project = setTimeOverride(demo, 'galaxy-root', 0);
    const resolution = resolveHistoricalState(project);
    const bodies = deriveSystemBodies(project, 'system-fallenstar', {
      present: (id) => resolution.get(id)?.present ?? true,
      effectiveType: (entity) => resolution.get(entity.id)?.effectiveType ?? entity.type,
    });
    expect(bodies.find((b) => b.kind === 'bloodRing')!.present).toBe(false);
  });

  it('renders the collapsed Aureal star as a black hole', () => {
    const project = setTimeOverride(demo, 'galaxy-root', 'post-siege-wall');
    const resolution = resolveHistoricalState(project);
    const bodies = deriveSystemBodies(project, 'system-aureal', {
      present: (id) => resolution.get(id)?.present ?? true,
      effectiveType: (entity) => resolution.get(entity.id)?.effectiveType ?? entity.type,
    });
    expect(bodies[0]!.kind).toBe('blackHole');
    expect(bodies.filter((b) => b.present).map((b) => b.kind)).toEqual(['blackHole']);
  });

  it('derives the galaxy with sectors, systems, and both structures', () => {
    const derived = deriveGalaxy(demo);
    expect(derived.sectors.length).toBeGreaterThanOrEqual(4);
    expect(derived.systems.length).toBeGreaterThanOrEqual(5);
    expect(derived.structures.map((s) => s.kind).sort()).toEqual(['region', 'siegeWall']);
    const collapsed = derived.systems.find((s) => s.entityId === 'system-aureal');
    expect(collapsed).toBeDefined();
  });

  it('marks the collapsed system at the post-war era in the galaxy derivation', () => {
    const project = setTimeOverride(demo, 'galaxy-root', 'post-siege-wall');
    const resolution = resolveHistoricalState(project);
    const derived = deriveGalaxy(project, {
      present: (id) => resolution.get(id)?.present ?? true,
      effectiveType: (entity) => resolution.get(entity.id)?.effectiveType ?? entity.type,
      annotate: (entity) => {
        const state = resolution.get(entity.id);
        return { destroyed: state?.systemDestroyed ?? false };
      },
    });
    const aureal = derived.systems.find((s) => s.entityId === 'system-aureal')!;
    expect(aureal.collapsed).toBe(true);
    expect(aureal.destroyed).toBe(true);
  });

  it('ships a 10,000-star stress fixture by default', () => {
    expect(demo.settings.render.starfieldDensity).toBe(10000);
  });
});
