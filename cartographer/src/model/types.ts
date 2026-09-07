/** STARSiLK Temporal Cartographer — serializable project schema (v1).
 *  Three.js objects must never enter this model. */

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

export type TimeMode = "inherit" | "override";

/** Numeric Blood Eclipse years, or named sentinels that must never be merged. */
export type HistoricalTimeValue =
  | number
  | "pre-war"
  | "post-siege-wall"
  | "main-narrative";

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
  | "custom"
  | "siegeWallFormed";

export type ViewScale = "galaxy" | "sector" | "system";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
  unit?: string;
}

export interface KeplerOrbit {
  /** Authored physical semi-major axis (AU unless unit says otherwise). */
  semiMajorAxis: number;
  eccentricity: number;
  /** Radians. */
  inclination: number;
  /** Longitude of ascending node, radians. */
  ascendingNode: number;
  /** Argument of periapsis, radians. */
  argumentOfPeriapsis: number;
  /** Mean anomaly at epoch, radians. */
  meanAnomalyAtEpoch: number;
  /** Simulation-seconds epoch. */
  epoch: number;
  /** Sidereal period in simulation-seconds. */
  period: number;
  unit?: string;
}

export interface EntityVisual {
  displayRadius: number;
  color: string;
  emissive?: number;
  roughness?: number;
  atmosphere?: boolean;
  atmosphereColor?: string;
  /** Blood Ring / orbital band appearance — not Saturn dust. */
  ringThickness?: number;
  ringInner?: number;
  ringOuter?: number;
  label?: boolean;
  icon?: string;
  /** Visual-only compression hint; never mutates authored physical values. */
  renderScale?: number;
}

export interface EntityTime {
  mode: TimeMode;
  overrideValue?: HistoricalTimeValue;
}

export interface EntityMeta {
  description?: string;
  tags?: string[];
  notes?: string;
  canonStatus: CanonStatus;
  sourceNote?: string;
  sourceHref?: string;
  dossierHref?: string;
  warning?: string;
  /** Demo / invented coordinates must stay schematic. */
  positionCanon?: "schematic" | "locked";
}

export interface TimelineEvent {
  id: string;
  time: HistoricalTimeValue;
  label: string;
  eventType: TimelineEventType;
  statePatch?: Record<string, unknown>;
  canonStatus: CanonStatus;
  sourceNote?: string;
  sourceHref?: string;
}

export interface Entity {
  id: string;
  parentId: string | null;
  type: EntityType;
  name: string;
  position?: Vec3;
  orbit?: KeplerOrbit;
  visual?: EntityVisual;
  time?: EntityTime;
  timeline: TimelineEvent[];
  meta: EntityMeta;
  /** Sort order among siblings. */
  order?: number;
  /** Rotation period in simulation-seconds (body spin). */
  rotationPeriod?: number;
  axialTilt?: number;
}

export interface EraPreset {
  id: string;
  label: string;
  value: HistoricalTimeValue;
  editable?: boolean;
}

export interface ProjectSettings {
  galaxyHistoricalTime: HistoricalTimeValue;
  orbitalPaused: boolean;
  orbitalSpeed: number;
  labels: boolean;
  orbitPaths: boolean;
  trails: boolean;
  annotations: boolean;
  /** Non-diegetic Siege Wall topology. MUST default off. */
  analystOverlay: boolean;
  canonOnly: boolean;
  referenceGrid: boolean;
  backgroundStarCount: number;
  backgroundStarSeed: number;
}

export interface StarMapProject {
  schemaVersion: number;
  id: string;
  title: string;
  eraPresets: EraPreset[];
  entities: Entity[];
  settings: ProjectSettings;
}

export interface MountOptions {
  mode?: "editor" | "viewer";
  src?: string | StarMapProject;
  startEntityId?: string;
  startEra?: HistoricalTimeValue;
  disableAuthoring?: boolean;
}

export interface ResolvedTime {
  value: HistoricalTimeValue;
  mode: TimeMode;
  inheritedFromId: string | null;
  scope: "galaxy" | "starfield" | "system" | "object";
}

export interface HistoricalView {
  present: boolean;
  destroyed: boolean;
  collapsed: boolean;
  type: EntityType;
  name: string;
  visual?: EntityVisual;
  orbit?: KeplerOrbit;
  annotations: string[];
}

export const CANON_LABEL: Record<CanonStatus, string> = {
  locked: "LOCKED CANON",
  working: "WORKING CANON",
  provisional: "PROVISIONAL",
  schematic: "SCHEMATIC / NON-CANON",
};

export const ENTITY_TYPE_LABEL: Record<EntityType, string> = {
  galaxy: "GALAXY",
  starfield: "STARFIELD / SECTOR",
  system: "SOLAR SYSTEM",
  star: "STAR",
  blackHole: "BLACK HOLE",
  planet: "PLANET",
  moon: "MOON",
  bloodRing: "BLOOD RING",
  orbitalStructure: "ORBITAL STRUCTURE",
  largeScaleStructure: "LARGE-SCALE STRUCTURE",
  other: "OTHER",
};

export const DEFAULT_SETTINGS: ProjectSettings = {
  galaxyHistoricalTime: "main-narrative",
  orbitalPaused: false,
  orbitalSpeed: 1,
  labels: true,
  orbitPaths: true,
  trails: false,
  annotations: true,
  analystOverlay: false,
  canonOnly: false,
  referenceGrid: false,
  backgroundStarCount: 10000,
  backgroundStarSeed: 20260907,
};
