export const SCHEMA_VERSION = 1 as const;

export type CanonStatus = "locked" | "working" | "provisional" | "schematic";
export type EntityType =
  | "galaxy"
  | "starfield"
  | "system"
  | "star"
  | "blackHole"
  | "planet"
  | "moon"
  | "bloodRing"
  | "orbitalStructure"
  | "largeScaleStructure"
  | "other";
export type HistoricalTime = number | string;
export type TimelineEventType =
  | "created"
  | "destroyed"
  | "renamed"
  | "visualChanged"
  | "orbitChanged"
  | "bloodRingCreated"
  | "bloodRingDestroyed"
  | "starsilkExtractionCollapse"
  | "annotation"
  | "custom";

export interface EraPreset {
  id: string;
  label: string;
  value: HistoricalTime;
}

export interface Position3 {
  x: number;
  y: number;
  z: number;
  unit?: string;
}

export interface OrbitDefinition {
  semiMajorAxis: number;
  eccentricity: number;
  inclination: number;
  ascendingNode: number;
  argumentOfPeriapsis: number;
  meanAnomalyAtEpoch: number;
  epoch: number;
  period: number;
}

export interface EntityVisual {
  displayRadius?: number;
  color?: string;
  emissive?: number;
  roughness?: number;
  atmosphere?: boolean;
  ringAppearance?: string;
  icon?: string;
  label?: boolean;
  [key: string]: unknown;
}

export interface EntityTime {
  mode: "inherit" | "override";
  overrideValue?: HistoricalTime;
}

export interface TimelineEvent {
  id: string;
  time: HistoricalTime;
  label: string;
  eventType: TimelineEventType;
  statePatch?: Record<string, unknown>;
  canonStatus: CanonStatus;
  sourceNote?: string;
}

export interface EntityMeta {
  description?: string;
  tags?: string[];
  notes?: string;
  canonStatus: CanonStatus;
  sourceNote?: string;
  sourceHref?: string;
  dossierHref?: string;
  positionStatus?: "authored" | "schematic" | "unknown";
}

export interface Entity {
  id: string;
  parentId: string | null;
  type: EntityType;
  name: string;
  position?: Position3;
  orbit?: OrbitDefinition;
  visual?: EntityVisual;
  time: EntityTime;
  timeline: TimelineEvent[];
  meta: EntityMeta;
}

export interface ProjectSettings {
  simulation: {
    running: boolean;
    speed: number;
  };
  view: {
    labels: boolean;
    orbitPaths: boolean;
    trails: boolean;
    referenceGrid: boolean;
    analystOverlay: boolean;
    canonOnly: boolean;
    annotations: boolean;
  };
}

export interface StarMapProject {
  schemaVersion: number;
  id: string;
  title: string;
  eraPresets: EraPreset[];
  entities: Entity[];
  settings: ProjectSettings;
}

export const DEFAULT_ERA_PRESETS: EraPreset[] = [
  { id: "pre-war", label: "PRE-WAR", value: "PRE-WAR" },
  { id: "war-0", label: "BLOOD ECLIPSE — YEAR 0", value: 0 },
  { id: "war-3", label: "BLOOD ECLIPSE — YEAR 3", value: 3 },
  { id: "war-121", label: "BLOOD ECLIPSE — YEAR 121", value: 121 },
  { id: "war-170", label: "BLOOD ECLIPSE — YEAR 170", value: 170 },
  { id: "post-wall", label: "POST-SIEGE-WALL", value: "POST-SIEGE-WALL" },
  {
    id: "main-narrative",
    label: "MAIN NARRATIVE — DATE UNSPECIFIED",
    value: "MAIN NARRATIVE — DATE UNSPECIFIED"
  },
  { id: "custom", label: "CUSTOM", value: "CUSTOM" }
];

export function newId(prefix = "entity"): string {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
}

export function deepClone<T>(value: T): T {
  return structuredClone(value);
}

export function createProject(title = "Untitled STARSiLK Map"): StarMapProject {
  const galaxyId = newId("galaxy");
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId("project"),
    title,
    eraPresets: deepClone(DEFAULT_ERA_PRESETS),
    entities: [
      {
        id: galaxyId,
        parentId: null,
        type: "galaxy",
        name: "GALAXY",
        time: { mode: "override", overrideValue: 121 },
        timeline: [],
        meta: {
          canonStatus: "schematic",
          description: "Authoring root. Spatial placement is not canon unless explicitly sourced."
        }
      }
    ],
    settings: {
      simulation: { running: true, speed: 1 },
      view: {
        labels: true,
        orbitPaths: true,
        trails: false,
        referenceGrid: false,
        analystOverlay: false,
        canonOnly: false,
        annotations: true
      }
    }
  };
}

