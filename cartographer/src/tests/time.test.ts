import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDemoProject } from "../model/demo-project.ts";
import { clearOverride, resolveHistoricalTime, setGalaxyTime, setOverride } from "../model/resolve-time.ts";
import { resolveHistoricalView } from "../model/resolve-state.ts";

describe("hierarchical historical time", () => {
  it("propagates galaxy time through inheriting descendants", () => {
    let project = createDemoProject();
    project = setGalaxyTime(project, 121);
    const planet = resolveHistoricalTime(project, "pl-ruby");
    const moon = resolveHistoricalTime(project, "moon-pharos-ii-a");
    assert.equal(planet.mode, "inherit");
    assert.equal(planet.value, 121);
    assert.equal(moon.value, 121);
  });

  it("sector override stops inheritance and applies to children, isolating siblings", () => {
    let project = createDemoProject();
    project = setGalaxyTime(project, 121);
    project = setOverride(project, "sec-fallenstar", 0);
    const fallenstarPlanet = resolveHistoricalTime(project, "pl-fallenstar-prime");
    const ring = resolveHistoricalTime(project, "ring-fallenstar");
    const pharos = resolveHistoricalTime(project, "pl-ruby");
    const aureal = resolveHistoricalTime(project, "star-aureal");
    assert.equal(fallenstarPlanet.value, 0);
    assert.equal(fallenstarPlanet.mode, "inherit");
    assert.equal(ring.value, 0);
    assert.equal(pharos.value, 121);
    assert.equal(aureal.value, 121);
  });

  it("system override isolates other systems", () => {
    let project = createDemoProject();
    project = setGalaxyTime(project, "main-narrative");
    project = setOverride(project, "sys-aureal", 121);
    assert.equal(resolveHistoricalTime(project, "star-aureal").value, 121);
    assert.equal(resolveHistoricalTime(project, "pl-fallenstar-prime").value, "main-narrative");
  });

  it("object override changes only that object", () => {
    let project = createDemoProject();
    project = setGalaxyTime(project, 170);
    project = setOverride(project, "pl-fallenstar-prime", 0);
    assert.equal(resolveHistoricalTime(project, "pl-fallenstar-prime").value, 0);
    assert.equal(resolveHistoricalTime(project, "pl-fallenstar-prime").mode, "override");
    assert.equal(resolveHistoricalTime(project, "pl-fallenstar-minor").value, 170);
    assert.equal(resolveHistoricalTime(project, "star-fallenstar").value, 170);
    assert.equal(resolveHistoricalTime(project, "ring-fallenstar").value, 0);
    assert.equal(resolveHistoricalTime(project, "ring-fallenstar").mode, "inherit");
  });

  it("return-to-parent immediately resolves against parent", () => {
    let project = createDemoProject();
    project = setGalaxyTime(project, 121);
    project = setOverride(project, "sec-fallenstar", 0);
    project = clearOverride(project, "sec-fallenstar");
    const r = resolveHistoricalTime(project, "pl-fallenstar-prime");
    assert.equal(r.mode, "inherit");
    assert.equal(r.value, 121);
  });
});

describe("historical state resolution", () => {
  it("hides the Blood Ring before Year 3 and shows it after", () => {
    const project = createDemoProject();
    const ring = project.entities.find((e) => e.id === "ring-fallenstar")!;
    const before = resolveHistoricalView(project, ring, 0);
    const at = resolveHistoricalView(project, ring, 3);
    const after = resolveHistoricalView(project, ring, 121);
    assert.equal(before.present, false);
    assert.equal(at.present, true);
    assert.equal(after.present, true);
    const planet = project.entities.find((e) => e.id === "pl-fallenstar-prime")!;
    assert.equal(resolveHistoricalView(project, planet, 0).present, true);
    assert.equal(resolveHistoricalView(project, planet, 3).present, true);
  });

  it("collapses a star into a black hole and destroys the system", () => {
    const project = createDemoProject();
    const star = project.entities.find((e) => e.id === "star-aureal")!;
    const system = project.entities.find((e) => e.id === "sys-aureal")!;
    const planet = project.entities.find((e) => e.id === "pl-aureal-i")!;
    const beforeStar = resolveHistoricalView(project, star, 121);
    const afterStar = resolveHistoricalView(project, star, 170);
    assert.equal(beforeStar.type, "star");
    assert.equal(beforeStar.collapsed, false);
    assert.equal(afterStar.type, "blackHole");
    assert.equal(afterStar.collapsed, true);
    const beforeSys = resolveHistoricalView(project, system, 121);
    const afterSys = resolveHistoricalView(project, system, 170);
    assert.equal(beforeSys.destroyed, false);
    assert.equal(afterSys.destroyed, true);
    assert.equal(afterSys.collapsed, true);
    assert.equal(resolveHistoricalView(project, planet, 121).present, true);
    assert.equal(resolveHistoricalView(project, planet, 170).present, false);
  });

  it("shows the Siege Wall only after formation", () => {
    const project = createDemoProject();
    const wall = project.entities.find((e) => e.id === "lss-siege-wall")!;
    assert.equal(resolveHistoricalView(project, wall, 170).present, false);
    assert.equal(resolveHistoricalView(project, wall, "post-siege-wall").present, true);
    assert.equal(resolveHistoricalView(project, wall, "main-narrative").present, true);
  });
});
