import test from "node:test";
import assert from "node:assert/strict";
import { createDemoProject } from "../model/demo-project.ts";
import {
  diffHistoricalState,
  findKnowledgeGaps,
  isCompositeTemporalView,
  listTemporalOverrides,
  resolveHistoricalTimeTrace,
  runAnalystQuery,
  truthProfileForEntity,
} from "../model/analyst.ts";
import { resolveHistoricalView } from "../model/resolve-state.ts";
import type { Entity } from "../model/types.ts";

function entity(project: ReturnType<typeof createDemoProject>, id: string): Entity {
  const found = project.entities.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`Expected entity ${id}`);
  return found;
}

test("time trace preserves the ultimate temporal authority", () => {
  const project = createDemoProject();
  entity(project, "sec-fallenstar").time = { mode: "override", overrideValue: 3 };
  const trace = resolveHistoricalTimeTrace(project, "ring-fallenstar");
  assert.equal(trace.value, 3);
  assert.equal(trace.authorityId, "sec-fallenstar");
  assert.equal(trace.authorityKind, "entity-override");
  assert.equal(trace.inheritanceDepth, 3);
});

test("palimpsest detects divergent scope pins without changing siblings", () => {
  const project = createDemoProject();
  project.settings.galaxyHistoricalTime = 121;
  entity(project, "sec-fallenstar").time = { mode: "override", overrideValue: 3 };
  assert.equal(isCompositeTemporalView(project), true);
  const pins = listTemporalOverrides(project);
  assert.ok(pins.some((pin) => pin.entityId === "sec-fallenstar" && pin.divergent));
  assert.equal(resolveHistoricalTimeTrace(project, "pl-ruby").value, 121);
  assert.equal(resolveHistoricalTimeTrace(project, "ring-fallenstar").value, 3);
});

test("delta identifies first Blood Ring creation at Year 3", () => {
  const project = createDemoProject();
  const delta = diffHistoricalState(project, "ring-fallenstar", 0, 3);
  assert.equal(delta.before.present, false);
  assert.equal(delta.after.present, true);
  assert.ok(delta.changes.some((change) => change.kind === "CREATED"));
});

test("delta identifies Aureal stellar collapse and black-hole transformation", () => {
  const project = createDemoProject();
  const delta = diffHistoricalState(project, "star-aureal", 121, 170);
  assert.equal(delta.before.type, "star");
  assert.equal(delta.after.type, "blackHole");
  assert.equal(delta.after.collapsed, true);
  assert.ok(delta.changes.some((change) => change.kind === "TRANSFORMED"));
  assert.ok(delta.changes.some((change) => change.kind === "COLLAPSE"));
});

test("system collapse propagates through nested descendants", () => {
  const project = createDemoProject();
  const moon: Entity = {
    id: "moon-aureal-i-a",
    parentId: "pl-aureal-i",
    type: "moon",
    name: "Aureal I-A",
    orbit: {
      semiMajorAxis: 0.12,
      eccentricity: 0,
      inclination: 0,
      ascendingNode: 0,
      argumentOfPeriapsis: 0,
      meanAnomalyAtEpoch: 0,
      epoch: 0,
      period: 5,
    },
    visual: { displayRadius: 0.1, color: "#999999" },
    timeline: [],
    meta: { canonStatus: "schematic", positionCanon: "schematic" },
  };
  project.entities.push(moon);
  const view = resolveHistoricalView(project, moon, 170);
  assert.equal(view.present, false);
  assert.equal(view.destroyed, true);
});

test("truth lattice distinguishes schematic position from unknown position", () => {
  const project = createDemoProject();
  const system = entity(project, "sys-fallenstar");
  assert.equal(truthProfileForEntity(system).position?.status, "schematic");
  system.meta.positionCanon = "unknown";
  assert.equal(truthProfileForEntity(system).position?.status, "unknown");
});

test("explicit field truth overrides entity-level canon fallback", () => {
  const project = createDemoProject();
  const ring = entity(project, "ring-fallenstar");
  ring.meta.truth = {
    existence: { status: "locked", sourceNote: "Year 3 anchor" },
    orbit: { status: "schematic" },
    visual: { status: "editorial" },
  };
  const truth = truthProfileForEntity(ring);
  assert.equal(truth.existence?.status, "locked");
  assert.equal(truth.orbit?.status, "schematic");
  assert.equal(truth.visual?.status, "editorial");
});

test("knowledge gaps preserve absence instead of inventing placement", () => {
  const project = createDemoProject();
  const system = entity(project, "sys-fallenstar");
  system.position = undefined;
  system.meta.positionCanon = "unknown";
  const gaps = findKnowledgeGaps(project);
  assert.ok(gaps.some((gap) => gap.entityId === system.id && gap.field === "position" && gap.status === "unknown"));
});

test("canon queries expose temporal and epistemic structure", () => {
  const project = createDemoProject();
  entity(project, "sec-fallenstar").time = { mode: "override", overrideValue: 3 };
  const changed = runAnalystQuery(project, "changed-between", { from: 0, to: 170 });
  assert.ok(changed.some((result) => result.entityId === "ring-fallenstar"));
  assert.ok(changed.some((result) => result.entityId === "star-aureal"));
  const overrides = runAnalystQuery(project, "active-overrides");
  assert.ok(overrides.some((result) => result.entityId === "sec-fallenstar"));
});

test("collapse query includes descendants causally affected by the system collapse", () => {
  const project = createDemoProject();
  const affected = runAnalystQuery(project, "collapse-affected");
  assert.ok(affected.some((result) => result.entityId === "star-aureal"));
  assert.ok(affected.some((result) => result.entityId === "pl-aureal-i"));
});