export function getEntity(project: StarMapProject, id: string | null | undefined): Entity | undefined {
  return id ? project.entities.find((entity) => entity.id === id) : undefined;
}

export function childrenOf(project: StarMapProject, parentId: string | null): Entity[] {
  return project.entities.filter((entity) => entity.parentId === parentId);
}

export function descendantsOf(project: StarMapProject, id: string): Entity[] {
  const result: Entity[] = [];
  const queue = childrenOf(project, id);
  while (queue.length) {
    const next = queue.shift();
    if (!next) break;
    result.push(next);
    queue.push(...childrenOf(project, next.id));
  }
  return result;
}

export function ancestorsOf(project: StarMapProject, id: string): Entity[] {
  const result: Entity[] = [];
  const seen = new Set<string>();
  let current = getEntity(project, id);
  while (current?.parentId) {
    if (seen.has(current.parentId)) break;
    seen.add(current.parentId);
    const parent = getEntity(project, current.parentId);
    if (!parent) break;
    result.push(parent);
    current = parent;
  }
  return result;
}

export function createEntity(type: EntityType, parentId: string | null, name?: string): Entity {
  return {
    id: newId(type),
    parentId,
    type,
    name: name ?? type.replace(/([A-Z])/g, " $1").toUpperCase(),
    time: { mode: type === "galaxy" ? "override" : "inherit", ...(type === "galaxy" ? { overrideValue: 121 } : {}) },
    timeline: [],
    meta: { canonStatus: "schematic", positionStatus: "unknown" },
    visual: { displayRadius: type === "star" ? 2.8 : type === "planet" ? 1.2 : 0.8 }
  };
}

