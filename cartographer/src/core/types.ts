/**
 * STARSiLK TEMPORAL CARTOGRAPHER — authoritative project schema.
 *
 * The authored JSON produced from these types is the source of truth.
 * Three.js objects are runtime derivatives and are never persisted.
 *
 * Design rules enforced by this module's shape:
 *  - every entity carries a stable id and a parent reference (general composition);
 *  - historical time is a per-entity `time` block (inherit | override);
 *  - history is expressed as ordered timeline events with discrete state patches,
 *    never as duplicated galaxies per era;
 *  - provenance (`canonStatus` / `sourceNote` / `sourceHref`) travels with data.
 */

/** Bumped only with a real migration in `schema.ts`. */
export const SCHEMA_VERSION = 1;

export type CanonStatus = 'locked' | 'working' | 'provisional' | 'schematic';

export const CANON_STATUSES: readonly CanonStatus[] = [
  'locked',
  'working',
  'provisional',
  'schematic',
] as const;

export const CANON_STATUS_LABELS: Record<CanonStatus, string> = {
  locked: 'LOCKED CANON',
  working: 'WORKING CANON',
  provisional: 'PROVISIONAL',
  schematic: 'SCHEMATIC / NON-CANON',
};

export type EntityType =
  | 'galaxy'
  | 'starfield'
  | 'system'
  | 'star'
  | 'blackHole'
  | 'planet'
  | 'moon'
  | 'bloodRing'
  | 'orbitalStructure'
  | 'largeScaleStructure'
  | 'other';

export const ENTITY_TYPES: readonly EntityType[] = [
  'galaxy',
  'starfield',
  'system',
  'star',
  'blackHole',
  'planet',
  'moon',
  'bloodRing',
  'orbitalStructure',
  'largeScaleStructure',
  'other',
] as const;

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  galaxy: 'GALAXY',
  starfield: 'SECTOR / STARFIELD',
  system: 'SOLAR SYSTEM',
  star: 'STAR',
  blackHole: 'BLACK HOLE',
  planet: 'PLANET',
  moon: 'MOON',
  bloodRing: 'BLOOD RING',
  orbitalStructure: 'ORBITAL STRUCTURE',
  largeScaleStructure: 'LARGE-SCALE STRUCTURE',
  other: 'OBJECT',
};

/**
 * Historical time value.
 *  - `number` → Blood Eclipse War year (0 … 170; the war spans 170 years).
 *  - `string` → an era preset id (for example `main-narrative`), used for
 *    anchors that deliberately carry no exact numeric date.
 */
export type TimeValue = number | string;

export type HistoricalEventType =
  | 'created'
  | 'destroyed'
  | 'renamed'
  | 'visualChanged'
  | 'orbitChanged'
  | 'bloodRingCreated'
  | 'bloodRingDestroyed'
  | 'starsilkExtractionCollapse'
  | 'annotation'
  | 'custom';

export const EVENT_TYPES: readonly HistoricalEventType[] = [
  'created',
  'destroyed',
  'renamed',
  'visualChanged',
  'orbitChanged',
  'bloodRingCreated',
  'bloodRingDestroyed',
  'starsilkExtractionCollapse',
  'annotation',
  'custom',
] as const;

export const EVENT_TYPE_LABELS: Record<HistoricalEventType, string> = {
  created: 'CREATED',
  destroyed: 'DESTROYED',
  renamed: 'RENAMED',
  visualChanged: 'VISUAL CHANGE',
  orbitChanged: 'ORBIT CHANGE',
  bloodRingCreated: 'BLOOD RING FORMED',
  bloodRingDestroyed: 'BLOOD RING DESTROYED',
  starsilkExtractionCollapse: 'STARSiLK EXTRACTION COLLAPSE',
  annotation: 'ANNOTATION',
  custom: 'CUSTOM',
};

/** Events that make their entity come into historical existence. */
export const CREATION_EVENT_TYPES: readonly HistoricalEventType[] = [
  'created',
  'bloodRingCreated',
] as const;

/** Events that end an entity's historical existence. */
export const DESTRUCTION_EVENT_TYPES: readonly HistoricalEventType[] = [
  'destroyed',
  'bloodRingDestroyed',
] as const;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
  /** Authored unit label, e.g. "pc" (parsec) or "km". Never mutated by the renderer. */
  unit?: string;
}

/** Classical Keplerian elements. Authored physical values. */
export interface OrbitalElements {
  /** Authored semi-major axis (see `ProjectSettings.units.length`). */
  semiMajorAxis: number;
  /** 0 ≤ e < 1. */
  eccentricity: number;
  /** Degrees. */
  inclination: number;
  /** Longitude of ascending node, degrees. */
  ascendingNode: number;
  /** Argument of periapsis, degrees. */
  argumentOfPeriapsis: number;
  /** Mean anomaly at epoch, degrees. */
  meanAnomalyAtEpoch: number;
  /** Epoch of the elements, in the project's time unit. */
  epoch: number;
  /** Orbital period in the project's time unit. Must be > 0. */
  period: number;
}

