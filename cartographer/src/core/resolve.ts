/**
 * HIERARCHICAL HISTORICAL RESOLUTION — the defining mechanic.
 *
 * Historical time exists at four scopes (GALAXY → SECTOR → SYSTEM → OBJECT).
 * Children inherit their parent's resolved time unless they carry an override;
 * `RETURN TO PARENT TIME` removes the override and inheritance resumes at once.
 *
 * History itself is a set of ordered, discrete events with state patches — never a
 * duplicated galaxy per era. Resolution therefore works like this:
 *
 *   1. resolve each entity's effective historical time by walking up the tree;
 *   2. apply that entity's own timeline events whose time is at or before the
 *      resolved time, in chronological order, merging their discrete state patches;
 *   3. derive presence: an entity with a creation event is absent before it, an
 *      entity with a destruction event is absent from it onwards;
 *   4. propagate absence down the tree, and mark systems whose star has suffered a
 *      Starsilk extraction collapse as historically destroyed — which removes their
 *      worlds while the black hole itself remains on the plate.
 *
 * Scrubbing backwards only changes what is *visualised*. It never deletes an event
 * and never implies resurrection.
 */

import { childrenOf, entityById, pathOf } from './project';
import { compareTime, describeTime, MAIN_NARRATIVE_PRESET_ID, sortEvents } from './time';
import {
  CANON_STATUSES,
  CREATION_EVENT_TYPES,
  DESTRUCTION_EVENT_TYPES,
  ENTITY_TYPES,
  type CanonStatus,
  type Entity,
  type EntityType,
  type StarMapProject,
  type TimelineEvent,
  type TimeValue,
} from './types';
import type { DerivationContext } from '../render/derive';

export type AbsenceReason =
  | 'before-creation'
  | 'destroyed'
  | 'ancestor-absent'
  | 'system-destroyed'
  | 'canon-filtered';

export interface TimeResolution {
  time: TimeValue;
  mode: 'inherit' | 'override';
  /** Entity whose override (or root value) supplies this time. */
  fromEntityId: string | null;
  /** Chain from the root down to the supplying entity (ids). */
  chain: string[];
  /** Number of generations between the entity and the supplying entity. */
  depth: number;
}

export interface ResolvedEntity {
  entityId: string;
  type: EntityType;
  effectiveType: EntityType;
  name: string;
  effectiveName: string;
  resolution: TimeResolution;
  present: boolean;
  absenceReason?: AbsenceReason;
  /** Discrete properties merged from applied event patches. */
  properties: Record<string, unknown>;
  appliedEvents: TimelineEvent[];
  pendingEvents: TimelineEvent[];
  starCollapsed: boolean;
  systemDestroyed: boolean;
  /** Set when this entity carries the collapse that destroyed its system. */
  collapseEventId?: string;
  destructionTime?: TimeValue;
  creationTime?: TimeValue;
  canonStatus: CanonStatus;
  labelSuffix?: string;
}

export const CANON_VISIBLE_STATUSES: readonly CanonStatus[] = ['locked', 'working'];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function applyPatch(target: Record<string, unknown>, patch: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(patch)) {
    const existing = target[key];
    if (isPlainObject(value) && isPlainObject(existing)) {
      target[key] = { ...existing, ...value };
    } else {
      target[key] = value;
    }
  }
}

/**
 * Resolve the historical time in force for one entity.
 *
 * Walks up until it finds an override; a root without one falls back to the main
 * narrative anchor so a fresh project always has a definite era.
 */
export function resolveTimeFor(project: StarMapProject, entityId: string): TimeResolution {
  const chain = pathOf(project, entityId);
  if (chain.length === 0) {
    return {
      time: MAIN_NARRATIVE_PRESET_ID,
      mode: 'inherit',
      fromEntityId: null,
      chain: [],
      depth: 0,
    };
  }
  const self = chain[chain.length - 1]!;
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    const candidate = chain[i]!;
    const time = candidate.time;
    if (time?.mode === 'override' && time.overrideValue !== undefined) {
      return {
        time: time.overrideValue,
        // `mode` always describes THIS entity's own time block: it inherits unless
        // it is the entity that carries the override.
        mode: candidate.id === self.id ? 'override' : 'inherit',
        fromEntityId: candidate.id,
        chain: chain.slice(0, i + 1).map((e) => e.id),
        depth: chain.length - 1 - i,
      };
    }
  }
  return {
    time: MAIN_NARRATIVE_PRESET_ID,
    mode: 'inherit',
    fromEntityId: chain[0]!.id,
    chain: chain.map((e) => e.id),
    depth: chain.length - 1,
  };
}

