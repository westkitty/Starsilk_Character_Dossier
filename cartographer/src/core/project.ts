/**
 * Project structure helpers — pure functions over `StarMapProject`.
 *
 * Everything here returns new objects instead of mutating in place, which is what
 * makes snapshot-based undo/redo trivial and keeps authored data immutable between
 * commits. The renderer only ever reads from these structures.
 */

import { newId } from './ids';
import { defaultEraPresets, MAIN_NARRATIVE_PRESET_ID } from './time';
import {
  defaultSettings,
  SCHEMA_VERSION,
  type CanonStatus,
  type Entity,
  type EntityType,
  type EntityTime,
  type OrbitalElements,
  type StarMapProject,
  type TimelineEvent,
  type TimeValue,
  type VisualProperties,
} from './types';

export function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Allowed composition. Deliberately permissive at the leaves (`other`). */
export const ALLOWED_CHILDREN: Record<EntityType, readonly EntityType[]> = {
  galaxy: ['starfield', 'largeScaleStructure', 'system', 'other'],
  starfield: ['system', 'largeScaleStructure', 'other'],
  system: ['star', 'blackHole', 'planet', 'orbitalStructure', 'other'],
  star: ['planet', 'orbitalStructure', 'other'],
  blackHole: ['other'],
  planet: ['moon', 'bloodRing', 'orbitalStructure', 'other'],
  moon: ['orbitalStructure', 'other'],
  bloodRing: ['other'],
  orbitalStructure: ['other'],
  largeScaleStructure: ['blackHole', 'other'],
  other: ['other'],
};

export function canContain(parentType: EntityType, childType: EntityType): boolean {
  return ALLOWED_CHILDREN[parentType]?.includes(childType) ?? false;
}

export const TYPE_GLYPHS: Record<EntityType, string> = {
  galaxy: '◈',
  starfield: '✦',
  system: '☉',
  star: '★',
  blackHole: '◉',
  planet: '●',
  moon: '○',
  bloodRing: '◎',
  orbitalStructure: '▣',
  largeScaleStructure: '▤',
  other: '·',
};

export function defaultOrbit(semiMajorAxis: number, period: number): OrbitalElements {
  return {
    semiMajorAxis,
    eccentricity: 0,
    inclination: 0,
    ascendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    epoch: 0,
    period,
  };
}

export function defaultVisual(type: EntityType): VisualProperties {
  switch (type) {
    case 'star':
      return {
        displayRadius: 6,
        color: '#ffe6b8',
        emissive: '#ffcf7a',
        emissiveIntensity: 1.1,
        roughness: 0.9,
        facets: 2,
        atmosphere: { enabled: true, color: '#ffd9a0', intensity: 0.45 },
      };
    case 'blackHole':
      return {
        displayRadius: 3.4,
        color: '#04050a',
        emissive: '#0a1420',
        emissiveIntensity: 0.1,
        roughness: 1,
        facets: 3,
        atmosphere: { enabled: true, color: '#55dfff', intensity: 0.22 },
      };
    case 'planet':
      return {
        displayRadius: 2.2,
        color: '#7fa8c9',
        roughness: 0.75,
        metalness: 0.05,
        facets: 3,
        banding: 0.25,
        atmosphere: { enabled: true, color: '#a6efff', intensity: 0.3 },
      };
    case 'moon':
      return {
        displayRadius: 0.7,
        color: '#9fb0bd',
        roughness: 0.9,
        facets: 2,
        banding: 0.12,
      };
    case 'bloodRing':
      return {
        color: '#8d2230',
        roughness: 0.6,
        metalness: 0.1,
        facets: 3,
        banding: 0.6,
        ring: {
          innerRadius: 1.7,
          outerRadius: 3.1,
          thickness: 0.42,
          inclination: 8,
          color: '#6d1a26',
          striations: 26,
        },
      };
    default:
      return { displayRadius: 1.6, color: '#c9d5df', roughness: 0.8, facets: 2 };
  }
}

