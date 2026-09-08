import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDemoProject } from "../model/demo-project.ts";
import { SCHEMA_VERSION } from "../model/types.ts";
import { SchemaError, validateProject } from "../model/validate.ts";
import { parseProjectJson, serializeProject } from "../persist/import-export.ts";

describe("schema validation", () => {
  it("accepts the demonstration project", () => {
    const demo = createDemoProject();
    const validated = validateProject(demo);
    assert.equal(validated.schemaVersion, SCHEMA_VERSION);
    assert.ok(validated.entities.length > 8);
  });

  it("round-trips project JSON", () => {
    const demo = createDemoProject();
    const json = serializeProject(demo);
    const imported = parseProjectJson(json);
    assert.equal(imported.id, demo.id);
    assert.equal(imported.entities.length, demo.entities.length);
    assert.equal(imported.settings.galaxyHistoricalTime, demo.settings.galaxyHistoricalTime);
    assert.deepEqual(
      imported.entities.map((e) => e.id),
      demo.entities.map((e) => e.id),
    );
    const ring = imported.entities.find((e) => e.id === "ring-fallenstar");
    assert.equal(ring?.type, "bloodRing");
    assert.equal(ring?.timeline[0]?.eventType, "bloodRingCreated");
  });

  it("rejects malformed required fields with useful errors", () => {
    const bad = { schemaVersion: 1, title: "x" };
    assert.throws(() => validateProject(bad), SchemaError);
    try {
      validateProject(bad);
      assert.fail("Expected validateProject to reject malformed input.");
    } catch (err: unknown) {
      assert.ok(err instanceof SchemaError);
      const paths = err.issues.map((i) => i.path);
      assert.ok(paths.includes("id"));
      assert.ok(paths.includes("entities"));
      assert.ok(paths.includes("settings"));
      assert.match(err.message, /id/);
    }
  });

  it("rejects duplicate ids and missing parents", () => {
    const demo = createDemoProject();
    const dup = structuredClone(demo);
    dup.entities.push({ ...dup.entities[1], id: dup.entities[0].id });
    assert.throws(() => validateProject(dup), /Duplicate entity id/);

    const orphan = structuredClone(demo);
    orphan.entities[2].parentId = "does-not-exist";
    assert.throws(() => validateProject(orphan), /does not exist/);
  });

  it("rejects unknown schema versions", () => {
    const demo = createDemoProject();
    assert.throws(
      () => validateProject({ ...demo, schemaVersion: 99 }),
      /Unsupported schemaVersion/,
    );
  });

  it("rejects invalid JSON", () => {
    assert.throws(() => parseProjectJson("{not json"), /not valid JSON/);
  });
});
