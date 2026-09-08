/**
 * AUTHORING → RENDER DERIVATION.
 *
 * This module is the only place where authored project data is translated into
 * renderer primitives. It contains no Three.js imports, so it is unit-testable
 * without a WebGL context, and it can never mutate authored values.
 *
 * Historical state enters through a small `DerivationContext` interface rather than
 * through direct resolver imports, which keeps this file independent of the era
 * machinery and lets the viewer/editor share it.
 */

import { childrenOf, entityById } from '../core/project';
import type {
  Entity,
  EntityType,
  OrbitalElements,
  StarMapProject,
  VisualProperties,
} from '../core/types';

export interface DerivationContext {
  /** Is the entity historically present at the resolved era? */
  present: (entityId: string) => boolean;
  /** Effective type after historical patches (e.g. star → blackHole). */
  effectiveType: (entity: Entity) => EntityType;
  /** Optional extra label/detail from historical state. */
  annotate?: (entity: Entity) => { suffix?: string; destroyed?: boolean } | undefined;
}

export const ALWAYS_PRESENT: DerivationContext = {
  present: () => true,
  effectiveType: (entity) => entity.type,
};

export type BodyKind =
  | 'star'
  | 'blackHole'
  | 'planet'
  | 'moon'
  | 'bloodRing'
  | 'structure';

export interface DerivedRing {
  innerRadius: number;
  outerRadius: number;
  thickness: number;
  inclination: number;
  color: string;
  striations: number;
}

export interface DerivedBody {
  entityId: string;
  parentId: string | null;
  kind: BodyKind;
  authoredType: EntityType;
  name: string;
  label: string;
  /** Scene units. */
  radius: number;
  /** Authored elements, untouched. */
  orbit?: OrbitalElements;
  /** Compressed orbital radius in scene units (0 when the body has no orbit). */
  orbitRadius: number;
  /** Static offset for bodies placed by authored position rather than an orbit. */
  offset: { x: number; y: number; z: number };
  color: string;
  emissive: string;
  emissiveIntensity: number;
  roughness: number;
  metalness: number;
  facets: number;
  banding: number;
  atmosphere?: { color: string; intensity: number };
  ring?: DerivedRing;
  canonStatus: Entity['meta']['canonStatus'];
  present: boolean;
  destroyed: boolean;
  spinPeriodDays: number;
  isPrimary: boolean;
}

function kindFor(type: EntityType): BodyKind {
  switch (type) {
    case 'star':
      return 'star';
    case 'blackHole':
      return 'blackHole';
    case 'planet':
      return 'planet';
    case 'moon':
      return 'moon';
    case 'bloodRing':
      return 'bloodRing';
    default:
      return 'structure';
  }
}

const DEFAULT_COLOR: Record<BodyKind, string> = {
  star: '#ffe6b8',
  blackHole: '#04050a',
  planet: '#7fa8c9',
  moon: '#9fb0bd',
  bloodRing: '#8d2230',
  structure: '#c9d5df',
};

function colorOf(visual: VisualProperties | undefined, kind: BodyKind): string {
  const value = visual?.color;
  return typeof value === 'string' && value.startsWith('#') ? value : DEFAULT_COLOR[kind];
}

function deriveRing(visual: VisualProperties | undefined, parentRadius: number): DerivedRing | undefined {
  const ring = visual?.ring;
  if (!ring) return undefined;
  return {
    innerRadius: Math.max(ring.innerRadius ?? 1.5, 0.1) * parentRadius,
    outerRadius: Math.max(ring.outerRadius ?? (ring.innerRadius ?? 1.5) + 1, (ring.innerRadius ?? 1.5) + 0.1) * parentRadius,
    thickness: Math.max(ring.thickness ?? 0.3, 0.02) * parentRadius,
    inclination: ring.inclination ?? 0,
    color: typeof ring.color === 'string' ? ring.color : '#6d1a26',
    striations: Math.max(Math.round(ring.striations ?? 24), 4),
  };
}