export interface EntityInit {
  id?: string;
  type: EntityType;
  name: string;
  parentId: string | null;
  position?: Entity['position'];
  orbit?: OrbitalElements;
  visual?: VisualProperties;
  time?: EntityTime;
  timeline?: TimelineEvent[];
  meta?: Partial<Entity['meta']>;
}

export function makeEntity(init: EntityInit, canonStatus: CanonStatus): Entity {
  const entity: Entity = {
    id: init.id ?? newId('ent'),
    parentId: init.parentId,
    type: init.type,
    name: init.name,
    timeline: init.timeline ? deepClone(init.timeline) : [],
    meta: {
      canonStatus,
      description: '',
      tags: [],
      ...(init.meta ?? {}),
    },
  };
  if (init.position) entity.position = deepClone(init.position);
  entity.orbit = init.orbit ? deepClone(init.orbit) : defaultOrbit(1, 1);
  entity.visual = { ...defaultVisual(init.type), ...(init.visual ?? {}) };
  entity.time = init.time ? deepClone(init.time) : { mode: 'inherit' };
  return entity;
}

export function createProject(options?: {
  id?: string;
  title?: string;
  rootName?: string;
  galaxyTime?: TimeValue;
}): StarMapProject {
  const id = options?.id ?? newId('prj');
  const now = new Date().toISOString();
  const galaxy = makeEntity(
    {
      id: 'galaxy-root',
      type: 'galaxy',
      name: options?.rootName ?? 'UNNAMED GALAXY',
      parentId: null,
      position: { x: 0, y: 0, z: 0, unit: 'pc' },
      time: { mode: 'override', overrideValue: options?.galaxyTime ?? MAIN_NARRATIVE_PRESET_ID },
      meta: {
        canonStatus: 'schematic',
        description: '',
        tags: [],
        sourceNote: 'Authoring root. Coordinates in this project are schematic unless a source note says otherwise.',
      },
    },
    'schematic',
  );
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    title: options?.title ?? 'Untitled STARSiLK Star Map',
    createdAt: now,
    updatedAt: now,
    eraPresets: defaultEraPresets(),
    entities: [galaxy],
    settings: defaultSettings(),
  };
}

export function entityById(project: StarMapProject, id: string | null | undefined): Entity | undefined {
  if (!id) return undefined;
  return project.entities.find((e) => e.id === id);
}

export function indexOfEntity(project: StarMapProject, id: string): number {
  return project.entities.findIndex((e) => e.id === id);
}

/** Direct children, in authored order. */
export function childrenOf(project: StarMapProject, parentId: string): Entity[] {
  return project.entities.filter((e) => e.parentId === parentId);
}

export function rootEntity(project: StarMapProject): Entity | undefined {
  return project.entities.find((e) => e.parentId === null);
}

/** Ancestors ordered from the root down to (but excluding) `id`. */
export function ancestorsOf(project: StarMapProject, id: string): Entity[] {
  const chain: Entity[] = [];
  let current = entityById(project, id);
  const guard = new Set<string>();
  while (current && current.parentId) {
    if (guard.has(current.parentId)) break;
    guard.add(current.parentId);
    const parent = entityById(project, current.parentId);
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }
  return chain;
}

/** Root → … → entity (inclusive). */
export function pathOf(project: StarMapProject, id: string): Entity[] {
  const entity = entityById(project, id);
  if (!entity) return [];
  return [...ancestorsOf(project, id), entity];
}

/** Descendants in authored order (depth-first, siblings in array order). */
export function descendantsOf(project: StarMapProject, id: string): Entity[] {
  const out: Entity[] = [];
  const walk = (parentId: string) => {
    for (const child of childrenOf(project, parentId)) {
      out.push(child);
      walk(child.id);
    }
  };
  walk(id);
  return out;
}

export function subtreeIds(project: StarMapProject, id: string): string[] {
  return [id, ...descendantsOf(project, id).map((e) => e.id)];
}

export interface MutationResult {
  project: StarMapProject;
  entity: Entity;
}

