/**
 * Deterministic Keplerian positioning.
 *
 * No N-body integration: positions are closed-form functions of the authored
 * orbital elements and a day count, so the same input always yields the same
 * output on every machine. This is a cartography tool, not a physics sandbox.
 *
 * Frame conventions
 * -----------------
 * Classical elements are evaluated in an ecliptic-style frame (z = pole), then
 * mapped into Three.js's y-up world with the proper rotation (x, z, -y), which
 * keeps the system right-handed.
 */

import type { OrbitalElements } from '../core/types';

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/**
 * Solve Kepler's equation `M = E - e·sin E` for the eccentric anomaly.
 *
 * Newton–Raphson with a *fixed* iteration budget: the result never depends on a
 * convergence test that could differ between engines, which keeps screenshots and
 * tests reproducible.
 */
export function solveKepler(meanAnomalyRad: number, eccentricity: number, iterations = 14): number {
  const e = Math.min(Math.max(eccentricity, 0), 0.999);
  // Wrap M into [-π, π] for numerical stability.
  let M = meanAnomalyRad % (Math.PI * 2);
  if (M > Math.PI) M -= Math.PI * 2;
  if (M < -Math.PI) M += Math.PI * 2;

  let E = e < 0.8 ? M : Math.PI * Math.sign(M || 1);
  for (let i = 0; i < iterations; i += 1) {
    const f = E - e * Math.sin(E) - M;
    const fp = 1 - e * Math.cos(E);
    const step = f / (Math.abs(fp) < 1e-12 ? 1e-12 : fp);
    E -= step;
    if (Math.abs(step) < 1e-14) break;
  }
  return E;
}

export interface KeplerState extends Vec3Like {
  /** Distance from the focus, in the authored length unit. */
  radius: number;
  /** True anomaly, degrees. */
  trueAnomalyDeg: number;
}

/**
 * Position from classical elements.
 *
 * @param meanAnomalyDeg mean anomaly at the requested moment, degrees
 * @returns world-space offset (Three.js y-up) in the authored length unit
 */
export function positionFromElements(
  elements: Pick<
    OrbitalElements,
    'semiMajorAxis' | 'eccentricity' | 'inclination' | 'ascendingNode' | 'argumentOfPeriapsis'
  >,
  meanAnomalyDeg: number,
): KeplerState {
  const a = elements.semiMajorAxis;
  const e = Math.min(Math.max(elements.eccentricity, 0), 0.999);
  const E = solveKepler(meanAnomalyDeg * DEG2RAD, e);

  // Perifocal coordinates (focus at origin, periapsis on +x).
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const radius = a * (1 - e * Math.cos(E));

  const cosO = Math.cos(elements.ascendingNode * DEG2RAD);
  const sinO = Math.sin(elements.ascendingNode * DEG2RAD);
  const cosw = Math.cos(elements.argumentOfPeriapsis * DEG2RAD);
  const sinw = Math.sin(elements.argumentOfPeriapsis * DEG2RAD);
  const cosi = Math.cos(elements.inclination * DEG2RAD);
  const sini = Math.sin(elements.inclination * DEG2RAD);

  // Perifocal → ecliptic (Ω about z, i about x, ω about z).
  const xe = (cosO * cosw - sinO * sinw * cosi) * xp + (-cosO * sinw - sinO * cosw * cosi) * yp;
  const ye = (sinO * cosw + cosO * sinw * cosi) * xp + (-sinO * sinw + cosO * cosw * cosi) * yp;
  const ze = sinw * sini * xp + cosw * sini * yp;

  // Ecliptic → Three.js y-up: (x, y, z) → (x, z, -y).
  return {
    x: xe,
    y: ze,
    z: -ye,
    radius,
    trueAnomalyDeg: Math.atan2(yp, xp) * RAD2DEG,
  };
}

/** Position at an authored day count. */
export function positionAtDay(elements: OrbitalElements, days: number): KeplerState {
  const period = Number.isFinite(elements.period) && elements.period > 0 ? elements.period : 1;
  const revolutions = (days - elements.epoch) / period;
  const meanAnomalyDeg = elements.meanAnomalyAtEpoch + 360 * revolutions;
  return positionFromElements(elements, meanAnomalyDeg);
}

/**
 * Sample the full orbital ellipse as world-space points (for orbit tracks).
 * Deterministic: the same elements always produce the same polyline.
 */
export function orbitTrack(elements: OrbitalElements, samples = 128): Vec3Like[] {
  const points: Vec3Like[] = [];
  for (let i = 0; i < samples; i += 1) {
    const meanAnomalyDeg = (360 * i) / samples;
    points.push(positionFromElements(elements, meanAnomalyDeg));
  }
  return points;
}

/** Rotation angle (degrees) for a body's own spin at a given day count. */
export function spinAngleDeg(rotationPeriodDays: number, days: number): number {
  if (!Number.isFinite(rotationPeriodDays) || rotationPeriodDays <= 0) return 0;
  return (360 * days) / rotationPeriodDays;
}

/** Small deterministic PRNG (mulberry32) — used for procedural, reproducible detail. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable integer seed from any string (ids, names). */
export function hashSeed(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
