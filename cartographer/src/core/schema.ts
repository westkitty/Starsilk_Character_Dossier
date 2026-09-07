/**
 * Project schema validation + migration.
 *
 * Import never silently discards state:
 *  - unknown keys are preserved on the object and reported as warnings;
 *  - malformed *required* fields produce precise, path-qualified errors and the
 *    import is refused rather than partially applied;
 *  - newer `schemaVersion` values are refused with an explanatory message unless a
 *    registered migration exists.
 */

import { isNonEmptyString } from './ids';
import { deepClone } from './project';
import { isTimeValue } from './time';
import {
  CANON_STATUSES,
  defaultSettings,
  ENTITY_TYPES,
  EVENT_TYPES,
  SCHEMA_VERSION,
  type CanonStatus,
  type Entity,
  type EntityType,
  type EraPreset,
  type HistoricalEventType,
  type StarMapProject,
} from './types';

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  /** Present only when `ok` is true. */
  project?: StarMapProject;
  /** Migrations that were applied during import. */
  migrationsApplied: number[];
}

export class SchemaError extends Error {
  constructor(message: string, readonly path = '$') {
    super(message);
    this.name = 'SchemaError';
  }
}

type Migration = (value: any) => any;

/**
 * Version → step migration. `MIGRATIONS[1]` converts a version-1 document to
 * version 2, and so on. Future schema changes add entries here; nothing else in
 * the application needs to know about older documents.
 */
export const MIGRATIONS: Record<number, Migration> = {};

export function migrateProject(input: unknown): { value: any; migrationsApplied: number[] } {
  if (typeof input !== 'object' || input === null) {
    throw new SchemaError('Project JSON must be an object.', '$');
  }
  const declared = (input as { schemaVersion?: unknown }).schemaVersion;
  if (typeof declared !== 'number' || !Number.isInteger(declared)) {
    throw new SchemaError(
      `schemaVersion is required and must be an integer (this build writes ${SCHEMA_VERSION}).`,
      '$.schemaVersion',
    );
  }
  if (declared > SCHEMA_VERSION) {
    throw new SchemaError(
      `This file declares schemaVersion ${declared}, but this build only understands up to ${SCHEMA_VERSION}. Open it in a newer Cartographer or export it again from the older tool.`,
      '$.schemaVersion',
    );
  }
  let value: any = input;
  const applied: number[] = [];
  for (let version = declared; version < SCHEMA_VERSION; version += 1) {
    const step = MIGRATIONS[version];
    if (!step) {
      throw new SchemaError(
        `No migration is registered for schemaVersion ${version} → ${version + 1}.`,
        '$.schemaVersion',
      );
    }
    value = step(value);
    applied.push(version + 1);
  }
  return { value, migrationsApplied: applied };
}

const KNOWN_ENTITY_KEYS = new Set([
  'id',
  'parentId',
  'type',
  'name',
  'position',
  'orbit',
  'visual',
  'time',
  'timeline',
  'meta',
]);

const KNOWN_PROJECT_KEYS = new Set([
  'schemaVersion',
  'id',
  'title',
  'createdAt',
  'updatedAt',
  'eraPresets',
  'entities',
  'settings',
]);

const KNOWN_EVENT_KEYS = new Set([
  'id',
  'time',
  'label',
  'eventType',
  'statePatch',
  'canonStatus',
  'sourceNote',
  'sourceHref',
]);

const KNOWN_META_KEYS = new Set([
  'description',
  'tags',
  'canonStatus',
  'sourceNote',
  'sourceHref',
  'dossierHref',
]);

