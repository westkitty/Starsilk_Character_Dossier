import type { OrbitDefinition, Position3 } from "./core.js";

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

export function normalizeRadians(value: number): number {
  const normalized = value % TAU;
  return normalized < 0 ? normalized + TAU : normalized;
}

export function solveEccentricAnomaly(meanAnomaly: number, eccentricity: number): number {
  const e = Math.min(Math.max(eccentricity, 0), 0.999999);
  const m = normalizeRadians(meanAnomaly);
  let estimate = e < 0.8 ? m : Math.PI;
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const f = estimate - e * Math.sin(estimate) - m;
    const derivative = 1 - e * Math.cos(estimate);
    const delta = f / derivative;
    estimate -= delta;
    if (Math.abs(delta) < 1e-10) break;
  }
  return estimate;
}

export function orbitalPosition(orbit: OrbitDefinition, simulationTime: number): Position3 {
  if (!Number.isFinite(orbit.period) || orbit.period <= 0) return { x: orbit.semiMajorAxis, y: 0, z: 0 };
  const meanMotion = TAU / orbit.period;
  const meanAnomaly = orbit.meanAnomalyAtEpoch * DEG + meanMotion * (simulationTime - orbit.epoch);
  const eccentricAnomaly = solveEccentricAnomaly(meanAnomaly, orbit.eccentricity);
  const e = Math.min(Math.max(orbit.eccentricity, 0), 0.999999);
  const xOrbital = orbit.semiMajorAxis * (Math.cos(eccentricAnomaly) - e);
  const yOrbital = orbit.semiMajorAxis * Math.sqrt(1 - e * e) * Math.sin(eccentricAnomaly);

  const omega = orbit.argumentOfPeriapsis * DEG;
  const inclination = orbit.inclination * DEG;
  const node = orbit.ascendingNode * DEG;
  const cosO = Math.cos(node);
  const sinO = Math.sin(node);
  const cosI = Math.cos(inclination);
  const sinI = Math.sin(inclination);
  const cosW = Math.cos(omega);
  const sinW = Math.sin(omega);

  const x = (cosO * cosW - sinO * sinW * cosI) * xOrbital + (-cosO * sinW - sinO * cosW * cosI) * yOrbital;
  const y = (sinW * sinI) * xOrbital + (cosW * sinI) * yOrbital;
  const z = (sinO * cosW + cosO * sinW * cosI) * xOrbital + (-sinO * sinW + cosO * cosW * cosI) * yOrbital;
  return { x, y, z };
}

export function displayOrbitRadius(authoredDistance: number): number {
  const sign = Math.sign(authoredDistance || 1);
  return sign * Math.log1p(Math.abs(authoredDistance)) * 4.2;
}

export function displayPosition(position: Position3): Position3 {
  const length = Math.hypot(position.x, position.y, position.z);
  if (length === 0) return { x: 0, y: 0, z: 0 };
  const compressed = Math.log1p(length) * 7;
  const scale = compressed / length;
  return { x: position.x * scale, y: position.y * scale, z: position.z * scale };
}
