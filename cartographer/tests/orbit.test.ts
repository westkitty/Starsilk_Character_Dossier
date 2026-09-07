import { describe, expect, it } from 'vitest';
import {
  hashSeed,
  mulberry32,
  orbitTrack,
  positionAtDay,
  positionFromElements,
  solveKepler,
  spinAngleDeg,
} from '../src/render/orbit';
import { meanAnomalyAt } from '../src/core/simulation';
import type { OrbitalElements } from '../src/core/types';

function elements(overrides: Partial<OrbitalElements> = {}): OrbitalElements {
  return {
    semiMajorAxis: 1,
    eccentricity: 0,
    inclination: 0,
    ascendingNode: 0,
    argumentOfPeriapsis: 0,
    meanAnomalyAtEpoch: 0,
    epoch: 0,
    period: 365,
    ...overrides,
  };
}

const closeTo = (value: number, expected: number, tolerance = 1e-9) =>
  expect(Math.abs(value - expected)).toBeLessThan(tolerance);

describe('Kepler solver', () => {
  it('matches a known reference solution for e = 0.5, M = 1 rad', () => {
    // Reference value computed independently; residual is machine-zero.
    closeTo(solveKepler(1.0, 0.5), 1.4987011335178484, 1e-12);
  });

  it('satisfies Kepler\'s equation across eccentricities', () => {
    for (const e of [0, 0.1, 0.35, 0.6, 0.85, 0.95]) {
      for (const M of [-3, -1, 0, 0.7, 2.2, 4.9]) {
        const E = solveKepler(M, e);
        const wrapped = ((M % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        closeTo(E - e * Math.sin(E) - wrapped, 0, 1e-10);
      }
    }
  });

  it('is deterministic across repeated calls', () => {
    const a = solveKepler(2.5, 0.7);
    const b = solveKepler(2.5, 0.7);
    expect(a).toBe(b);
  });
});

describe('Keplerian positioning', () => {
  it('places a circular orbit exactly', () => {
    const atZero = positionFromElements(elements({ semiMajorAxis: 2 }), 0);
    closeTo(atZero.x, 2);
    closeTo(atZero.y, 0);
    closeTo(atZero.z, 0);
    closeTo(atZero.radius, 2);

    const atQuarter = positionFromElements(elements({ semiMajorAxis: 2 }), 90);
    closeTo(atQuarter.x, 0);
    closeTo(atQuarter.y, 0);
    closeTo(atQuarter.z, -2);
  });

  it('applies inclination about the ecliptic pole', () => {
    const state = positionFromElements(elements({ inclination: 90 }), 90);
    closeTo(state.x, 0);
    closeTo(state.y, 1);
    closeTo(state.z, 0);
  });

  it('applies the longitude of the ascending node', () => {
    const state = positionFromElements(elements({ ascendingNode: 90 }), 0);
    closeTo(state.x, 0);
    closeTo(state.y, 0);
    closeTo(state.z, -1);
  });

  it('applies the argument of periapsis', () => {
    const state = positionFromElements(elements({ argumentOfPeriapsis: 90 }), 0);
    closeTo(state.x, 0);
    closeTo(state.y, 0);
    closeTo(state.z, -1);
  });

  it('puts periapsis and apoapsis at a(1-e) and a(1+e)', () => {
    const peri = positionFromElements(elements({ eccentricity: 0.5, semiMajorAxis: 1 }), 0);
    closeTo(peri.radius, 0.5);
    closeTo(peri.x, 0.5);

    const apo = positionFromElements(elements({ eccentricity: 0.5, semiMajorAxis: 1 }), 180);
    closeTo(apo.radius, 1.5);
    closeTo(apo.x, -1.5);
  });

  it('is periodic in the authored period', () => {
    const e = elements({ period: 400, meanAnomalyAtEpoch: 37, eccentricity: 0.2 });
    const first = positionAtDay(e, 123);
    const later = positionAtDay(e, 123 + 400);
    closeTo(first.x, later.x, 1e-9);
    closeTo(first.y, later.y, 1e-9);
    closeTo(first.z, later.z, 1e-9);
  });

  it('honours the epoch offset', () => {
    const a = positionAtDay(elements({ epoch: 100, period: 200 }), 150);
    const b = positionAtDay(elements({ epoch: 0, period: 200 }), 50);
    closeTo(a.x, b.x, 1e-9);
    closeTo(a.z, b.z, 1e-9);
  });

  it('meanAnomalyAt advances 360° per period', () => {
    const e = elements({ period: 30, meanAnomalyAtEpoch: 10 });
    closeTo(meanAnomalyAt(e, 0), 10);
    closeTo(meanAnomalyAt(e, 30), 370);
    closeTo(meanAnomalyAt(e, 45), 550);
  });
});

describe('orbit tracks and spin', () => {
  it('produces a deterministic closed polyline', () => {
    const e = elements({ eccentricity: 0.3, inclination: 12, ascendingNode: 40 });
    const track = orbitTrack(e, 64);
    expect(track).toHaveLength(64);
    const again = orbitTrack(e, 64);
    expect(track[10]!.x).toBe(again[10]!.x);
    expect(track[10]!.z).toBe(again[10]!.z);
    // Closed: first sample equals the sample one full revolution later.
    const closure = positionFromElements(e, 360);
    closeTo(closure.x, track[0]!.x, 1e-9);
    closeTo(closure.z, track[0]!.z, 1e-9);
  });

  it('spins deterministically from the rotation period', () => {
    closeTo(spinAngleDeg(2, 1), 180);
    closeTo(spinAngleDeg(2, 4), 720);
    expect(spinAngleDeg(0, 5)).toBe(0);
  });
});

describe('procedural determinism', () => {
  it('mulberry32 repeats for a given seed', () => {
    const a = mulberry32(1234);
    const b = mulberry32(1234);
    const seriesA = [a(), a(), a()];
    const seriesB = [b(), b(), b()];
    expect(seriesA).toEqual(seriesB);
  });

  it('hashSeed is stable and order sensitive', () => {
    expect(hashSeed('fallenstar-prime')).toBe(hashSeed('fallenstar-prime'));
    expect(hashSeed('fallenstar-prime')).not.toBe(hashSeed('prime-fallenstar'));
  });
});