const ORBIT_KEYS = [
  'semiMajorAxis',
  'eccentricity',
  'inclination',
  'ascendingNode',
  'argumentOfPeriapsis',
  'meanAnomalyAtEpoch',
  'epoch',
  'period',
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Validate a whole project document. Never throws; returns issues instead. */
export function validateProject(input: unknown): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const fail = (path: string, message: string) => {
    errors.push({ path, message });
  };
  const warn = (path: string, message: string) => {
    warnings.push({ path, message });
  };

  if (!isPlainObject(input)) {
    return {
      ok: false,
      errors: [{ path: '$', message: 'Project JSON must be an object.' }],
      warnings: [],
      migrationsApplied: [],
    };
  }

  let migrated: any;
  let migrationsApplied: number[] = [];
  try {
    const result = migrateProject(input);
    migrated = result.value;
    migrationsApplied = result.migrationsApplied;
  } catch (error) {
    const schemaError = error as SchemaError;
    return {
      ok: false,
      errors: [{ path: schemaError.path, message: schemaError.message }],
      warnings: [],
      migrationsApplied: [],
    };
  }

  const doc = deepClone(migrated) as Record<string, any>;

  if (!isNonEmptyString(doc.id)) fail('$.id', 'Project id must be a non-empty string.');
  if (!isNonEmptyString(doc.title)) fail('$.title', 'Project title must be a non-empty string.');

  for (const key of Object.keys(doc)) {
    if (!KNOWN_PROJECT_KEYS.has(key)) {
      warn(`$.${key}`, `Unknown project key “${key}” was preserved as-is.`);
    }
  }

  /* eraPresets ------------------------------------------------------- */
  if (doc.eraPresets === undefined) {
    warn('$.eraPresets', 'Missing eraPresets; the built-in preset list was supplied.');
    doc.eraPresets = [];
  }
  if (!Array.isArray(doc.eraPresets)) {
    fail('$.eraPresets', 'eraPresets must be an array.');
    doc.eraPresets = [];
  } else {
    const seenPresetIds = new Set<string>();
    (doc.eraPresets as any[]).forEach((preset, index) => {
      const path = `$.eraPresets[${index}]`;
      if (!isPlainObject(preset)) {
        fail(path, 'Era preset must be an object.');
        return;
      }
      if (!isNonEmptyString(preset.id)) fail(`${path}.id`, 'Era preset id must be a non-empty string.');
      else if (seenPresetIds.has(preset.id)) fail(`${path}.id`, `Duplicate era preset id “${preset.id}”.`);
      else seenPresetIds.add(preset.id);
      if (!isNonEmptyString(preset.label)) fail(`${path}.label`, 'Era preset label must be a non-empty string.');
      if (!isFiniteNumber(preset.order)) fail(`${path}.order`, 'Era preset order must be a finite number.');
      if (preset.time !== undefined && !isFiniteNumber(preset.time)) {
        fail(`${path}.time`, 'Era preset time must be a finite number when present.');
      }
      if (preset.canonStatus !== undefined && !CANON_STATUSES.includes(preset.canonStatus as CanonStatus)) {
        fail(`${path}.canonStatus`, `canonStatus must be one of: ${CANON_STATUSES.join(', ')}.`);
      }
    });
  }

  /* entities --------------------------------------------------------- */
  if (!Array.isArray(doc.entities)) {
    fail('$.entities', 'entities must be an array.');
    doc.entities = [];
  }
  if (Array.isArray(doc.entities) && doc.entities.length === 0) {
    fail('$.entities', 'entities must contain at least one entity (the galaxy root).');
  }

  const seenIds = new Set<string>();
  const entities = Array.isArray(doc.entities) ? (doc.entities as any[]) : [];

  entities.forEach((raw, index) => {
    const path = `$.entities[${index}]`;
    if (!isPlainObject(raw)) {
      fail(path, 'Entity must be an object.');
      return;
    }
    const entity = raw as Record<string, any>;

    if (!isNonEmptyString(entity.id)) fail(`${path}.id`, 'Entity id must be a non-empty string.');
    else if (seenIds.has(entity.id)) fail(`${path}.id`, `Duplicate entity id “${entity.id}”.`);
    else seenIds.add(entity.id);

    if (entity.parentId !== null && !isNonEmptyString(entity.parentId)) {
      fail(`${path}.parentId`, 'parentId must be null or a non-empty string.');
    }
    if (!ENTITY_TYPES.includes(entity.type as EntityType)) {
      fail(`${path}.type`, `Unknown entity type “${String(entity.type)}”. Allowed: ${ENTITY_TYPES.join(', ')}.`);
    }
    if (!isNonEmptyString(entity.name)) fail(`${path}.name`, 'Entity name must be a non-empty string.');

    for (const key of Object.keys(entity)) {
      if (!KNOWN_ENTITY_KEYS.has(key)) {
        warn(`${path}.${key}`, `Unknown entity key “${key}” was preserved as-is.`);
      }
    }

    if (entity.position !== undefined) {
      if (!isPlainObject(entity.position)) fail(`${path}.position`, 'position must be an object.');
      else {
        for (const axis of ['x', 'y', 'z'] as const) {
          if (!isFiniteNumber(entity.position[axis])) {
            fail(`${path}.position.${axis}`, `position.${axis} must be a finite number.`);
          }
        }
      }
    }

    if (entity.orbit !== undefined) {
      if (!isPlainObject(entity.orbit)) fail(`${path}.orbit`, 'orbit must be an object.');
      else {
        for (const key of ORBIT_KEYS) {
          if (!isFiniteNumber(entity.orbit[key])) {
            fail(`${path}.orbit.${key}`, `orbit.${key} must be a finite number.`);
          }
        }
        if (isFiniteNumber(entity.orbit.eccentricity)) {
          if (entity.orbit.eccentricity < 0 || entity.orbit.eccentricity >= 1) {
            fail(`${path}.orbit.eccentricity`, 'orbit.eccentricity must satisfy 0 ≤ e < 1.');
          }
        }
        if (isFiniteNumber(entity.orbit.semiMajorAxis) && entity.orbit.semiMajorAxis <= 0) {
          fail(`${path}.orbit.semiMajorAxis`, 'orbit.semiMajorAxis must be greater than 0.');
        }
        if (isFiniteNumber(entity.orbit.period) && entity.orbit.period <= 0) {
          fail(`${path}.orbit.period`, 'orbit.period must be greater than 0.');
        }
      }
    }

    if (entity.visual !== undefined && !isPlainObject(entity.visual)) {
      fail(`${path}.visual`, 'visual must be an object.');
    }
    if (isPlainObject(entity.visual) && isPlainObject(entity.visual.ring)) {
      const ring = entity.visual.ring as Record<string, unknown>;
      if (isFiniteNumber(ring.innerRadius) && isFiniteNumber(ring.outerRadius) && ring.outerRadius <= ring.innerRadius) {
        warn(`${path}.visual.ring`, 'ring.outerRadius is not greater than ring.innerRadius; the ring may render degenerate.');
      }
    }

    if (entity.time !== undefined) {
      if (!isPlainObject(entity.time)) fail(`${path}.time`, 'time must be an object.');
      else {
        const mode = entity.time.mode;
        if (mode !== 'inherit' && mode !== 'override') {
          fail(`${path}.time.mode`, 'time.mode must be "inherit" or "override".');
        }
        if (mode === 'override' && !isTimeValue(entity.time.overrideValue)) {
          fail(
            `${path}.time.overrideValue`,
            'time.overrideValue is required when time.mode is "override" (a finite number or a non-empty string).',
          );
        }
      }
    }

    if (!Array.isArray(entity.timeline)) {
      fail(`${path}.timeline`, 'timeline must be an array (use [] for no events).');
    } else {
      const seenEventIds = new Set<string>();
      (entity.timeline as any[]).forEach((rawEvent, eventIndex) => {
        const ePath = `${path}.timeline[${eventIndex}]`;
        if (!isPlainObject(rawEvent)) {
          fail(ePath, 'Timeline event must be an object.');
          return;
        }
        if (!isNonEmptyString(rawEvent.id)) fail(`${ePath}.id`, 'Timeline event id must be a non-empty string.');
        else if (seenEventIds.has(rawEvent.id)) fail(`${ePath}.id`, `Duplicate timeline event id “${rawEvent.id}”.`);
        else seenEventIds.add(rawEvent.id);
        if (!isTimeValue(rawEvent.time)) fail(`${ePath}.time`, 'Timeline event time must be a finite number or a non-empty string.');
        if (!isNonEmptyString(rawEvent.label)) fail(`${ePath}.label`, 'Timeline event label must be a non-empty string.');
        if (!EVENT_TYPES.includes(rawEvent.eventType as HistoricalEventType)) {
          fail(`${ePath}.eventType`, `Unknown eventType “${String(rawEvent.eventType)}”. Allowed: ${EVENT_TYPES.join(', ')}.`);
        }
        if (!CANON_STATUSES.includes(rawEvent.canonStatus as CanonStatus)) {
          fail(`${ePath}.canonStatus`, `canonStatus must be one of: ${CANON_STATUSES.join(', ')}.`);
        }
        if (rawEvent.statePatch !== undefined && !isPlainObject(rawEvent.statePatch)) {
          fail(`${ePath}.statePatch`, 'statePatch must be an object when present.');
        }
        for (const key of Object.keys(rawEvent)) {
          if (!KNOWN_EVENT_KEYS.has(key)) warn(`${ePath}.${key}`, `Unknown event key “${key}” was preserved as-is.`);
        }
      });
    }

    if (!isPlainObject(entity.meta)) {
      fail(`${path}.meta`, 'meta must be an object.');
    } else {
      if (!CANON_STATUSES.includes(entity.meta.canonStatus as CanonStatus)) {
        fail(
          `${path}.meta.canonStatus`,
          `meta.canonStatus must be one of: ${CANON_STATUSES.join(', ')}.`,
        );
      }
      if (entity.meta.tags !== undefined && !Array.isArray(entity.meta.tags)) {
        fail(`${path}.meta.tags`, 'meta.tags must be an array of strings.');
      }
      for (const key of Object.keys(entity.meta)) {
        if (!KNOWN_META_KEYS.has(key)) warn(`${path}.meta.${key}`, `Unknown meta key “${key}” was preserved as-is.`);
      }
    }
  });

  /* referential integrity + single root ------------------------------ */
  const idToEntity = new Map<string, any>();
  for (const entity of entities) {
    if (isPlainObject(entity) && isNonEmptyString(entity.id)) idToEntity.set(entity.id, entity);
  }
  const roots: any[] = [];
  entities.forEach((entity, index) => {
    if (!isPlainObject(entity)) return;
    const path = `$.entities[${index}]`;
    if (entity.parentId === null || entity.parentId === undefined) {
      roots.push(entity);
      return;
    }
    if (isNonEmptyString(entity.parentId) && !idToEntity.has(entity.parentId)) {
      fail(`${path}.parentId`, `parentId “${entity.parentId}” does not match any entity id.`);
    }
  });
  if (roots.length === 0 && entities.length > 0) {
    fail('$.entities', 'No root entity found: exactly one entity must have parentId null.');
  }
  if (roots.length > 1) {
    fail('$.entities', `Found ${roots.length} root entities; exactly one root (the galaxy) is allowed.`);
  }
  if (roots.length === 1 && roots[0].type !== 'galaxy') {
    fail('$.entities', `The root entity must be of type "galaxy" (found “${String(roots[0].type)}”).`);
  }

  /* cycle detection -------------------------------------------------- */
  for (const entity of entities) {
    if (!isPlainObject(entity) || !isNonEmptyString(entity.id)) continue;
    const seen = new Set<string>([entity.id]);
    let cursor = entity;
    while (isNonEmptyString(cursor.parentId)) {
      if (seen.has(cursor.parentId)) {
        fail(`$.entities`, `Entity “${entity.id}” is part of a parent cycle.`);
        break;
      }
      seen.add(cursor.parentId);
      const parent = idToEntity.get(cursor.parentId);
      if (!parent) break;
      cursor = parent;
    }
  }

  /* settings --------------------------------------------------------- */
  if (doc.settings === undefined) {
    warn('$.settings', 'Missing settings; defaults were supplied.');
    doc.settings = defaultSettings();
  } else if (!isPlainObject(doc.settings)) {
    fail('$.settings', 'settings must be an object.');
    doc.settings = defaultSettings();
  } else {
    const defaults = defaultSettings();
    const settings = doc.settings as Record<string, any>;
    if (!isPlainObject(settings.units)) {
      warn('$.settings.units', 'Missing settings.units; defaults supplied.');
      settings.units = defaults.units;
    }
    if (!isPlainObject(settings.render)) {
      warn('$.settings.render', 'Missing settings.render; defaults supplied.');
      settings.render = defaults.render;
    } else {
      for (const [key, fallback] of Object.entries(defaults.render)) {
        if (settings.render[key] === undefined) settings.render[key] = fallback;
      }
      const labelModes = ['none', 'selected', 'major', 'all'];
      if (!labelModes.includes(settings.render.labelMode as string)) {
        warn('$.settings.render.labelMode', `Unknown labelMode “${String(settings.render.labelMode)}”; using "major".`);
        settings.render.labelMode = 'major';
      }
      if (!isFiniteNumber(settings.render.trailSamples) || settings.render.trailSamples < 0) {
        warn('$.settings.render.trailSamples', 'Invalid trailSamples; using default.');
        settings.render.trailSamples = defaults.render.trailSamples;
      }
      if (!isFiniteNumber(settings.render.starfieldDensity) || settings.render.starfieldDensity < 0) {
        warn('$.settings.render.starfieldDensity', 'Invalid starfieldDensity; using default.');
        settings.render.starfieldDensity = defaults.render.starfieldDensity;
      }
    }
    if (!isPlainObject(settings.simulation)) {
      warn('$.settings.simulation', 'Missing settings.simulation; defaults supplied.');
      settings.simulation = defaults.simulation;
    } else if (!isFiniteNumber(settings.simulation.speed) || settings.simulation.speed <= 0) {
      warn('$.settings.simulation.speed', 'Invalid simulation.speed; using 1.');
      settings.simulation.speed = 1;
    }
    if (!CANON_STATUSES.includes(settings.defaultCanonStatus as CanonStatus)) {
      warn('$.settings.defaultCanonStatus', `Unknown defaultCanonStatus; using "schematic".`);
      settings.defaultCanonStatus = 'schematic';
    }
  }

  doc.schemaVersion = SCHEMA_VERSION;

  if (errors.length > 0) {
    return { ok: false, errors, warnings, migrationsApplied };
  }
  return {
    ok: true,
    errors,
    warnings,
    migrationsApplied,
    project: doc as unknown as StarMapProject,
  };
}

/** Parse + validate raw JSON text (the import path). */
export function parseProject(text: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      errors: [{ path: '$', message: `JSON parse failed: ${(error as Error).message}` }],
      warnings: [],
      migrationsApplied: [],
    };
  }
  return validateProject(parsed);
}

/** Serialize with a stable, human-reviewable shape. */
export function serializeProject(project: StarMapProject, indent = 2): string {
  const payload: StarMapProject = {
    ...project,
    schemaVersion: SCHEMA_VERSION,
  };
  return JSON.stringify(payload, null, indent);
}

/** Type guard used by the viewer element and by tests. */
export function isStarMapProject(value: unknown): value is StarMapProject {
  return isPlainObject(value) && Array.isArray((value as any).entities);
}

export function formatIssues(issues: readonly ValidationIssue[], limit = 12): string {
  const lines = issues.slice(0, limit).map((issue) => `  • ${issue.path}: ${issue.message}`);
  if (issues.length > limit) lines.push(`  … and ${issues.length - limit} more.`);
  return lines.join('\n');
}

/** Convenience: entity list typed for callers that already validated. */
export function entitiesOf(project: StarMapProject): Entity[] {
  return project.entities;
}

export type { EraPreset };
