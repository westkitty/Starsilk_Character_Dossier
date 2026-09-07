import { describe, expect, it } from 'vitest';
import { migrateProject, parseProject, SchemaError, serializeProject, validateProject } from '../src/core/schema';
import { createProject, addEntity, makeEntity } from '../src/core/project';
import { SCHEMA_VERSION } from '../src/core/types';

function validDocument() {
  return JSON.parse(serializeProject(createProject({ title: 'Test Map', id: 'prj-test' })));
}

describe('schema: acceptance', () => {
  it('accepts a freshly created project', () => {
    const result = validateProject(createProject());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.project?.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('accepts a project with a full entity tree', () => {
    let project = createProject({ title: 'Tree' });
    const sector = addEntity(project, {
      type: 'starfield',
      name: 'PHAROS NEBULA',
      parentId: 'galaxy-root',
    });
    project = sector.project;
    const system = addEntity(project, {
      type: 'system',
      name: 'SYSTEM 03',
      parentId: sector.entity.id,
    });
    project = system.project;
    const result = validateProject(JSON.parse(JSON.stringify(project)));
    expect(result.ok).toBe(true);
  });

  it('preserves unknown keys instead of discarding them', () => {
    const doc = validDocument();
    doc.customField = { keep: true };
    doc.entities[0].legacyNote = 'preserved';
    const result = validateProject(doc);
    expect(result.ok).toBe(true);
    expect((result.project as any).customField).toEqual({ keep: true });
    expect((result.project!.entities[0] as any).legacyNote).toBe('preserved');
    expect(result.warnings.some((w) => w.path === '$.customField')).toBe(true);
    expect(result.warnings.some((w) => w.message.includes('legacyNote'))).toBe(true);
  });
});

describe('schema: rejection with useful errors', () => {
  it('rejects a non-object payload', () => {
    const result = validateProject('nope');
    expect(result.ok).toBe(false);
    expect(result.errors[0]!.path).toBe('$');
  });

  it('rejects malformed JSON with the parse message', () => {
    const result = parseProject('{ not json');
    expect(result.ok).toBe(false);
    expect(result.errors[0]!.message).toMatch(/JSON parse failed/);
  });

  it('requires schemaVersion', () => {
    const doc = validDocument();
    delete doc.schemaVersion;
    const result = validateProject(doc);
    expect(result.ok).toBe(false);
    expect(result.errors[0]!.path).toBe('$.schemaVersion');
    expect(result.errors[0]!.message).toMatch(/schemaVersion is required/);
  });

  it('refuses a newer schemaVersion it cannot migrate', () => {
    const doc = validDocument();
    doc.schemaVersion = SCHEMA_VERSION + 4;
    const result = validateProject(doc);
    expect(result.ok).toBe(false);
    expect(result.errors[0]!.message).toMatch(/only understands up to/);
  });

  it('reports duplicate entity ids and dangling parents by path', () => {
    const doc = validDocument();
    doc.entities.push({ ...doc.entities[0] });
    doc.entities.push({
      id: 'orphan',
      parentId: 'does-not-exist',
      type: 'planet',
      name: 'ORPHAN',
      timeline: [],
      meta: { canonStatus: 'schematic' },
    });
    const result = validateProject(doc);
    expect(result.ok).toBe(false);
    const paths = result.errors.map((e) => e.path);
    expect(paths).toContain('$.entities[1].id');
    expect(paths).toContain('$.entities[2].parentId');
    expect(result.errors.some((e) => e.message.includes('does not match any entity id'))).toBe(true);
  });

  it('requires exactly one galaxy root', () => {
    const doc = validDocument();
    doc.entities[0].parentId = 'galaxy-root';
    const result = validateProject(doc);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes('No root entity found'))).toBe(true);
  });

  it('rejects impossible orbital elements', () => {
    const doc = validDocument();
    doc.entities[0].orbit = {
      semiMajorAxis: -3,
      eccentricity: 1.4,
      inclination: 0,
      ascendingNode: 0,
      argumentOfPeriapsis: 0,
      meanAnomalyAtEpoch: 0,
      epoch: 0,
      period: 0,
    };
    const result = validateProject(doc);
    expect(result.ok).toBe(false);
    const messages = result.errors.map((e) => `${e.path}:${e.message}`);
    expect(messages.some((m) => m.startsWith('$.entities[0].orbit.eccentricity'))).toBe(true);
    expect(messages.some((m) => m.startsWith('$.entities[0].orbit.period'))).toBe(true);
  });

  it('rejects an override without a value', () => {
    const doc = validDocument();
    doc.entities[0].time = { mode: 'override' };
    const result = validateProject(doc);
    expect(result.ok).toBe(false);
    expect(result.errors[0]!.path).toBe('$.entities[0].time.overrideValue');
  });

  it('rejects unknown entity and event types', () => {
    const doc = validDocument();
    doc.entities[0].type = 'dysonSphere';
    doc.entities[0].timeline = [
      { id: 'e1', time: 3, label: 'X', eventType: 'vibes', canonStatus: 'locked' },
    ];
    const result = validateProject(doc);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.path === '$.entities[0].type')).toBe(true);
    expect(result.errors.some((e) => e.path === '$.entities[0].timeline[0].eventType')).toBe(true);
  });

  it('detects parent cycles', () => {
    const project = createProject();
    const a = addEntity(project, { type: 'starfield', name: 'A', parentId: 'galaxy-root' });
    const b = addEntity(a.project, { type: 'system', name: 'B', parentId: a.entity.id });
    const cyclic = JSON.parse(JSON.stringify(b.project));
    cyclic.entities.find((e: any) => e.id === a.entity.id).parentId = b.entity.id;
    cyclic.entities.find((e: any) => e.id === b.entity.id).parentId = a.entity.id;
    const result = validateProject(cyclic);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message.includes('parent cycle'))).toBe(true);
  });
});

describe('schema: migrations', () => {
  it('throws SchemaError for a future version', () => {
    expect(() => migrateProject({ schemaVersion: 99 })).toThrow(SchemaError);
  });

  it('is a no-op at the current version', () => {
    const result = migrateProject(validDocument());
    expect(result.migrationsApplied).toEqual([]);
  });
});

describe('entity factory', () => {
  it('assigns stable, unique ids', () => {
    const a = makeEntity({ type: 'planet', name: 'A', parentId: 'p' }, 'schematic');
    const b = makeEntity({ type: 'planet', name: 'B', parentId: 'p' }, 'schematic');
    expect(a.id).not.toBe(b.id);
    expect(a.meta.canonStatus).toBe('schematic');
    expect(a.time).toEqual({ mode: 'inherit' });
  });
});
