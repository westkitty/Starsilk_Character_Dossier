import { createProject } from "./core.js";

const mount = document.querySelector<HTMLElement>("#app");
if (!mount) throw new Error("Cartographer mount point not found.");

const project = createProject("STARSiLK Temporal Cartographer");
mount.innerHTML = `
  <section class="foundation-shell" aria-labelledby="cartographer-title">
    <p class="eyebrow">ADMINISTRATION CARTOGRAPHIC ARCHIVE // ISOLATED SUBSYSTEM</p>
    <h1 id="cartographer-title">STARSiLK TEMPORAL CARTOGRAPHER</h1>
    <p>Foundation loaded. Authored project <code>${project.id}</code> uses schema version ${project.schemaVersion}.</p>
  </section>
`;
