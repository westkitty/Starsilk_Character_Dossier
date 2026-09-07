import { createDemoProject } from "./demo.js";
import { CartographerEditor } from "./editor.js";

const mount = document.querySelector<HTMLElement>("#app");
if (!mount) throw new Error("Cartographer mount point not found.");

new CartographerEditor(mount, createDemoProject());