export function validateProject(input: unknown): { ok: boolean; errors: string[]; project?: StarMapProject } {
  const errors: string[] = [];
  if (!input || typeof input !== "object") return { ok: false, errors: ["Project must be an object."] };
  const candidate = input as Partial<StarMapProject>;
  if (candidate.schemaVersion !== SCHEMA_VERSION) errors.push(`schemaVersion must equal ${SCHEMA_VERSION}.`);
  if (typeof candidate.id !== "string" || !candidate.id) errors.push("Project id is required.");
  if (typeof candidate.title !== "string" || !candidate.title.trim()) errors.push("Project title is required.");
  if (!Array.isArray(candidate.entities)) errors.push("entities must be an array.");
  if (!Array.isArray(candidate.eraPresets)) errors.push("eraPresets must be an array.");
  if (!candidate.settings || typeof candidate.settings !== "object") errors.push("settings are required.");
  if (errors.length || !candidate.entities) return { ok: false, errors };

  const ids = new Set<string>();
  const byId = new Map<string, Entity>();
  for (const raw of candidate.entities) {
    if (!raw || typeof raw !== "object") {
      errors.push("Every entity must be an object.");
      continue;
    }
    const entity = raw as Entity;
    if (typeof entity.id !== "string" || !entity.id) errors.push("Every entity requires a stable id.");
    else if (ids.has(entity.id)) errors.push(`Duplicate entity id: ${entity.id}`);
    else {
      ids.add(entity.id);
      byId.set(entity.id, entity);
    }
    if (typeof entity.name !== "string" || !entity.name.trim()) errors.push(`Entity ${entity.id ?? "<unknown>"} requires a name.`);
    if (!Array.isArray(entity.timeline)) errors.push(`Entity ${entity.id ?? "<unknown>"} timeline must be an array.`);
    if (!entity.time || (entity.time.mode !== "inherit" && entity.time.mode !== "override")) {
      errors.push(`Entity ${entity.id ?? "<unknown>"} requires a valid time mode.`);
    }
    if (!entity.meta || !["locked", "working", "provisional", "schematic"].includes(entity.meta.canonStatus)) {
      errors.push(`Entity ${entity.id ?? "<unknown>"} requires a valid canonStatus.`);
    }
  }

  const galaxies = candidate.entities.filter((entity) => entity.type === "galaxy" && entity.parentId === null);
  if (galaxies.length !== 1) errors.push("Project must contain exactly one root galaxy.");

  for (const entity of candidate.entities) {
    if (entity.parentId !== null && !byId.has(entity.parentId)) errors.push(`Missing parent ${entity.parentId} for ${entity.id}.`);
    const lineage = new Set([entity.id]);
    let cursor = entity;
    while (cursor.parentId !== null) {
      if (lineage.has(cursor.parentId)) {
        errors.push(`Parent cycle detected at ${entity.id}.`);
        break;
      }
      lineage.add(cursor.parentId);
      const parent = byId.get(cursor.parentId);
      if (!parent) break;
      cursor = parent;
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, errors: [], project: input as StarMapProject };
}

export class ProjectStore extends EventTarget {
  private undoStack: StarMapProject[] = [];
  private redoStack: StarMapProject[] = [];
  project: StarMapProject;
  selectedId: string;

  constructor(project: StarMapProject) {
    super();
    const validation = validateProject(project);
    if (!validation.ok) throw new Error(validation.errors.join("\n"));
    this.project = deepClone(project);
    this.selectedId = this.project.entities.find((entity) => entity.type === "galaxy")?.id ?? this.project.entities[0]!.id;
  }

  mutate(label: string, mutator: (project: StarMapProject) => void): void {
    const before = deepClone(this.project);
    const next = deepClone(this.project);
    mutator(next);
    const validation = validateProject(next);
    if (!validation.ok) throw new Error(`${label}: ${validation.errors.join(" ")}`);
    this.undoStack.push(before);
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
    this.project = next;
    this.dispatchEvent(new CustomEvent("change", { detail: { label } }));
  }

  replace(project: StarMapProject, label = "replace project"): void {
    const validation = validateProject(project);
    if (!validation.ok) throw new Error(validation.errors.join("\n"));
    this.undoStack.push(deepClone(this.project));
    this.redoStack = [];
    this.project = deepClone(project);
    if (!getEntity(this.project, this.selectedId)) this.selectedId = this.project.entities[0]!.id;
    this.dispatchEvent(new CustomEvent("change", { detail: { label } }));
  }

  select(id: string): void {
    if (!getEntity(this.project, id)) return;
    this.selectedId = id;
    this.dispatchEvent(new CustomEvent("selection", { detail: { id } }));
  }

  add(entity: Entity): void {
    this.mutate(`add ${entity.type}`, (project) => project.entities.push(deepClone(entity)));
    this.select(entity.id);
  }

  delete(id: string): void {
    const doomed = new Set([id, ...descendantsOf(this.project, id).map((entity) => entity.id)]);
    const entity = getEntity(this.project, id);
    if (!entity || entity.type === "galaxy") throw new Error("The root galaxy cannot be deleted.");
    this.mutate(`delete ${entity.name}`, (project) => {
      project.entities = project.entities.filter((candidate) => !doomed.has(candidate.id));
    });
    this.select(entity.parentId ?? this.project.entities[0]!.id);
  }

  duplicate(id: string): string {
    const source = getEntity(this.project, id);
    if (!source || source.type === "galaxy") throw new Error("The root galaxy cannot be duplicated.");
    const subtree = [source, ...descendantsOf(this.project, id)];
    const remap = new Map<string, string>();
    for (const entity of subtree) remap.set(entity.id, newId(entity.type));
    const clones = subtree.map((entity, index) => ({
      ...deepClone(entity),
      id: remap.get(entity.id)!,
      parentId: entity.id === source.id ? source.parentId : remap.get(entity.parentId ?? "") ?? entity.parentId,
      name: index === 0 ? `${entity.name} COPY` : entity.name,
      timeline: entity.timeline.map((event) => ({ ...event, id: newId("event") }))
    }));
    this.mutate(`duplicate ${source.name}`, (project) => project.entities.push(...clones));
    const cloneId = remap.get(source.id)!;
    this.select(cloneId);
    return cloneId;
  }

  undo(): boolean {
    const previous = this.undoStack.pop();
    if (!previous) return false;
    this.redoStack.push(deepClone(this.project));
    this.project = previous;
    if (!getEntity(this.project, this.selectedId)) this.selectedId = this.project.entities[0]!.id;
    this.dispatchEvent(new CustomEvent("change", { detail: { label: "undo" } }));
    return true;
  }

  redo(): boolean {
    const next = this.redoStack.pop();
    if (!next) return false;
    this.undoStack.push(deepClone(this.project));
    this.project = next;
    if (!getEntity(this.project, this.selectedId)) this.selectedId = this.project.entities[0]!.id;
    this.dispatchEvent(new CustomEvent("change", { detail: { label: "redo" } }));
    return true;
  }
}
