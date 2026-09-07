import assert from "node:assert/strict";
import {
  ProjectStore,
  createEntity,
  createProject,
  descendantsOf,
  validateProject
} from "../.test-build/core.js";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test("project schema validates", () => {
  const project = createProject("Fixture");
  assert.equal(validateProject(project).ok, true);
});

test("duplicate stable ids are rejected", () => {
  const project = createProject("Fixture");
  project.entities.push({ ...structuredClone(project.entities[0]), parentId: null });
  assert.match(validateProject(project).errors.join(" "), /Duplicate entity id/);
});

test("missing parents are rejected", () => {
  const project = createProject("Fixture");
  project.entities.push(createEntity("system", "missing", "Bad System"));
  assert.match(validateProject(project).errors.join(" "), /Missing parent/);
});

test("store add duplicate delete and undo redo preserve valid state", () => {
  const project = createProject("Fixture");
  const galaxy = project.entities[0];
  const store = new ProjectStore(project);
  const sector = createEntity("starfield", galaxy.id, "Sector A");
  store.add(sector);
  const system = createEntity("system", sector.id, "System A");
  store.add(system);
  const duplicateId = store.duplicate(system.id);
  assert.ok(store.project.entities.some((entity) => entity.id === duplicateId));
  store.delete(system.id);
  assert.equal(store.project.entities.some((entity) => entity.id === system.id), false);
  assert.equal(store.undo(), true);
  assert.equal(store.project.entities.some((entity) => entity.id === system.id), true);
  assert.equal(store.redo(), true);
  assert.equal(store.project.entities.some((entity) => entity.id === system.id), false);
  assert.equal(validateProject(store.project).ok, true);
  assert.equal(descendantsOf(store.project, sector.id).length, 1);
});

console.log(`\n${passed} core tests passed.`);
