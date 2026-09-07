import { describe, expect, it } from 'vitest';
import {
  addEntity,
  ancestorsOf,
  canContain,
  childrenOf,
  createProject,
  descendantsOf,
  duplicateEntity,
  moveEntity,
  pathOf,
  removeEntity,
  renameEntity,
  reorderChildren,
  returnToParentTime,
  setTimeOverride,
  subtreeIds,
  timeModeOf,
} from '../src/core/project';

function sampleProject() {
  let project = createProject({ title: 'Sample', id: 'prj-sample' });
  const sector = addEntity(project, {
    type: 'starfield',
    name: 'PHAROS NEBULA',
    parentId: 'galaxy-root',
  });
  project = sector.project;
  const other = addEntity(project, {
    type: 'starfield',
    name: 'FALLENSTAR REGION',
    parentId: 'galaxy-root',
  });
  project = other.project;
  const system = addEntity(project, {
    type: 'system',
    name: 'SYSTEM 03',
    parentId: sector.entity.id,
  });
  project = system.project;
  const star = addEntity(project, { type: 'star', name: 'STAR', parentId: system.entity.id });
  project = star.project;
  const planet = addEntity(project, { type: 'planet', name: 'PLANET A', parentId: system.entity.id });
  project = planet.project;
  return {
    project,
    ids: {
      sector: sector.entity.id,
      other: other.entity.id,
      system: system.entity.id,
      star: star.entity.id,
      planet: planet.entity.id,
    },
  };
}

describe('hierarchy composition', () => {
  it('enforces allowed parent/child combinations', () => {
    expect(canContain('galaxy', 'starfield')).toBe(true);
    expect(canContain('planet', 'bloodRing')).toBe(true);
    expect(canContain('planet', 'moon')).toBe(true);
    expect(canContain('moon', 'planet')).toBe(false);
    expect(canContain('bloodRing', 'planet')).toBe(false);
  });

  it('keeps sibling order and computes ancestry', () => {
    const { project, ids } = sampleProject();
    expect(childrenOf(project, 'galaxy-root').map((e) => e.name)).toEqual([
      'PHAROS NEBULA',
      'FALLENSTAR REGION',
    ]);
    expect(ancestorsOf(project, ids.planet).map((e) => e.name)).toEqual([
      'UNNAMED GALAXY',
      'PHAROS NEBULA',
      'SYSTEM 03',
    ]);
    expect(pathOf(project, ids.planet).map((e) => e.name)).toEqual([
      'UNNAMED GALAXY',
      'PHAROS NEBULA',
      'SYSTEM 03',
      'PLANET A',
    ]);
    expect(descendantsOf(project, ids.sector).map((e) => e.name)).toEqual([
      'SYSTEM 03',
      'STAR',
      'PLANET A',
    ]);
  });

  it('removes an entire subtree', () => {
    const { project, ids } = sampleProject();
    const next = removeEntity(project, ids.system);
    expect(next.entities.find((e) => e.id === ids.system)).toBeUndefined();
    expect(next.entities.find((e) => e.id === ids.star)).toBeUndefined();
    expect(next.entities.find((e) => e.id === ids.planet)).toBeUndefined();
    expect(next.entities.find((e) => e.id === ids.other)).toBeDefined();
  });

  it('duplicates a subtree with fresh ids and a marked name', () => {
    const { project, ids } = sampleProject();
    const result = duplicateEntity(project, ids.system)!;
    expect(result.entity.name).toBe('SYSTEM 03 (COPY)');
    expect(result.entity.id).not.toBe(ids.system);
    const clones = descendantsOf(result.project, result.entity.id);
    expect(clones.map((e) => e.name)).toEqual(['STAR', 'PLANET A']);
    expect(subtreeIds(project, ids.system)).toHaveLength(3);
    expect(subtreeIds(result.project, result.entity.id)).toHaveLength(3);
    // Original untouched.
    expect(project.entities.find((e) => e.id === ids.system)?.name).toBe('SYSTEM 03');
  });

  it('refuses to move a node inside its own subtree', () => {
    const { project, ids } = sampleProject();
    expect(moveEntity(project, ids.sector, ids.planet)).toBeNull();
  });

  it('moves a subtree to a new parent', () => {
    const { project, ids } = sampleProject();
    const moved = moveEntity(project, ids.system, ids.other)!;
    expect(moved.entities.find((e) => e.id === ids.system)?.parentId).toBe(ids.other);
    expect(descendantsOf(moved, ids.other).map((e) => e.name)).toEqual([
      'SYSTEM 03',
      'STAR',
      'PLANET A',
    ]);
  });

  it('reorders siblings deterministically', () => {
    const { project, ids } = sampleProject();
    const next = reorderChildren(project, 'galaxy-root', [ids.other, ids.sector]);
    expect(childrenOf(next, 'galaxy-root').map((e) => e.id)).toEqual([ids.other, ids.sector]);
  });

  it('renames and preserves ids', () => {
    const { project, ids } = sampleProject();
    const next = renameEntity(project, ids.planet, 'PLANET RENAMED');
    expect(next.entities.find((e) => e.id === ids.planet)?.name).toBe('PLANET RENAMED');
  });
});

describe('structural time helpers', () => {
  it('defaults to inherit and can be overridden then returned to parent', () => {
    const { project, ids } = sampleProject();
    const entity = project.entities.find((e) => e.id === ids.system)!;
    expect(timeModeOf(entity)).toEqual({ mode: 'inherit' });
    const overridden = setTimeOverride(project, ids.system, 121);
    expect(overridden.entities.find((e) => e.id === ids.system)?.time).toEqual({
      mode: 'override',
      overrideValue: 121,
    });
    const restored = returnToParentTime(overridden, ids.system);
    expect(restored.entities.find((e) => e.id === ids.system)?.time).toEqual({ mode: 'inherit' });
  });
});