/** Append a new entity after its siblings. Returns a new project. */
export function addEntity(
  project: StarMapProject,
  init: EntityInit,
): MutationResult {
  const next = deepClone(project);
  const canonStatus = init.meta?.canonStatus ?? next.settings.defaultCanonStatus;
  const entity = makeEntity({ ...init, parentId: init.parentId }, canonStatus);
  const siblings = childrenOf(next, entity.parentId ?? '');
  const lastSibling = siblings[siblings.length - 1];
  const insertAt = lastSibling ? indexOfEntity(next, lastSibling.id) + 1 : next.entities.length;
  next.entities.splice(insertAt, 0, entity);
  next.updatedAt = new Date().toISOString();
  return { project: next, entity };
}

export function updateEntity(
  project: StarMapProject,
  id: string,
  patch: (entity: Entity) => void,
): StarMapProject {
  const next = deepClone(project);
  const entity = entityById(next, id);
  if (!entity) return next;
  patch(entity);
  next.updatedAt = new Date().toISOString();
  return next;
}

/** Remove an entity and its whole subtree. */
export function removeEntity(project: StarMapProject, id: string): StarMapProject {
  const doomed = new Set(subtreeIds(project, id));
  if (doomed.size === 0) return project;
  const next = deepClone(project);
  next.entities = next.entities.filter((e) => !doomed.has(e.id));
  next.updatedAt = new Date().toISOString();
  return next;
}

export interface DuplicateOptions {
  /** Rename suffix for the clone root. */
  suffix?: string;
  idFactory?: (original: string) => string;
}

/** Deep-clone a subtree with fresh ids. The original is untouched. */
export function duplicateEntity(
  project: StarMapProject,
  id: string,
  options: DuplicateOptions = {},
): MutationResult | null {
  const source = entityById(project, id);
  if (!source) return null;
  const suffix = options.suffix ?? 'COPY';
  const subtree = [source, ...descendantsOf(project, id)];
  const idMap = new Map<string, string>();
  const makeNewId = options.idFactory ?? ((original: string) => `${original}-copy-${newId('d').slice(-6)}`);
  for (const entity of subtree) idMap.set(entity.id, makeNewId(entity.id));

  const next = deepClone(project);
  const clones: Entity[] = [];
  for (const entity of subtree) {
    const clone = deepClone(entity);
    clone.id = idMap.get(entity.id) ?? entity.id;
    clone.parentId = entity.parentId ? (idMap.get(entity.parentId) ?? entity.parentId) : entity.parentId;
    if (entity.id === id) clone.name = `${entity.name} (${suffix})`;
    clones.push(clone);
  }
  const insertAt = indexOfEntity(next, id) + 1;
  next.entities.splice(insertAt, 0, ...clones);
  next.updatedAt = new Date().toISOString();
  const cloneRoot = clones[0]!;
  return { project: next, entity: cloneRoot };
}

/**
 * Re-parent (and optionally reposition) an entity with its subtree.
 * Refuses cycles: a node cannot become its own descendant.
 */
export function moveEntity(
  project: StarMapProject,
  id: string,
  newParentId: string | null,
  beforeId?: string | null,
): StarMapProject | null {
  const entity = entityById(project, id);
  if (!entity) return null;
  if (newParentId === id) return null;
  if (newParentId !== null) {
    const parent = entityById(project, newParentId);
    if (!parent) return null;
    if (subtreeIds(project, id).includes(newParentId)) return null;
    if (!canContain(parent.type, entity.type)) return null;
  }
  const next = deepClone(project);
  const moving = new Set(subtreeIds(project, id));
  const ordered: Entity[] = [];
  let subject: Entity | null = null;
  for (const e of next.entities) {
    if (e.id === id) {
      subject = e;
      continue;
    }
    if (!moving.has(e.id)) ordered.push(e);
  }
  if (!subject) return null;
  subject.parentId = newParentId;
  if (newParentId === null && next.entities.some((e) => e.parentId === null && e.id !== id)) {
    // A project has exactly one root; refuse a second detached root.
    return null;
  }
  let insertAt = ordered.length;
  if (beforeId) {
    const at = ordered.findIndex((e) => e.id === beforeId);
    if (at >= 0) insertAt = at;
  } else if (newParentId !== null) {
    const siblings = ordered.filter((e) => e.parentId === newParentId);
    const last = siblings[siblings.length - 1];
    insertAt = last ? ordered.indexOf(last) + 1 : ordered.length;
  }
  ordered.splice(insertAt, 0, subject);
  // Re-attach the subtree directly after its subject to keep sibling order stable.
  const rest = next.entities.filter((e) => moving.has(e.id) && e.id !== id);
  const final: Entity[] = [];
  for (const e of ordered) {
    final.push(e);
    if (e.id === id) final.push(...rest);
  }
  next.entities = final;
  next.updatedAt = new Date().toISOString();
  return next;
}

