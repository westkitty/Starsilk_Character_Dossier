/**
 * PHYSICAL vs DISPLAY SCALE.
 *
 * Authored values (parsecs, AU, days) are never mutated to suit the viewport.
 * Instead every distance passes through a monotonic compression so that a moon at
 * 0.002 AU and an outer world at 40 AU can share one legible frame. The authored
 * numbers stay exactly as written in the inspector and in exported JSON.
 */

import type { Entity, EntityType } from '../core/types';

export const DISPLAY_GAIN = 6;
export const DISPLAY_EXPONENT = 0.62;

/**
 * Compress an authored distance into scene units.
 * Strictly monotonic for positive input, so ordering and crossing can never invert.
 */
export function compressDistance(
  authored: number,
  gain = DISPLAY_GAIN,
  exponent = DISPLAY_EXPONENT,
): number {
  if (!Number.isFinite(authored)) return 0;
  const sign = authored < 0 ? -1 : 1;
  return sign * gain * Math.pow(Math.abs(authored), exponent);
}

export function compressOrbit(semiMajorAxis: number): number {
  return compressDistance(Math.max(semiMajorAxis, 0.0001));
}

const FALLBACK_RADIUS: Record<EntityType, number> = {
  galaxy: 1,
  starfield: 1,
  system: 1,
  star: 6,
  blackHole: 3.4,
  planet: 2.2,
  moon: 0.7,
  bloodRing: 1,
  orbitalStructure: 1.1,
  largeScaleStructure: 1,
  other: 1.2,
};

/** Display radius for a body, honouring authored visual overrides. */
export function displayRadius(entity: Entity): number {
  const authored = entity.visual?.displayRadius;
  if (typeof authored === 'number' && Number.isFinite(authored) && authored > 0) return authored;
  return FALLBACK_RADIUS[entity.type] ?? 1;
}

/** Moon orbits are compressed against their parent's display radius. */
export function moonOrbitDisplayRadius(parentRadius: number, semiMajorAxis: number): number {
  return parentRadius + 1.2 + compressDistance(Math.max(semiMajorAxis, 0.001), 2.4, 0.5);
}

/** Camera distance that frames a system of the given maximum orbit radius. */
export function framingDistance(maxRadius: number): number {
  return Math.max(maxRadius * 2.4, 14);
}

/** Galaxy-view scale: authored parsecs → scene units. */
export const GALAXY_UNITS_PER_PARSEC = 1;

export function galaxyPositionToScene(position: { x: number; y: number; z: number }): {
  x: number;
  y: number;
  z: number;
} {
  return {
    x: position.x * GALAXY_UNITS_PER_PARSEC,
    y: position.y * GALAXY_UNITS_PER_PARSEC,
    z: position.z * GALAXY_UNITS_PER_PARSEC,
  };
}