function bodyFromEntity(
  entity: Entity,
  context: DerivationContext,
  parentRadius: number,
): DerivedBody {
  const authoredType = entity.type;
  const effective = context.effectiveType(entity);
  const kind = kindFor(effective);
  const visual = entity.visual;
  const radius =
    typeof visual?.displayRadius === 'number' && visual.displayRadius > 0
      ? visual.displayRadius
      : kind === 'star'
        ? 6
        : kind === 'moon'
          ? 0.7
          : kind === 'blackHole'
            ? 3.4
            : 2.2;

  let orbitRadius = 0;
  if (entity.orbit) {
    const a = Math.max(entity.orbit.semiMajorAxis, 0.0001);
    orbitRadius =
      kind === 'moon'
        ? parentRadius + 1.2 + 2.4 * Math.pow(a, 0.5)
        : 6 * Math.pow(a, 0.62);
  }

  const annotation = context.annotate?.(entity);
  const label = annotation?.suffix ? `${entity.name} ${annotation.suffix}` : entity.name;

  return {
    entityId: entity.id,
    parentId: entity.parentId,
    kind,
    authoredType,
    name: entity.name,
    label,
    radius,
    orbit: entity.orbit,
    orbitRadius,
    offset: entity.position
      ? { x: entity.position.x, y: entity.position.y, z: entity.position.z }
      : { x: 0, y: 0, z: 0 },
    color: colorOf(visual, kind),
    emissive: typeof visual?.emissive === 'string' ? visual.emissive : kind === 'star' ? '#ffcf7a' : '#000000',
    emissiveIntensity: typeof visual?.emissiveIntensity === 'number' ? visual.emissiveIntensity : kind === 'star' ? 1.1 : 0,
    roughness: typeof visual?.roughness === 'number' ? visual.roughness : 0.8,
    metalness: typeof visual?.metalness === 'number' ? visual.metalness : 0.05,
    facets: typeof visual?.facets === 'number' ? Math.round(visual.facets) : 3,
    banding: typeof visual?.banding === 'number' ? visual.banding : 0.2,
    atmosphere:
      visual?.atmosphere && visual.atmosphere.enabled
        ? { color: visual.atmosphere.color, intensity: visual.atmosphere.intensity }
        : undefined,
    ring: kind === 'bloodRing' ? deriveRing(visual, parentRadius) : deriveRing(visual, radius),
    canonStatus: entity.meta.canonStatus,
    present: context.present(entity.id),
    destroyed: annotation?.destroyed ?? false,
    spinPeriodDays:
      typeof entity.orbit?.period === 'number' && entity.orbit.period > 0
        ? Math.max(entity.orbit.period * 0.02, 0.2)
        : 1,
    isPrimary: authoredType === 'star' || authoredType === 'blackHole',
  };
}

/**
 * Derive every renderable body of one solar system, in authored order.
 * Moons and Blood Rings are parented to their planet through `parentId`.
 */
export function deriveSystemBodies(
  project: StarMapProject,
  systemId: string,
  context: DerivationContext = ALWAYS_PRESENT,
): DerivedBody[] {
  const system = entityById(project, systemId);
  if (!system) return [];
  const out: DerivedBody[] = [];

  const primary = childrenOf(project, systemId).find(
    (child) => child.type === 'star' || child.type === 'blackHole',
  );
  const primaryRadius = primary ? 6 : 4;

  const visit = (parentId: string, parentRadius: number, depth: number) => {
    if (depth > 6) return;
    for (const child of childrenOf(project, parentId)) {
      if (child.type === 'galaxy' || child.type === 'starfield' || child.type === 'system') continue;
      const body = bodyFromEntity(child, context, parentRadius);
      out.push(body);
      visit(child.id, body.radius || 1, depth + 1);
    }
  };

  visit(systemId, primaryRadius, 0);
  return out;
}

/* ------------------------------------------------------------------ *
 * Galaxy-scale derivation
 * ------------------------------------------------------------------ */

export interface DerivedSector {
  entityId: string;
  name: string;
  center: { x: number; y: number; z: number };
  radius: number;
  color: string;
  canonStatus: Entity['meta']['canonStatus'];
  present: boolean;
}

