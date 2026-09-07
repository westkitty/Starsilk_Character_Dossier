import { SCHEMA_VERSION, type StarMapProject, type Entity, type TimelineEvent } from "./types.ts";

export interface ValidationIssue {
  path: string;
  message: string;
}

export class SchemaError extends Error {
  issues: ValidationIssue[];
  constructor(issues: ValidationIssue[]) {
    super(issues.map((i) => `${i.path}: ${i.message}`).join("\n"));
    this.name = "SchemaError";
    this.issues = issues;
  }
}

const ENTITY_TYPES = new Set([
  "galaxy",
  "starfield",
  "system",
  "star",
  "blackHole",
  "planet",
  "moon",
  "bloodRing",
  "orbitalStructure",
  "largeScaleStructure",
  "other",
]);

const CANON = new Set(["locked", "working", "provisional", "schematic"]);
const TIME_MODES = new Set(["inherit", "override"]);
const EVENT_TYPES = new Set([
  "created",
  "destroyed",
  "renamed",
  "visualChanged",
  "orbitChanged",
  "bloodRingCreated",
  "bloodRingDestroyed",
  "starsilkExtractionCollapse",
  "annotation",
  "custom",
  "siegeWallFormed",
]);

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isTimeValue(v: unknown): boolean {
  if (typeof v === "number" && Number.isFinite(v)) return true;
  return v === "pre-war" || v === "post-siege-wall" || v === "main-narrative";
}

function issue(path: string, message: string): ValidationIssue {
  return { path, message };
}

export function validateProject(raw: unknown): StarMapProject {
  const issues: ValidationIssue[] = [];
  if (!isObj(raw)) {
    throw new SchemaError([issue("$", "Project must be a JSON object.")]);
  }

  if (raw.schemaVersion !== SCHEMA_VERSION) {
    issues.push(
      issue(
        "schemaVersion",
        `Unsupported schemaVersion ${String(raw.schemaVersion)}; expected ${SCHEMA_VERSION}.`,
      ),
    );
  }
  if (typeof raw.id !== "string" || !raw.id.trim()) {
    issues.push(issue("id", "Project id is required."));
  }
  if (typeof raw.title !== "string") {
    issues.push(issue("title", "Project title is required."));
  }
  if (!Array.isArray(raw.eraPresets)) {
    issues.push(issue("eraPresets", "eraPresets must be an array."));
  }
  if (!Array.isArray(raw.entities)) {
    issues.push(issue("entities", "entities must be an array."));
  }
  if (!isObj(raw.settings)) {
    issues.push(issue("settings", "settings object is required."));
  }

  const entities = Array.isArray(raw.entities) ? raw.entities : [];
  const ids = new Set<string>();
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    const p = `entities[${i}]`;
    if (!isObj(e)) {
      issues.push(issue(p, "Entity must be an object."));
      continue;
    }
    if (typeof e.id !== "string" || !e.id) {
      issues.push(issue(`${p}.id`, "Entity id is required."));
    } else if (ids.has(e.id)) {
      issues.push(issue(`${p}.id`, `Duplicate entity id "${e.id}".`));
    } else {
      ids.add(e.id);
    }
    if (e.parentId !== null && typeof e.parentId !== "string") {
      issues.push(issue(`${p}.parentId`, "parentId must be a string or null."));
    }
    if (typeof e.type !== "string" || !ENTITY_TYPES.has(e.type)) {
      issues.push(issue(`${p}.type`, `Unknown entity type "${String(e.type)}".`));
    }
    if (typeof e.name !== "string") {
      issues.push(issue(`${p}.name`, "Entity name is required."));
    }
    if (!Array.isArray(e.timeline)) {
      issues.push(issue(`${p}.timeline`, "timeline must be an array."));
    } else {
      e.timeline.forEach((ev, j) => validateEvent(ev, `${p}.timeline[${j}]`, issues));
    }
    if (!isObj(e.meta) || typeof e.meta.canonStatus !== "string" || !CANON.has(e.meta.canonStatus)) {
      issues.push(issue(`${p}.meta.canonStatus`, "canonStatus is required (locked|working|provisional|schematic)."));
    }
    if (e.time !== undefined) {
      if (!isObj(e.time) || typeof e.time.mode !== "string" || !TIME_MODES.has(e.time.mode)) {
        issues.push(issue(`${p}.time.mode`, 'time.mode must be "inherit" or "override".'));
      } else if (e.time.mode === "override" && !isTimeValue(e.time.overrideValue)) {
        issues.push(issue(`${p}.time.overrideValue`, "overrideValue is required when mode is override."));
      }
    }
    if (e.orbit !== undefined) {
      if (!isObj(e.orbit) || typeof e.orbit.semiMajorAxis !== "number" || typeof e.orbit.period !== "number") {
        issues.push(issue(`${p}.orbit`, "orbit requires numeric semiMajorAxis and period."));
      }
    }
  }

  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    if (!isObj(e)) continue;
    if (typeof e.parentId === "string" && e.parentId && !ids.has(e.parentId)) {
      issues.push(issue(`entities[${i}].parentId`, `parentId "${e.parentId}" does not exist.`));
    }
  }

  if (isObj(raw.settings)) {
    if (!isTimeValue(raw.settings.galaxyHistoricalTime)) {
      issues.push(issue("settings.galaxyHistoricalTime", "galaxyHistoricalTime is required."));
    }
  }

  if (issues.length) throw new SchemaError(issues);
  return raw as unknown as StarMapProject;
}

function validateEvent(ev: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isObj(ev)) {
    issues.push(issue(path, "Event must be an object."));
    return;
  }
  if (typeof ev.id !== "string" || !ev.id) issues.push(issue(`${path}.id`, "Event id is required."));
  if (!isTimeValue(ev.time)) issues.push(issue(`${path}.time`, "Event time is required."));
  if (typeof ev.label !== "string") issues.push(issue(`${path}.label`, "Event label is required."));
  if (typeof ev.eventType !== "string" || !EVENT_TYPES.has(ev.eventType)) {
    issues.push(issue(`${path}.eventType`, `Unknown eventType "${String(ev.eventType)}".`));
  }
  if (typeof ev.canonStatus !== "string" || !CANON.has(ev.canonStatus)) {
    issues.push(issue(`${path}.canonStatus`, "Event canonStatus is required."));
  }
}

export function cloneProject(project: StarMapProject): StarMapProject {
  return structuredClone(project);
}

export function entityMap(project: StarMapProject): Map<string, Entity> {
  const m = new Map<string, Entity>();
  for (const e of project.entities) m.set(e.id, e);
  return m;
}

export function childrenOf(project: StarMapProject, parentId: string | null): Entity[] {
  return project.entities
    .filter((e) => e.parentId === parentId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
}

export function ancestorsOf(project: StarMapProject, id: string): Entity[] {
  const map = entityMap(project);
  const out: Entity[] = [];
  let cur = map.get(id);
  const seen = new Set<string>();
  while (cur?.parentId && !seen.has(cur.parentId)) {
    seen.add(cur.parentId);
    const parent = map.get(cur.parentId);
    if (!parent) break;
    out.push(parent);
    cur = parent;
  }
  return out;
}

export function findEvent(entity: Entity, id: string): TimelineEvent | undefined {
  return entity.timeline.find((e) => e.id === id);
}
