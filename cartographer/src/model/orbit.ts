import type { KeplerOrbit, Vec3 } from "./types.ts";

const TWO_PI = Math.PI * 2;
const KEPLER_ITERS = 12;
const KEPLER_TOL = 1e-12;

function wrapAngle(a: number): number {
  const w = a % TWO_PI;
  return w < 0 ? w + TWO_PI : w;
}

/** Solve Kepler's equation M = E - e sin E for eccentric anomaly. */
export function solveEccentricAnomaly(meanAnomaly: number, eccentricity: number): number {
  const e = Math.min(Math.max(eccentricity, 0), 0.999999);
  const M = wrapAngle(meanAnomaly);
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < KEPLER_ITERS; i++) {
    const f = E - e * Math.sin(E) - M;
    const fp = 1 - e * Math.cos(E);
    const d = f / fp;
    E -= d;
    if (Math.abs(d) < KEPLER_TOL) break;
  }
  return E;
}

export function trueAnomalyFromEccentric(E: number, e: number): number {
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const cosNu = (cosE - e) / (1 - e * cosE);
  const sinNu = (Math.sqrt(1 - e * e) * sinE) / (1 - e * cosE);
  return Math.atan2(sinNu, cosNu);
}

/**
 * Deterministic Keplerian position in the parent body's local frame.
 * Uninclined orbits lie in the XY plane; periapsis along +X at true anomaly 0.
 * Authored values are never mutated.
 */
export function keplerPosition(orbit: KeplerOrbit, simTime: number): Vec3 {
  const period = orbit.period === 0 ? 1 : orbit.period;
  const n = TWO_PI / period;
  const M = orbit.meanAnomalyAtEpoch + n * (simTime - orbit.epoch);
  const e = orbit.eccentricity;
  let xP: number;
  let yP: number;
  if (e < 1e-12) {
    const Mw = wrapAngle(M);
    const r = orbit.semiMajorAxis;
    xP = r * Math.cos(Mw);
    yP = r * Math.sin(Mw);
  } else {
    const E = solveEccentricAnomaly(M, e);
    const nu = trueAnomalyFromEccentric(E, e);
    const r = orbit.semiMajorAxis * (1 - e * e) / (1 + e * Math.cos(nu));
    xP = r * Math.cos(nu);
    yP = r * Math.sin(nu);
  }

  const cO = Math.cos(orbit.ascendingNode);
  const sO = Math.sin(orbit.ascendingNode);
  const ci = Math.cos(orbit.inclination);
  const si = Math.sin(orbit.inclination);
  const cw = Math.cos(orbit.argumentOfPeriapsis);
  const sw = Math.sin(orbit.argumentOfPeriapsis);

  const x1 = cw * xP - sw * yP;
  const y1 = sw * xP + cw * yP;

  const x2 = x1;
  const y2 = ci * y1;
  const z2 = si * y1;

  return {
    x: cO * x2 - sO * y2,
    y: sO * x2 + cO * y2,
    z: z2,
    unit: orbit.unit,
  };
}

/** Compressed display radius so astronomical AU values remain readable. */
export function displayOrbitRadius(semiMajorAxis: number, compression = 0.45): number {
  const a = Math.max(semiMajorAxis, 0);
  if (a <= 1) return a * 4;
  return 4 + Math.pow(a, compression) * 3.2;
}

export function displayBodyRadius(authored: number, kind: string): number {
  const r = Math.max(authored, 0.001);
  if (kind === "star" || kind === "blackHole") return Math.min(Math.max(r * 0.35, 0.55), 2.4);
  if (kind === "planet") return Math.min(Math.max(r * 0.22, 0.18), 0.85);
  if (kind === "moon") return Math.min(Math.max(r * 0.12, 0.07), 0.28);
  if (kind === "bloodRing") return Math.min(Math.max(r, 0.9), 2.8);
  return Math.min(Math.max(r * 0.2, 0.12), 0.6);
}

export function sampleOrbitPath(orbit: KeplerOrbit, samples = 128): Vec3[] {
  const pts: Vec3[] = [];
  const period = orbit.period === 0 ? 1 : orbit.period;
  for (let i = 0; i <= samples; i++) {
    pts.push(keplerPosition(orbit, orbit.epoch + (period * i) / samples));
  }
  return pts;
}

export function meanMotion(period: number): number {
  return TWO_PI / (period === 0 ? 1 : period);
}