export interface ResolveOptions {
  /** Hide anything that is not locked or working canon (a view filter, not history). */
  canonOnly?: boolean;
}

/** Resolve the historical state of every entity in the project. */
export function resolveHistoricalState(
  project: StarMapProject,
  options: ResolveOptions = {},
): Map<string, ResolvedEntity> {
  const presets = project.eraPresets;
  const resolved = new Map<string, ResolvedEntity>();

  /* pass 1 — per-entity timelines ------------------------------------ */
  for (const entity of project.entities) {
    const resolution = resolveTimeFor(project, entity.id);
    const now = resolution.time;
    const ordered = sortEvents(entity.timeline, presets);

    const applied: TimelineEvent[] = [];
    const pending: TimelineEvent[] = [];
    for (const event of ordered) {
      if (compareTime(event.time, now, presets) <= 0) applied.push(event);
      else pending.push(event);
    }

    const properties: Record<string, unknown> = {};
    let starCollapsed = false;
    let collapseEventId: string | undefined;
    let creationTime: TimeValue | undefined;
    let destructionTime: TimeValue | undefined;
    let destroyed = false;

    for (const event of applied) {
      if (event.statePatch) applyPatch(properties, event.statePatch);
      if (CREATION_EVENT_TYPES.includes(event.eventType)) creationTime = event.time;
      if (DESTRUCTION_EVENT_TYPES.includes(event.eventType)) {
        destroyed = true;
        destructionTime = event.time;
      }
      if (event.eventType === 'starsilkExtractionCollapse') {
        starCollapsed = true;
        collapseEventId = event.id;
        destructionTime = event.time;
      }
    }

    const hasCreationEvent = entity.timeline.some((event) =>
      CREATION_EVENT_TYPES.includes(event.eventType),
    );
    const beforeCreation = hasCreationEvent && creationTime === undefined;

    let effectiveType = entity.type;
    const patchedType = properties.type;
    if (typeof patchedType === 'string' && (ENTITY_TYPES as readonly string[]).includes(patchedType)) {
      effectiveType = patchedType as EntityType;
    } else if (starCollapsed && entity.type === 'star') {
      effectiveType = 'blackHole';
    }

    const effectiveName =
      typeof properties.name === 'string' && properties.name.trim().length > 0
        ? properties.name
        : entity.name;

    resolved.set(entity.id, {
      entityId: entity.id,
      type: entity.type,
      effectiveType,
      name: entity.name,
      effectiveName,
      resolution,
      present: !destroyed && !beforeCreation,
      absenceReason: destroyed
        ? 'destroyed'
        : beforeCreation
          ? 'before-creation'
          : undefined,
      properties,
      appliedEvents: applied,
      pendingEvents: pending,
      starCollapsed,
      systemDestroyed: false,
      collapseEventId,
      destructionTime,
      creationTime,
      canonStatus: entity.meta.canonStatus,
      labelSuffix:
        typeof properties.labelSuffix === 'string' ? properties.labelSuffix : undefined,
    });
  }

  /* pass 2 — systems destroyed by stellar collapse --------------------- */
  for (const entity of project.entities) {
    if (entity.type !== 'system') continue;
    const star = childrenOf(project, entity.id).find(
      (child) => child.type === 'star' || child.type === 'blackHole',
    );
    if (!star) continue;
    const starState = resolved.get(star.id);
    if (!starState?.starCollapsed) continue;
    const systemState = resolved.get(entity.id);
    if (!systemState) continue;
    // The collapse is only in this system's past when it is at or before the
    // system's own resolved time.
    if (compareTime(starState.destructionTime ?? MAIN_NARRATIVE_PRESET_ID, systemState.resolution.time, presets) > 0) {
      continue;
    }
    systemState.systemDestroyed = true;
    systemState.labelSuffix = '· SYSTEM HISTORICALLY DESTROYED';
    for (const child of childrenOf(project, entity.id)) {
      if (child.id === star.id) continue;
      markSubtreeAbsent(resolved, project, child.id, 'system-destroyed');
    }
  }

  /* pass 3 — ancestor absence propagates downward ---------------------- */
  for (const entity of project.entities) {
    const state = resolved.get(entity.id);
    if (!state || !state.present) continue;
    const chain = pathOf(project, entity.id);
    for (let i = 0; i < chain.length - 1; i += 1) {
      const ancestor = resolved.get(chain[i]!.id);
      if (ancestor && !ancestor.present && ancestor.absenceReason !== 'canon-filtered') {
        state.present = false;
        state.absenceReason = 'ancestor-absent';
        break;
      }
    }
  }

  /* pass 4 — canon-only view filter ----------------------------------- */
  if (options.canonOnly) {
    for (const state of resolved.values()) {
      if (!state.present) continue;
      if (!CANON_VISIBLE_STATUSES.includes(state.canonStatus)) {
        state.present = false;
        state.absenceReason = 'canon-filtered';
      }
    }
  }

  return resolved;
}

