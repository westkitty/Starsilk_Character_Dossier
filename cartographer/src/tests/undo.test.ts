import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EditorStore } from "../store/editor-store.ts";

describe("undo/redo", () => {
  it("restores a rename through a full undo/redo cycle", () => {
    const store = new EditorStore({ mode: "editor" });
    store.select("pl-fallenstar-prime");
    const original = store.selected()?.name;
    store.renameSelected("Prime Restyled");
    assert.equal(store.selected()?.name, "Prime Restyled");
    store.undo();
    assert.equal(store.state.project.entities.find((e) => e.id === "pl-fallenstar-prime")?.name, original);
    store.redo();
    assert.equal(store.state.project.entities.find((e) => e.id === "pl-fallenstar-prime")?.name, "Prime Restyled");
  });
});
