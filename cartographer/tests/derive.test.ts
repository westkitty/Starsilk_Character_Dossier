import { describe, expect, it } from 'vitest';
import { ALWAYS_PRESENT, deriveGalaxy, deriveSystemBodies } from '../src/render/derive';
import { addEntity, createProject, defaultOrbit, defaultVisual } from '../src/core/project';
import type { StarMapProject } from '../src/core/types';

function buildSystem(): { project: StarMapProject; ids: Record<string, string> } {
  let project = createProject({ title: 'Derive Test', id: 'prj-derive' });
  const sector = addEntity(project, { type: 'starfield', name: 'PHAROS NEBULA', parentId: 'galaxy-root' });
  project = sector.project;
  const system = addEntity(project, {
    type: 'system',
    name: 'SYSTEM 03',
    parentId: sector.entity.id,
    position: { x: 12, y: 1, z: -8, unit: 'pc' },
  });
  project = system.project;
  const star = addEntity(project, { type: 'star', name: 'PHAROS A', parentId: system.entity.id });
  project = star.project;
  const planet = addEntity(project, {
    type: 'planet',
    name: 'PLANET A',
    parentId: system.entity.id,
    orbit: defaultOrbit(1.2, 400),
  });
  project = planet.project;
  const moon = addEntity(project, {
    type: 'moon',
    name: 'MOON A1',
    parentId: planet.entity.id,
    orbit: defaultOrbit(0.02, 27),
  });
  project = moon.project;
  const ring = addEntity(project, {
    type: 'bloodRing',
    name: 'BLOOD RING',
    parentId: planet.entity.id,
    visual: { ...defaultVisual('bloodRing') },
  });
  project = ring.project;
  return {
    project,
    ids: {
      sector: sector.entity.id,
      system: system.entity.id,
      star: star.entity.id,
      planet: planet.entity.id,
      moon: moon.entity.id,
      ring: ring.entity.id,
    },
  };
}

describe('deriveSystemBodies', () => {
  it('derives every body in authored order with parent links', () => {
    const { project, ids } = buildSystem();
    const bodies = deriveSystemBodies(project, ids.system);
    expect(bodies.map((b) => b.name)).toEqual(['PHAROS A', 'PLANET A', 'MOON A1', 'BLOOD RING']);
    expect(bodies.map((b) => b.kind)).toEqual(['star', 'planet', 'moon', 'bloodRing']);
    expect(bodies[2]!.parentId).toBe(ids.planet);
    expect(bodies[3]!.parentId).toBe(ids.planet);
  });

  it('compresses orbital radii without touching authored elements', () => {
    const { project, ids } = buildSystem();
    const before = JSON.stringify(project);
    const bodies = deriveSystemBodies(project, ids.system);
    const planet = bodies.find((b) => b.entityId === ids.planet)!;
    expect(planet.orbit!.semiMajorAxis).toBe(1.2);
    expect(planet.orbitRadius).toBeGreaterThan(0);
    expect(planet.orbitRadius).not.toBe(1.2);
    const moon = bodies.find((b) => b.entityId === ids.moon)!;
    expect(moon.orbitRadius).toBeGreaterThan(planet.radius);
    expect(JSON.stringify(project)).toBe(before);
  });

  it('sizes a Blood Ring against its parent planet', () => {
    const { project, ids } = buildSystem();
    const bodies = deriveSystemBodies(project, ids.system);
    const planet = bodies.find((b) => b.entityId === ids.planet)!;
    const ring = bodies.find((b) => b.entityId === ids.ring)!;
    expect(ring.ring).toBeDefined();
    expect(ring.ring!.innerRadius).toBeGreaterThan(planet.radius);
    expect(ring.ring!.outerRadius).toBeGreaterThan(ring.ring!.innerRadius);
  });

  it('respects an injected historical context', () => {
    const { project, ids } = buildSystem();
    const bodies = deriveSystemBodies(project, ids.system, {
      present: (id) => id !== ids.ring,
      effectiveType: (entity) => (entity.type === 'star' ? 'blackHole' : entity.type),
      annotate: (entity) => (entity.type === 'system' ? { destroyed: true } : undefined),
    });
    // Absent bodies stay in the derivation (so labels can show them as absent)
    // but are flagged; SystemView refuses to build anything flagged absent.
    expect(bodies.find((b) => b.entityId === ids.ring)?.present).toBe(false);
    expect(bodies.find((b) => b.entityId === ids.planet)?.present).toBe(true);
    expect(bodies.find((b) => b.entityId === ids.star)?.kind).toBe('blackHole');
  });
});

describe('deriveGalaxy', () => {
  it('collects sectors, systems, and large-scale structures', () => {
    const base = buildSystem();
    const wall = addEntity(base.project, {
      type: 'largeScaleStructure',
      name: 'SIEGE WALL',
      parentId: 'galaxy-root',
      position: { x: -60, y: 0, z: 40, unit: 'pc' },
      meta: { canonStatus: 'working', tags: ['siege-wall'] },
    });
    const domain = addEntity(wall.project, {
      type: 'largeScaleStructure',
      name: 'DRAKKEN DOMAIN',
      parentId: 'galaxy-root',
      position: { x: -55, y: 0, z: 35, unit: 'pc' },
    });
    const project = domain.project;

    const derived = deriveGalaxy(project, ALWAYS_PRESENT);
    expect(derived.sectors.map((s) => s.name)).toEqual(['PHAROS NEBULA']);
    expect(derived.sectors[0]!.radius).toBeGreaterThan(0);
    expect(derived.systems.map((s) => s.name)).toEqual(['SYSTEM 03']);
    expect(derived.systems[0]!.position).toEqual({ x: 12, y: 1, z: -8 });
    expect(derived.structures.map((s) => [s.name, s.kind])).toEqual([
      ['SIEGE WALL', 'siegeWall'],
      ['DRAKKEN DOMAIN', 'region'],
    ]);
    void base.ids;
  });

  it('flags collapsed stars and Blood Ring bearing systems', () => {
    const { project, ids } = buildSystem();
    const derived = deriveGalaxy(project, {
      present: () => true,
      effectiveType: (entity) => (entity.id === ids.star ? 'blackHole' : entity.type),
    });
    expect(derived.systems[0]!.collapsed).toBe(true);
    expect(derived.systems[0]!.hasBloodRing).toBe(true);
  });

  it('hides historically absent systems', () => {
    const { project, ids } = buildSystem();
    const derived = deriveGalaxy(project, {
      present: (id) => id !== ids.system,
      effectiveType: (entity) => entity.type,
    });
    expect(derived.systems[0]!.present).toBe(false);
  });
});