export interface DerivedSystemMarker {
  entityId: string;
  name: string;
  position: { x: number; y: number; z: number };
  color: string;
  canonStatus: Entity['meta']['canonStatus'];
  present: boolean;
  destroyed: boolean;
  collapsed: boolean;
  hasBloodRing: boolean;
}

export interface DerivedStructure {
  entityId: string;
  name: string;
  kind: 'siegeWall' | 'region' | 'other';
  center: { x: number; y: number; z: number };
  radius: number;
  color: string;
  present: boolean;
  description: string;
}

export interface DerivedGalaxy {
  sectors: DerivedSector[];
  systems: DerivedSystemMarker[];
  structures: DerivedStructure[];
}

function positionOf(entity: Entity): { x: number; y: number; z: number } {
  return entity.position
    ? { x: entity.position.x, y: entity.position.y, z: entity.position.z }
    : { x: 0, y: 0, z: 0 };
}

function structureKind(entity: Entity): DerivedStructure['kind'] {
  const authored = entity.visual?.structure;
  if (authored === 'siegeWall' || authored === 'region') return authored;
  const tags = (entity.meta.tags ?? []).map((t) => t.toLowerCase());
  if (tags.includes('siege-wall') || /siege wall/i.test(entity.name)) return 'siegeWall';
  return entity.type === 'largeScaleStructure' ? 'region' : 'other';
}

function extentOf(project: StarMapProject, entityId: string): number {
  const owner = entityById(project, entityId);
  const authoredExtent = owner?.visual?.extent;
  if (typeof authoredExtent === 'number' && authoredExtent > 0) return authoredExtent;
  let max = 0;
  for (const descendant of childrenOf(project, entityId)) {
    const p = positionOf(descendant);
    const d = Math.hypot(p.x, p.y, p.z);
    if (Number.isFinite(d)) max = Math.max(max, d);
  }
  return max > 0 ? max * 1.15 : 12;
}

/** Derive the galaxy-scale scene description. */
export function deriveGalaxy(
  project: StarMapProject,
  context: DerivationContext = ALWAYS_PRESENT,
): DerivedGalaxy {
  const sectors: DerivedSector[] = [];
  const systems: DerivedSystemMarker[] = [];
  const structures: DerivedStructure[] = [];

  const hasBloodRing = (systemId: string): boolean => {
    const stack = [systemId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      for (const child of childrenOf(project, id)) {
        if (child.type === 'bloodRing' && context.present(child.id)) return true;
        stack.push(child.id);
      }
    }
    return false;
  };

  const walk = (entity: Entity) => {
    for (const child of childrenOf(project, entity.id)) {
      const present = context.present(child.id);
      if (child.type === 'starfield') {
        sectors.push({
          entityId: child.id,
          name: child.name,
          center: positionOf(child),
          radius: extentOf(project, child.id),
          color: typeof child.visual?.color === 'string' ? child.visual.color : '#55dfff',
          canonStatus: child.meta.canonStatus,
          present,
        });
      } else if (child.type === 'system') {
        const star = childrenOf(project, child.id).find(
          (c) => c.type === 'star' || c.type === 'blackHole',
        );
        const collapsed = star ? context.effectiveType(star) === 'blackHole' : false;
        systems.push({
          entityId: child.id,
          name: child.name,
          position: positionOf(child),
          color:
            typeof child.visual?.color === 'string'
              ? child.visual.color
              : collapsed
                ? '#0a0f18'
                : '#a6efff',
          canonStatus: child.meta.canonStatus,
          present,
          destroyed: context.annotate?.(child)?.destroyed ?? false,
          collapsed,
          hasBloodRing: hasBloodRing(child.id),
        });
      } else if (child.type === 'largeScaleStructure') {
        structures.push({
          entityId: child.id,
          name: child.name,
          kind: structureKind(child),
          center: positionOf(child),
          radius: extentOf(project, child.id),
          color: typeof child.visual?.color === 'string' ? child.visual.color : '#55dfff',
          present,
          description: child.meta.description ?? '',
        });
      }
      walk(child);
    }
  };

  const root = project.entities.find((e) => e.parentId === null);
  if (root) walk(root);
  return { sectors, systems, structures };
}
