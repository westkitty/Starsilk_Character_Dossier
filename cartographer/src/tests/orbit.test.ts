import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { keplerPosition, solveEccentricAnomaly } from "../model/orbit.ts";
import type { KeplerOrbit } from "../model/types.ts";

const circular: KeplerOrbit = {
  semiMajorAxis: 1,
  eccentricity: 0,
  inclination: 0,
  ascendingNode: 0,
  argumentOfPeriapsis: 0,
  meanAnomalyAtEpoch: 0,
  epoch: 0,
  period: Math.PI * 2,
};

describe("keplerian orbits", () => {
  it("places a circular orbit at periapsis +X at t=0", () => {
    const p = keplerPosition(circular, 0);
    assert.ok(Math.abs(p.x - 1) < 1e-10);
    assert.ok(Math.abs(p.y) < 1e-10);
    assert.ok(Math.abs(p.z) < 1e-10);
  });

  it("reaches +Y at a quarter period", () => {
    const p = keplerPosition(circular, Math.PI / 2);
    assert.ok(Math.abs(p.x) < 1e-10);
    assert.ok(Math.abs(p.y - 1) < 1e-10);
    assert.ok(Math.abs(p.z) < 1e-10);
  });

  it("returns to start after one period", () => {
    const p = keplerPosition(circular, Math.PI * 2);
    assert.ok(Math.abs(p.x - 1) < 1e-9);
    assert.ok(Math.abs(p.y) < 1e-9);
  });

  it("is deterministic for a known eccentric input", () => {
    const orbit: KeplerOrbit = {
      ...circular,
      eccentricity: 0.5,
      period: 100,
    };
    const a = keplerPosition(orbit, 25);
    const b = keplerPosition(orbit, 25);
    assert.deepEqual(a, b);
    const E = solveEccentricAnomaly(Math.PI / 2, 0.5);
    assert.ok(E > 1.7 && E < 2.1);
    const p = keplerPosition(orbit, 0);
    const r = orbit.semiMajorAxis * (1 - orbit.eccentricity);
    assert.ok(Math.abs(p.x - r) < 1e-8);
    assert.ok(Math.abs(p.y) < 1e-8);
  });
});
