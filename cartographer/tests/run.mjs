import assert from "node:assert/strict";
import { ProjectStore, createEntity, createProject, descendantsOf, validateProject } from "../.test-build/core.js";
import { createDemoProject } from "../.test-build/demo.js";
import { orbitalPosition, solveEccentricAnomaly } from "../.test-build/orbit.js";
import { eventIsActive, resolveEntityHistoricalState, resolveHistoricalTime, returnToParentTime, setHistoricalOverride } from "../.test-build/timeline.js";

let passed = 0;
function test(name, fn) { try { fn(); passed += 1; console.log(`PASS ${name}`); } catch (error) { console.error(`FAIL ${name}`); throw error; } }

test("project schema validates", () => assert.equal(validateProject(createProject("Fixture")).ok, true));
test("demo project validates", () => assert.equal(validateProject(createDemoProject()).ok, true));
test("duplicate stable ids are rejected", () => { const project = createProject("Fixture"); project.entities.push({ ...structuredClone(project.entities[0]), parentId: null }); assert.match(validateProject(project).errors.join(" "), /Duplicate entity id/); });
test("missing parents are rejected", () => { const project = createProject("Fixture"); project.entities.push(createEntity("system", "missing", "Bad System")); assert.match(validateProject(project).errors.join(" "), /Missing parent/); });
test("store authoring plus undo redo preserve valid state", () => { const project = createProject("Fixture"); const galaxy = project.entities[0]; const store = new ProjectStore(project); const sector = createEntity("starfield", galaxy.id, "Sector A"); store.add(sector); const system = createEntity("system", sector.id, "System A"); store.add(system); const duplicateId = store.duplicate(system.id); assert.ok(store.project.entities.some((entity) => entity.id === duplicateId)); store.delete(system.id); assert.equal(store.project.entities.some((entity) => entity.id === system.id), false); assert.equal(store.undo(), true); assert.equal(store.project.entities.some((entity) => entity.id === system.id), true); assert.equal(store.redo(), true); assert.equal(store.project.entities.some((entity) => entity.id === system.id), false); assert.equal(validateProject(store.project).ok, true); assert.equal(descendantsOf(store.project, sector.id).length, 1); });
test("Kepler solver is deterministic", () => { const first = solveEccentricAnomaly(1.2345, 0.21); const second = solveEccentricAnomaly(1.2345, 0.21); assert.equal(first, second); assert.ok(Math.abs(first - 0.21 * Math.sin(first) - 1.2345) < 1e-12); });
test("circular orbit returns expected quarter position", () => { const position = orbitalPosition({ semiMajorAxis: 2, eccentricity: 0, inclination: 0, ascendingNode: 0, argumentOfPeriapsis: 0, meanAnomalyAtEpoch: 0, epoch: 0, period: 4 }, 1); assert.ok(Math.abs(position.x) < 1e-9); assert.ok(Math.abs(position.y) < 1e-9); assert.ok(Math.abs(position.z - 2) < 1e-9); });

function timelineFixture() {
  const project = createProject("Timeline Fixture");
  const galaxy = project.entities[0]; galaxy.id = "g"; galaxy.time = { mode: "override", overrideValue: 121 };
  const a = createEntity("starfield", "g", "A"); a.id = "a";
  const b = createEntity("starfield", "g", "B"); b.id = "b";
  const system = createEntity("system", "a", "SYS"); system.id = "sys";
  const planet = createEntity("planet", "sys", "P"); planet.id = "p";
  project.entities.push(a, b, system, planet);
  return project;
}

test("galaxy historical time propagates through inheriting descendants", () => { const project = timelineFixture(); assert.equal(resolveHistoricalTime(project, "p").value, 121); assert.equal(resolveHistoricalTime(project, "p").sourceId, "g"); });
test("sector override controls its branch and leaves siblings alone", () => { const project = timelineFixture(); setHistoricalOverride(project, "a", 3); assert.equal(resolveHistoricalTime(project, "sys").value, 3); assert.equal(resolveHistoricalTime(project, "b").value, 121); });
test("system and object overrides resolve independently", () => { const project = timelineFixture(); setHistoricalOverride(project, "sys", 170); assert.equal(resolveHistoricalTime(project, "p").value, 170); setHistoricalOverride(project, "p", 3); assert.equal(resolveHistoricalTime(project, "p").value, 3); assert.equal(resolveHistoricalTime(project, "sys").value, 170); });
test("return to parent time removes local override immediately", () => { const project = timelineFixture(); setHistoricalOverride(project, "sys", 170); setHistoricalOverride(project, "p", 3); returnToParentTime(project, "p"); assert.equal(resolveHistoricalTime(project, "p").value, 170); });
test("Blood Ring is absent before creation and present after", () => { const project = createDemoProject(); setHistoricalOverride(project, "bloodring-fallenstar-prime", 0); assert.equal(resolveEntityHistoricalState(project, "bloodring-fallenstar-prime").visible, false); setHistoricalOverride(project, "bloodring-fallenstar-prime", 3); assert.equal(resolveEntityHistoricalState(project, "bloodring-fallenstar-prime").visible, true); });
test("Starsilk extraction collapse converts star and destroys system state", () => { const project = createDemoProject(); setHistoricalOverride(project, "system-heliocide-demo", 170); assert.equal(resolveEntityHistoricalState(project, "star-heliocide-demo").effectiveType, "star"); setHistoricalOverride(project, "system-heliocide-demo", "POST-SIEGE-WALL"); assert.equal(resolveEntityHistoricalState(project, "star-heliocide-demo").effectiveType, "blackHole"); assert.equal(resolveEntityHistoricalState(project, "system-heliocide-demo").destroyed, true); assert.equal(resolveEntityHistoricalState(project, "planet-heliocide-demo").visible, false); });
test("symbolic historical ordering is deterministic without inventing a main-narrative year", () => { assert.equal(eventIsActive(170, "POST-SIEGE-WALL"), true); assert.equal(eventIsActive("POST-SIEGE-WALL", 170), false); assert.equal(eventIsActive("POST-SIEGE-WALL", "MAIN NARRATIVE — DATE UNSPECIFIED"), true); });

console.log(`\n${passed} core/orbital/temporal tests passed.`);
