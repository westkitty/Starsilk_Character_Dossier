// @vitest-environment jsdom
/**
 * Renderer *logic* tests.
 *
 * These exercise the Three.js scene-graph builders without a WebGL context:
 * geometries, materials, and object hierarchies are all constructed in jsdom, which
 * is enough to prove that derivation, motion, selection, trails, wall masking, and
 * disposal behave correctly. Actual rasterisation is covered by the Playwright
 * smoke journey (`npm run smoke`), which needs a real browser.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SystemView } from '../src/render/system';
import { GalaxyView, wallNodeCount, wallNodes } from '../src/render/galaxy';
import { deriveGalaxy, deriveSystemBodies, ALWAYS_PRESENT } from '../src/render/derive';
import { addEntity, createProject, defaultOrbit, defaultVisual } from '../src/core/project';
import { SimulationClock } from '../src/core/simulation';

function buildProject() {
  let project = createProject({ title: 'Renderer Logic', id: 'prj-render' });
  const sector = addEntity(project, { type: 'starfield', name: 'SECTOR', parentId: 'galaxy-root', position: { x: 20, y: 0, z: 0 } });
  project = sector.project;
  const system = addEntity(project, { type: 'system', name: 'SYSTEM', parentId: sector.entity.id, position: { x: 24, y: 0, z: 4 } });
  project = system.project;
  const star = addEntity(project, { type: 'star', name: 'STAR', parentId: system.entity.id });
  project = star.project;
  const planet = addEntity(project, {
    type: 'planet',
    name: 'PLANET',
    parentId: system.entity.id,
    orbit: defaultOrbit(1, 365),
  });
  project = planet.project;
  const moon = addEntity(project, {
    type: 'moon',
    name: 'MOON',
    parentId: planet.entity.id,
    orbit: defaultOrbit(0.01, 27),
  });
  project = moon.project;
  const ring = addEntity(project, {
    type: 'bloodRing',
    name: 'BLOOD RING',
    parentId: planet.entity.id,
    visual: defaultVisual('bloodRing'),
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

const VIEW_OPTIONS = { showOrbitPaths: true, showTrails: true, trailSamples: 60 };

describe('SystemView scene construction', () => {
  it('builds a node per present body with pick targets', () => {
    const { project, ids } = buildProject();
    const view = new SystemView();
    view.build(deriveSystemBodies(project, ids.system), VIEW_OPTIONS);
    // star + planet + moon + Blood Ring
    expect(view.pickables.length).toBe(4);
    expect(view.has(ids.star)).toBe(true);
    expect(view.has(ids.ring)).toBe(true);
    expect(view.framingRadius).toBeGreaterThan(0);
    view.dispose();
  });

  it('refuses to build bodies that are historically absent', () => {
    const { project, ids } = buildProject();
    const view = new SystemView();
    view.build(
      deriveSystemBodies(project, ids.system, {
        present: (id) => id !== ids.ring && id !== ids.moon,
        effectiveType: (entity) => entity.type,
      }),
      VIEW_OPTIONS,
    );
    expect(view.has(ids.ring)).toBe(false);
    expect(view.has(ids.moon)).toBe(false);
    expect(view.has(ids.planet)).toBe(true);
    view.dispose();
  });

  it('creates trails only for orbiting planets and moons', () => {
    const { project, ids } = buildProject();
    const view = new SystemView();
    view.build(deriveSystemBodies(project, ids.system), VIEW_OPTIONS);
    const trails = view.group.children.filter(
      (child) => child instanceof THREE.Line && !(child instanceof THREE.LineLoop),
    );
    expect(trails.length).toBe(2);
    view.dispose();
  });

  it('moves bodies deterministically from simulation days', () => {
    const { project, ids } = buildProject();
    const view = new SystemView();
    view.build(deriveSystemBodies(project, ids.system), VIEW_OPTIONS);

    view.update(0, VIEW_OPTIONS);
    const first = view.positions().get(ids.planet)!.clone();
    view.update(91.25, VIEW_OPTIONS);
    const quarter = view.positions().get(ids.planet)!.clone();
    view.update(0, VIEW_OPTIONS);
    const again = view.positions().get(ids.planet)!.clone();

    expect(again.x).toBeCloseTo(first.x, 9);
    expect(again.z).toBeCloseTo(first.z, 9);
    expect(Math.hypot(quarter.x - first.x, quarter.z - first.z)).toBeGreaterThan(0.5);
    // The moon rides its parent: it stays close to the planet.
    const moonPos = view.positions().get(ids.moon)!;
    expect(moonPos.length()).toBeLessThan(4);
    view.dispose();
  });

  it('records trail samples and clears them on demand', () => {
    const { project, ids } = buildProject();
    const view = new SystemView();
    view.build(deriveSystemBodies(project, ids.system), VIEW_OPTIONS);
    for (let day = 0; day < 40; day += 1) view.update(day * 3, VIEW_OPTIONS);
    const trail = view.group.children.find(
      (child) => child instanceof THREE.Line && !(child instanceof THREE.LineLoop),
    ) as THREE.Line;
    expect(trail.geometry.drawRange.count).toBeGreaterThan(2);
    view.clearTrails();
    expect(trail.geometry.drawRange.count).toBe(0);
    view.dispose();
  });

  it('caps trail growth at the authored sample budget', () => {
    const { project, ids } = buildProject();
    const view = new SystemView();
    view.build(deriveSystemBodies(project, ids.system), { ...VIEW_OPTIONS, trailSamples: 30 });
    for (let day = 0; day < 200; day += 1) view.update(day * 2, VIEW_OPTIONS);
    const trail = view.group.children.find(
      (child) => child instanceof THREE.Line && !(child instanceof THREE.LineLoop),
    ) as THREE.Line;
    expect(trail.geometry.drawRange.count).toBeLessThanOrEqual(30);
    view.dispose();
  });

  it('attaches and removes the selection ring', () => {
    const { project, ids } = buildProject();
    const view = new SystemView();
    view.build(deriveSystemBodies(project, ids.system), VIEW_OPTIONS);
    const countBefore = view.group.children.length;
    view.setSelection(ids.planet);
    view.setSelection(null);
    view.setSelection(ids.planet);
    view.setSelection(ids.moon);
    view.setSelection(null);
    expect(view.group.children.length).toBe(countBefore);
    view.dispose();
  });

  it('rebuilding disposes the previous scene without leaking children', () => {
    const { project, ids } = buildProject();
    const view = new SystemView();
    view.build(deriveSystemBodies(project, ids.system), VIEW_OPTIONS);
    const firstCount = view.group.children.length;
    view.build(deriveSystemBodies(project, ids.system), VIEW_OPTIONS);
    expect(view.group.children.length).toBe(firstCount);
    expect(view.pickables.length).toBe(4);
    view.dispose();
    expect(view.group.children.length).toBe(0);
    expect(view.pickables.length).toBe(0);
  });
});

describe('GalaxyView scene construction', () => {
  it('builds a point cloud of the requested density', () => {
    const { project } = buildProject();
    const view = new GalaxyView();
    view.build({
      derived: deriveGalaxy(project),
      starCount: 1200,
      seed: project.id,
      galaxyRadius: 100,
      wallRegions: [],
      wallActive: false,
      showAnalystOverlay: false,
    });
    const points = view.group.children.find((child) => child instanceof THREE.Points) as THREE.Points;
    expect(points.geometry.getAttribute('position').count).toBe(1200);
    view.dispose();
  });

  it('is deterministic for a given seed', () => {
    const { project } = buildProject();
    const a = new GalaxyView();
    const b = new GalaxyView();
    const input = {
      derived: deriveGalaxy(project),
      starCount: 500,
      seed: 'fixed-seed',
      galaxyRadius: 80,
      wallRegions: [],
      wallActive: false,
      showAnalystOverlay: false,
    };
    a.build(input);
    b.build(input);
    const pa = (a.group.children.find((c) => c instanceof THREE.Points) as THREE.Points)
      .geometry.getAttribute('position').array as Float32Array;
    const pb = (b.group.children.find((c) => c instanceof THREE.Points) as THREE.Points)
      .geometry.getAttribute('position').array as Float32Array;
    expect(Array.from(pa.slice(0, 30))).toEqual(Array.from(pb.slice(0, 30)));
    a.dispose();
    b.dispose();
  });

  it('extinguishes stars inside an active Siege Wall region and restores them', () => {
    const { project } = buildProject();
    const view = new GalaxyView();
    const region = { center: new THREE.Vector3(24, 0, 4), radius: 14 };
    view.build({
      derived: deriveGalaxy(project),
      starCount: 2000,
      seed: 'wall-test',
      galaxyRadius: 90,
      wallRegions: [region],
      wallActive: false,
      showAnalystOverlay: false,
    });
    const points = view.group.children.find((c) => c instanceof THREE.Points) as THREE.Points;
    const colors = points.geometry.getAttribute('color') as THREE.BufferAttribute;
    const beforeSum = (colors.array as Float32Array).reduce((sum, v) => sum + v, 0);

    view.setWall([region], true);
    const duringSum = (colors.array as Float32Array).reduce((sum, v) => sum + v, 0);
    // 71 of 2000 stars fall inside this region, so the reduction is small but real.
    expect(duringSum).toBeLessThan(beforeSum * 0.99);

    view.setWall([], false);
    const afterSum = (colors.array as Float32Array).reduce((sum, v) => sum + v, 0);
    expect(afterSum).toBeCloseTo(beforeSum, 6);
    view.dispose();
  });

  it('places procedural wall nodes deterministically and within bounds', () => {
    const center = new THREE.Vector3(10, 0, -5);
    const first = wallNodes(center, 40, 12345);
    const second = wallNodes(center, 40, 12345);
    expect(first.length).toBe(wallNodeCount(40));
    expect(first.map((v) => v.x)).toEqual(second.map((v) => v.x));
    for (const node of first) {
      const distance = Math.hypot(node.x - center.x, node.z - center.z);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThanOrEqual(40 * 1.1);
    }
  });

  it('exposes system marker positions for camera framing', () => {
    const { project, ids } = buildProject();
    const view = new GalaxyView();
    view.build({
      derived: deriveGalaxy(project),
      starCount: 100,
      seed: project.id,
      galaxyRadius: 90,
      wallRegions: [],
      wallActive: false,
      showAnalystOverlay: false,
    });
    const position = view.markerPosition(ids.system);
    expect(position).not.toBeNull();
    expect(position!.x).toBeCloseTo(24, 6);
    view.dispose();
  });

  it('rebuilds without leaking children or pickables', () => {
    const { project } = buildProject();
    const view = new GalaxyView();
    const input = {
      derived: deriveGalaxy(project),
      starCount: 100,
      seed: project.id,
      galaxyRadius: 90,
      wallRegions: [],
      wallActive: false,
      showAnalystOverlay: false,
    };
    view.build(input);
    const count = view.group.children.length;
    const picks = view.pickables.length;
    view.build(input);
    expect(view.group.children.length).toBe(count);
    expect(view.pickables.length).toBe(picks);
    view.dispose();
  });
});

describe('simulation clock independence', () => {
  it('advances only when unpaused and never touches authored data', () => {
    const clock = new SimulationClock({ speed: 10 });
    clock.advance(0.1);
    expect(clock.time).toBeCloseTo(1, 6);
    clock.setPaused(true);
    clock.advance(0.1);
    expect(clock.time).toBeCloseTo(1, 6);
    clock.setSpeed(1);
    expect(clock.paused).toBe(false);
    clock.advance(0.2);
    expect(clock.time).toBeCloseTo(1.2, 6);
    expect(clock.days).toBeCloseTo(1.2 * 50, 6);
  });

  it('clamps huge frame deltas so a backgrounded tab cannot teleport the sky', () => {
    const clock = new SimulationClock({ speed: 1 });
    clock.advance(60);
    expect(clock.time).toBeCloseTo(0.25, 6);
  });

  it('derivation never mutates the authored document', () => {
    const { project, ids } = buildProject();
    const snapshot = JSON.stringify(project);
    deriveSystemBodies(project, ids.system, ALWAYS_PRESENT);
    deriveGalaxy(project, ALWAYS_PRESENT);
    expect(JSON.stringify(project)).toBe(snapshot);
  });
});