export interface AtmosphereVisual {
  enabled: boolean;
  color: string;
  intensity: number;
}

export interface RingVisual {
  /** Multiplier of the body's display radius. */
  innerRadius: number;
  outerRadius: number;
  /** Band thickness, in display units. */
  thickness: number;
  /** Ring plane tilt, degrees, relative to the body equator. */
  inclination: number;
  color: string;
  /** Procedural spin striation density (render-only). */
  striations: number;
}

/** Render-facing appearance. Distinct from authored physical values. */
export interface VisualProperties {
  /** Compressed display radius in scene units (log-friendly). */
  displayRadius?: number;
  color?: string;
  emissive?: string;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  opacity?: number;
  /** Facet count for the stylized, lightly low-poly look. */
  facets?: number;
  /** 0 … 1 banding / mottling amount. */
  banding?: number;
  atmosphere?: AtmosphereVisual;
  ring?: RingVisual;
  /** Category glyph used by labels + the hierarchy tree. */
  icon?: string;
  labelVisible?: boolean;
  /** Extra render hints kept opaque to the schema (never stripped on import). */
  [key: string]: unknown;
}

export interface EntityTime {
  /**
   * `inherit` → resolved from the parent chain (the default).
   * `override` → this branch uses `overrideValue` and its children inherit that.
   */
  mode: 'inherit' | 'override';
  overrideValue?: TimeValue;
}

export interface TimelineEvent {
  id: string;
  time: TimeValue;
  label: string;
  eventType: HistoricalEventType;
  /**
   * Discrete property patch applied when the event is in the resolved past.
   * Applied in chronological order; no interpolation is implied.
   */
  statePatch?: Record<string, unknown>;
  canonStatus: CanonStatus;
  sourceNote?: string;
  sourceHref?: string;
}

export interface EntityMeta {
  description?: string;
  tags?: string[];
  canonStatus: CanonStatus;
  sourceNote?: string;
  sourceHref?: string;
  /** Relative or absolute link into the Starsilk Character Dossier. */
  dossierHref?: string;
  /** Extra authored metadata; preserved verbatim on import/export. */
  [key: string]: unknown;
}

export interface Entity {
  id: string;
  parentId: string | null;
  type: EntityType;
  name: string;
  /** Authored position in space (galaxy/sector scale, or barycentric offset). */
  position?: Vec3;
  orbit?: OrbitalElements;
  visual?: VisualProperties;
  time?: EntityTime;
  timeline: TimelineEvent[];
  meta: EntityMeta;
  /** Unknown authored keys survive validation instead of being discarded. */
  [key: string]: unknown;
}

export interface EraPreset {
  id: string;
  label: string;
  /** Total order on the historical axis; ordinal anchors, not a scale. */
  order: number;
  /**
   * Optional Blood Eclipse War year equivalent. Deliberately omitted for anchors
   * that have no supplied date (e.g. the main narrative).
   */
  time?: number;
  description?: string;
  canonStatus: CanonStatus;
  /** Marks the "type your own value" preset. */
  custom?: boolean;
}

export type LabelMode = 'none' | 'selected' | 'major' | 'all';

export interface RenderSettings {
  labelMode: LabelMode;
  showOrbitPaths: boolean;
  showTrails: boolean;
  showReferenceGrid: boolean;
  /** Non-diegetic analyst overlay. Always off by default. */
  showAnalystOverlay: boolean;
  /** Hide anything that is not locked/working canon. */
  canonOnly: boolean;
  /** Trail sample budget — keeps trails restrained, never spaghetti. */
  trailSamples: number;
  /** Synthetic galaxy starfield count. Render-only, never authored canon data. */
  starfieldDensity: number;
  /** Respect `prefers-reduced-motion` at startup. */
  respectReducedMotion: boolean;
}

export interface ProjectSettings {
  units: { length: string; time: string };
  defaultCanonStatus: CanonStatus;
  render: RenderSettings;
  simulation: {
    /** Orbital simulation speed multiplier (independent of historical time). */
    speed: number;
  };
  [key: string]: unknown;
}

export interface StarMapProject {
  schemaVersion: number;
  id: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
  eraPresets: EraPreset[];
  entities: Entity[];
  settings: ProjectSettings;
  [key: string]: unknown;
}

/** Default project settings used by `createProject` and import fallbacks. */
export function defaultSettings(): ProjectSettings {
  return {
    units: { length: 'pc', time: 'd' },
    defaultCanonStatus: 'schematic',
    render: {
      labelMode: 'major',
      showOrbitPaths: true,
      showTrails: true,
      showReferenceGrid: true,
      showAnalystOverlay: false,
      canonOnly: false,
      trailSamples: 220,
      starfieldDensity: 10000,
      respectReducedMotion: true,
    },
    simulation: { speed: 1 },
  };
}
