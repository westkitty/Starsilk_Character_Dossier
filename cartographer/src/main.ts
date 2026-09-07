import { mountStarsilkStarmap } from "./mount.ts";

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app");

void mountStarsilkStarmap(root, { mode: "editor" });