/** Reorder direct children of `parentId` to the given id order. */
export function reorderChildren(
  project: StarMapProject,
  parentId: string,
  orderedIds: readonly string[],
): StarMapProject {
  const next = deepClone(project);
  const rank = new Map(orderedIds.map((id, index) => [id, index]));
  const kids = next.entities.filter((e) => e.parentId === parentId);
  kids.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  const kidIds = new Set(kids.map((k) => k.id));
  const out: Entity[] = [];
  let inserted = false;
  for (const e of next.entities) {
    if (kidIds.has(e.id)) {
      if (!inserted) {
        out.push(...kids);
        inserted = true;
      }
      continue;
    }
    out.push(e);
  }
  next.entities = out;
  next.updatedAt = new Date().toISOString();
  return next;
}

export function renameEntity(
  project: StarMapProject,
  id: string,
  name: string,
): StarMapProject {
  return updateEntity(project, id, (entity) => {
    entity.name = name.trim().length > 0 ? name.trim() : entity.name;
  });
}

/* ------------------------------------------------------------------ *
 * Historical time helpers (structural; resolution lives in resolve.ts)
 * ------------------------------------------------------------------ */

export function setTimeOverride(
  project: StarMapProject,
  id: string,
  value: TimeValue,
): StarMapProject {
  return updateEntity(project, id, (entity) => {
    entity.time = { mode: 'override', overrideValue: value };
  });
}

/** "RETURN TO PARENT TIME" — the branch resumes inheriting immediately. */
export function returnToParentTime(project: StarMapProject, id: string): StarMapProject {
  return updateEntity(project, id, (entity) => {
    entity.time = { mode: 'inherit' };
  });
}

export function timeModeOf(entity: Entity): EntityTime {
  return entity.time ?? { mode: 'inherit' };
}

/* ------------------------------------------------------------------ *
 * Timeline helpers
 * ------------------------------------------------------------------ */

export function addTimelineEvent(
  project: StarMapProject,
  entityId: string,
  event: Omit<TimelineEvent, 'id'> & { id?: string },
): MutationResult & { event: TimelineEvent } {
  const next = deepClone(project);
  const entity = entityById(next, entityId);
  const created: TimelineEvent = { ...deepClone(event), id: event.id ?? newId('evt') };
  if (entity) {
    entity.timeline.push(created);
    next.updatedAt = new Date().toISOString();
  }
  return { project: next, entity: entity ?? ({} as Entity), event: created };
}

export function updateTimelineEvent(
  project: StarMapProject,
  entityId: string,
  eventId: string,
  patch: (event: TimelineEvent) => void,
): StarMapProject {
  return updateEntity(project, entityId, (entity) => {
    const event = entity.timeline.find((e) => e.id === eventId);
    if (event) patch(event);
  });
}

export function removeTimelineEvent(
  project: StarMapProject,
  entityId: string,
  eventId: string,
): StarMapProject {
  return updateEntity(project, entityId, (entity) => {
    entity.timeline = entity.timeline.filter((e) => e.id !== eventId);
  });
}
