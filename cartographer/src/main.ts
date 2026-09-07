import { createDemoProject } from "./demo.js";
import { CartographerEditor } from "./editor.js";
import { loadAutosave } from "./persistence.js";
import { registerStarsilkStarmap } from "./viewer.js";

registerStarsilkStarmap();

const mount = document.querySelector<HTMLElement>("#app");
if (!mount) throw new Error("Cartographer mount point not found.");

let project = createDemoProject();
try {
  project = (await loadAutosave()) ?? project;
} catch (error) {
  console.warn("STARSiLK Temporal Cartographer autosave could not be restored; loading demonstration project.", error);
}

new CartographerEditor(mount, project);