function markSubtreeAbsent(
  resolved: Map<string, ResolvedEntity>,
  project: StarMapProject,
  entityId: string,
  reason: AbsenceReason,
): void {
  const state = resolved.get(entityId);
  if (state && state.present) {
    state.present = false;
    state.absenceReason = reason;
  }
  for (const child of childrenOf(project, entityId)) {
    markSubtreeAbsent(resolved, project, child.id, reason);
  }
}

/* ------------------------------------------------------------------ *
 * Presentation helpers
 * ------------------------------------------------------------------ */

export function describeResolution(
  project: StarMapProject,
  state: ResolvedEntity,
): { value: string; mode: string; source: string } {
  const source = state.resolution.fromEntityId
    ? (entityById(project, state.resolution.fromEntityId)?.name ?? state.resolution.fromEntityId)
    : 'PROJECT DEFAULT';
  return {
    value: describeTime(state.resolution.time, project.eraPresets),
    mode: state.resolution.mode === 'override' ? 'OVERRIDE' : 'INHERITED',
    source,
  };
}

/** Every distinct event across the project, ordered along the historical axis. */
export function allEventsOrdered(
  project: StarMapProject,
): Array<{ event: TimelineEvent; entityId: string; entityName: string }> {
  const entries: Array<{ event: TimelineEvent; entityId: string; entityName: string }> = [];
  for (const entity of project.entities) {
    for (const event of entity.timeline) {
      entries.push({ event, entityId: entity.id, entityName: entity.name });
    }
  }
  return entries.sort((a, b) => compareTime(a.event.time, b.event.time, project.eraPresets));
}

/** Events attached to one entity, ordered along the historical axis. */
export function eventsFor(project: StarMapProject, entityId: string): TimelineEvent[] {
  const entity = entityById(project, entityId);
  return entity ? sortEvents(entity.timeline, project.eraPresets) : [];
}

/* ------------------------------------------------------------------ *
 * Renderer bridge
 * ------------------------------------------------------------------ */

/**
 * Adapt a resolution into the small interface the renderer consumes. Keeping this
 * adapter means the Three.js layer never learns about eras, patches, or canon
 * filters — and the viewer embed reuses exactly the same bridge.
 */
export function derivationContextFor(
  resolution: Map<string, ResolvedEntity>,
): DerivationContext {
  return {
    present: (entityId: string) => resolution.get(entityId)?.present ?? true,
    effectiveType: (entity: Entity) =>
      resolution.get(entity.id)?.effectiveType ?? entity.type,
    annotate: (entity: Entity) => {
      const state = resolution.get(entity.id);
      if (!state) return undefined;
      const parts: string[] = [];
      if (state.labelSuffix) parts.push(state.labelSuffix);
      if (!state.present && state.absenceReason) parts.push(absenceLabel(state.absenceReason));
      return {
        suffix: parts.length > 0 ? parts.join(' ') : undefined,
        destroyed: state.systemDestroyed || state.absenceReason === 'destroyed',
      };
    },
  };
}

export function absenceLabel(reason: AbsenceReason): string {
  switch (reason) {
    case 'before-creation':
      return '· NOT YET FORMED';
    case 'destroyed':
      return '· DESTROYED';
    case 'ancestor-absent':
      return '· WITH PARENT ABSENT';
    case 'system-destroyed':
      return '· SYSTEM DESTROYED';
    case 'canon-filtered':
      return '· NON-CANON (FILTERED)';
    default:
      return '';
  }
}

/** Convenience: is this canon status visible under the CANON ONLY filter? */
export function passesCanonFilter(status: CanonStatus, canonOnly: boolean): boolean {
  if (!canonOnly) return true;
  return CANON_VISIBLE_STATUSES.includes(status);
}

export function canonStatuses(): readonly CanonStatus[] {
  return CANON_STATUSES;
}
