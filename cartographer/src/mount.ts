import type { MountOptions, StarMapProject } from "./model/types.ts";
import { EditorStore } from "./store/editor-store.ts";
import { mountEditor, type ShellHandle } from "./ui/shell.ts";
import { mountAnalystPanel, type AnalystPanelHandle } from "./ui/analyst-panel.ts";
import { parseProjectJson } from "./persist/import-export.ts";
import { loadAutosave, saveAutosave } from "./persist/indexeddb.ts";

export interface StarmapHandle {
  destroy(): void;
  store: EditorStore;
}

async function resolveSource(src: MountOptions["src"]): Promise<StarMapProject | undefined> {
  if (!src) return undefined;
  if (typeof src !== "string") return src;
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Could not load map JSON from ${src}`);
  return parseProjectJson(await res.text());
}

/**
 * Mount the Temporal Cartographer into any container.
 * Framework-neutral. Does not assume ownership of document.body styles.
 */
export async function mountStarsilkStarmap(
  container: HTMLElement,
  options: MountOptions = {},
): Promise<StarmapHandle> {
  const store = new EditorStore(options);
  if (typeof indexedDB !== "undefined" && options.mode !== "viewer") {
    store.setPersister((json) => saveAutosave(json));
    if (!options.src) {
      try {
        const raw = await loadAutosave();
        if (raw) store.replaceFromAutosave(parseProjectJson(raw));
      } catch {
        /* keep demo */
      }
    }
  }
  const loaded = await resolveSource(options.src);
  if (loaded) store.loadProject(loaded, false);
  if (options.startEntityId) {
    const e = store.state.project.entities.find((x) => x.id === options.startEntityId);
    if (e) store.drillInto(e);
  }

  const host = document.createElement("starsilk-starmap-host");
  host.style.display = "block";
  host.style.width = "100%";
  host.style.height = "100%";
  host.style.minHeight = "100dvh";
  container.appendChild(host);
  const shell: ShellHandle = mountEditor(host, store);

  // mountEditor owns an open Shadow DOM. Analyst Mode must live inside that
  // same boundary; appending it to the host light DOM would leave it invisible
  // because the editor shadow tree intentionally exposes no <slot>.
  let analystMount: HTMLDivElement | null = null;
  let analyst: AnalystPanelHandle | null = null;
  if (store.state.mode === "editor") {
    analystMount = document.createElement("div");
    analystMount.style.display = "contents";
    analystMount.setAttribute("data-cartographer-analyst-host", "");
    (host.shadowRoot ?? host).append(analystMount);
    analyst = mountAnalystPanel(analystMount, store);
  }

  return {
    store,
    destroy() {
      analyst?.destroy();
      analystMount?.remove();
      shell.destroy();
      host.remove();
    },
  };
}

export { EditorStore } from "./store/editor-store.ts";
export { createDemoProject } from "./model/demo-project.ts";
export { parseProjectJson, serializeProject } from "./persist/import-export.ts";
export type { MountOptions, StarMapProject } from "./model/types.ts";
