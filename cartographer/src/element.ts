import { mountStarsilkStarmap, type StarmapHandle } from "./mount.ts";
import type { HistoricalTimeValue } from "./model/types.ts";

/**
 * Reusable viewer/editor custom element.
 *
 *   <starsilk-starmap mode="viewer" src="./data/starsilk-map.json"></starsilk-starmap>
 *
 * Attributes: mode, src, start-entity, start-era
 * Does not leak global CSS. Renderer does not own the host page.
 */
export class StarsilkStarmapElement extends HTMLElement {
  static get observedAttributes() {
    return ["mode", "src", "start-entity", "start-era"];
  }

  private handle: StarmapHandle | null = null;
  private mounted = false;

  connectedCallback() {
    this.style.display = "block";
    this.style.width = "100%";
    this.style.height = this.style.height || "100dvh";
    void this.remount();
  }

  disconnectedCallback() {
    this.handle?.destroy();
    this.handle = null;
    this.mounted = false;
  }

  attributeChangedCallback() {
    if (this.isConnected && this.mounted) void this.remount();
  }

  private async remount() {
    this.handle?.destroy();
    this.handle = null;
    const mode = (this.getAttribute("mode") === "viewer" ? "viewer" : "editor") as "viewer" | "editor";
    const src = this.getAttribute("src") ?? undefined;
    const startEntityId = this.getAttribute("start-entity") ?? undefined;
    const eraRaw = this.getAttribute("start-era");
    let startEra: HistoricalTimeValue | undefined;
    if (eraRaw) {
      const n = Number(eraRaw);
      startEra = Number.isFinite(n) ? n : (eraRaw as HistoricalTimeValue);
    }
    this.handle = await mountStarsilkStarmap(this, {
      mode,
      src,
      startEntityId,
      startEra,
      disableAuthoring: mode === "viewer",
    });
    this.mounted = true;
  }
}

export function defineStarsilkStarmap(): void {
  if (!customElements.get("starsilk-starmap")) {
    customElements.define("starsilk-starmap", StarsilkStarmapElement);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "starsilk-starmap": StarsilkStarmapElement;
  }
}
