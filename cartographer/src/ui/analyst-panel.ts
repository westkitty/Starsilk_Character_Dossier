import type { EditorStore } from "../store/editor-store.ts";
import type { HistoricalTimeValue, TruthField, TruthStatus } from "../model/types.ts";
import { formatHistoricalTime } from "../model/time.ts";
import { clearOverride } from "../model/resolve-time.ts";
import {
  ANALYST_QUERY_DEFINITIONS,
  diffHistoricalState,
  findKnowledgeGaps,
  isCompositeTemporalView,
  listTemporalOverrides,
  runAnalystQuery,
  traceHistoricalState,
  truthFields,
  truthProfileForEntity,
  type AnalystQueryId,
} from "../model/analyst.ts";

export interface AnalystPanelHandle {
  destroy(): void;
}

type AnalystMode = "palimpsest" | "trace" | "delta" | "truth" | "gaps" | "query";

const MODES: Array<{ id: AnalystMode; label: string }> = [
  { id: "palimpsest", label: "PALIMPSEST" },
  { id: "trace", label: "TRACE" },
  { id: "delta", label: "DELTA" },
  { id: "truth", label: "TRUTH" },
  { id: "gaps", label: "GAPS" },
  { id: "query", label: "QUERY" },
];

const TRUTH_STATUSES: TruthStatus[] = [
  "locked",
  "working",
  "provisional",
  "schematic",
  "unknown",
  "editorial",
];

const CSS = `
.tc-analyst-toggle,.tc-analyst-panel{font-family:Inter,ui-sans-serif,system-ui,sans-serif}
.tc-analyst-toggle{position:fixed;right:14px;bottom:14px;z-index:1200;min-height:44px;padding:0 16px;border:1px solid #55dfff;background:#07111c;color:#a6efff;font:800 12px ui-monospace,SFMono-Regular,monospace;letter-spacing:.12em;box-shadow:0 8px 30px rgba(0,0,0,.38);cursor:pointer}
.tc-analyst-toggle[aria-expanded="true"]{background:#102337;color:#fff}
.tc-analyst-panel{position:fixed;right:14px;bottom:68px;z-index:1199;width:min(500px,calc(100vw - 28px));max-height:min(74vh,780px);display:grid;grid-template-rows:auto auto minmax(0,1fr);border:1px solid #334b64;background:rgba(5,10,17,.98);color:#c9d5df;box-shadow:0 24px 70px rgba(0,0,0,.6)}
.tc-analyst-panel[hidden]{display:none}
.tc-analyst-head{display:flex;align-items:center;gap:10px;padding:11px 12px;border-bottom:1px solid #27374b;background:#0c1624}
.tc-analyst-head strong{color:#a6efff;font:800 12px ui-monospace,SFMono-Regular,monospace;letter-spacing:.09em}
.tc-analyst-head span{margin-right:auto;color:#d9a24b;font:700 10px ui-monospace,SFMono-Regular,monospace;letter-spacing:.06em}
.tc-analyst-close,.tc-analyst-tab,.tc-analyst-btn,.tc-analyst-result{border:1px solid #334b64;background:#0d1724;color:#c9d5df;cursor:pointer}
.tc-analyst-close{width:38px;height:38px;font-size:20px}
.tc-analyst-tabs{display:flex;gap:4px;padding:8px;overflow-x:auto;border-bottom:1px solid #27374b;background:#08111c}
.tc-analyst-tab{flex:0 0 auto;min-height:36px;padding:0 9px;font:800 10px ui-monospace,SFMono-Regular,monospace;letter-spacing:.05em}
.tc-analyst-tab[aria-selected="true"]{border-color:#55dfff;color:#a6efff;background:#102337}
.tc-analyst-body{overflow:auto;padding:12px;overscroll-behavior:contain}
.tc-analyst-title{margin:0 0 4px;color:#f1f5f8;font-size:18px;line-height:1.2}
.tc-analyst-kicker{margin:0 0 12px;color:#8fa8b8;font:700 10px ui-monospace,SFMono-Regular,monospace;letter-spacing:.08em;text-transform:uppercase}
.tc-analyst-card{padding:10px;margin:0 0 8px;border:1px solid #27374b;background:#0a131f}
.tc-analyst-row{display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap}
.tc-analyst-row>strong{margin-right:auto;color:#dbe7ef}
.tc-analyst-meta{color:#8fa8b8;font-size:12px;line-height:1.5}
.tc-analyst-badge{display:inline-flex;align-items:center;min-height:24px;padding:0 7px;border:1px solid #405773;color:#a6efff;background:#101c2b;font:800 10px ui-monospace,SFMono-Regular,monospace;letter-spacing:.04em}
.tc-analyst-badge.warn{border-color:#8a6330;color:#f0c472}.tc-analyst-badge.danger{border-color:#7d3340;color:#ef9aa8}.tc-analyst-badge.good{border-color:#386b55;color:#8bd4aa}
.tc-analyst-btn{min-height:34px;padding:0 9px;font-size:12px}.tc-analyst-btn:hover,.tc-analyst-result:hover{border-color:#55dfff;color:#fff}
.tc-analyst-chain{margin:8px 0 0;padding:0;list-style:none}.tc-analyst-chain li{padding:6px 0;border-top:1px solid #1d2b3b;color:#a9bac6;font-size:12px}
.tc-analyst-result{display:block;width:100%;padding:9px;text-align:left;margin:6px 0}.tc-analyst-result strong{display:block;color:#dbe7ef}.tc-analyst-result span{display:block;margin-top:3px;color:#8fa8b8;font-size:11px;line-height:1.35}
.tc-analyst-controls{display:grid;grid-template-columns:1fr 1fr auto;gap:7px;margin:8px 0 12px}.tc-analyst-controls select,.tc-analyst-field select,.tc-analyst-field input{width:100%;min-height:36px;border:1px solid #334b64;background:#08111c;color:#dbe7ef;padding:6px}
.tc-analyst-truth{display:grid;grid-template-columns:minmax(76px,.55fr) minmax(110px,.75fr) minmax(150px,1.5fr);gap:6px;align-items:start;padding:8px 0;border-top:1px solid #1d2b3b}.tc-analyst-truth>strong{padding-top:8px;color:#a6efff;font:800 10px ui-monospace,SFMono-Regular,monospace;text-transform:uppercase}
.tc-analyst-field{display:grid;gap:5px}.tc-analyst-field input{font-size:11px}
.tc-analyst-empty{padding:20px 8px;color:#8fa8b8;text-align:center;border:1px dashed #334b64}
.tc-analyst-counts{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}
@media(max-width:700px){.tc-analyst-toggle{right:8px;bottom:8px}.tc-analyst-panel{right:8px;bottom:60px;width:calc(100vw - 16px);max-height:72dvh}.tc-analyst-tab,.tc-analyst-btn,.tc-analyst-result,.tc-analyst-controls select,.tc-analyst-field select,.tc-analyst-field input{min-height:44px}.tc-analyst-truth{grid-template-columns:72px 1fr}.tc-analyst-truth .tc-analyst-field{grid-column:2}.tc-analyst-controls{grid-template-columns:1fr 1fr}.tc-analyst-controls .tc-analyst-btn{grid-column:1/-1}}
@media(prefers-reduced-motion:reduce){.tc-analyst-panel,.tc-analyst-toggle{scroll-behavior:auto}}
`;

function el(tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text: string, className = "tc-analyst-btn"): HTMLButtonElement {
  const node = document.createElement("button");
  node.type = "button";
  node.className = className;
  node.textContent = text;
  return node;
}

function badge(text: string, tone: "" | "warn" | "danger" | "good" = ""): HTMLElement {
  return el("span", `tc-analyst-badge${tone ? ` ${tone}` : ""}`, text);
}

function encodeTime(value: HistoricalTimeValue): string {
  return typeof value === "number" ? `n:${value}` : `s:${value}`;
}

function decodeTime(value: string): HistoricalTimeValue {
  if (value.startsWith("n:")) return Number(value.slice(2));
  return value.slice(2) as HistoricalTimeValue;
}

function stateBadge(present: boolean, destroyed: boolean, collapsed: boolean): HTMLElement {
  if (collapsed) return badge("COLLAPSED", "danger");
  if (destroyed) return badge("HISTORICALLY DESTROYED", "danger");
  return present ? badge("PRESENT", "good") : badge("ABSENT", "warn");
}

export function mountAnalystPanel(host: HTMLElement, store: EditorStore): AnalystPanelHandle {
  const style = document.createElement("style");
  style.textContent = CSS;
  const toggle = button("ANALYST", "tc-analyst-toggle");
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "tc-analyst-panel");

  const panel = el("section", "tc-analyst-panel");
  panel.id = "tc-analyst-panel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  panel.setAttribute("aria-label", "STARSiLK Analyst Mode");

  const head = el("header", "tc-analyst-head");
  head.append(
    el("strong", undefined, "ANALYST MODE"),
    el("span", undefined, "NON-DIEGETIC · CARTOGRAPHIC ANALYSIS"),
  );
  const close = button("×", "tc-analyst-close");
  close.setAttribute("aria-label", "Close Analyst Mode");
  head.append(close);

  const tabs = el("nav", "tc-analyst-tabs");
  tabs.setAttribute("role", "tablist");
  const body = el("div", "tc-analyst-body");
  body.setAttribute("aria-live", "polite");
  panel.append(head, tabs, body);
  host.append(style, toggle, panel);

  let open = false;
  let mode: AnalystMode = "trace";
  let deltaFrom: HistoricalTimeValue = 3;
  let deltaTo: HistoricalTimeValue = 170;
  let query: AnalystQueryId = "changed-between";

  const focusEntity = (id: string) => {
    const entity = store.state.project.entities.find((candidate) => candidate.id === id);
    if (entity) store.drillInto(entity);
  };

  const renderTabs = () => {
    tabs.replaceChildren();
    for (const item of MODES) {
      const tab = button(item.label, "tc-analyst-tab");
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", item.id === mode ? "true" : "false");
      tab.addEventListener("click", () => {
        mode = item.id;
        render();
      });
      tabs.append(tab);
    }
  };

  const title = (name: string, kicker: string) => {
    body.append(el("h2", "tc-analyst-title", name), el("p", "tc-analyst-kicker", kicker));
  };

  const eraSelect = (value: HistoricalTimeValue): HTMLSelectElement => {
    const select = document.createElement("select");
    const seen = new Set<string>();
    for (const preset of store.state.project.eraPresets) {
      if (preset.id === "custom") continue;
      const encoded = encodeTime(preset.value);
      if (seen.has(encoded)) continue;
      seen.add(encoded);
      const option = document.createElement("option");
      option.value = encoded;
      option.textContent = preset.label;
      option.selected = encoded === encodeTime(value);
      select.append(option);
    }
    if (!seen.has(encodeTime(value))) {
      const option = document.createElement("option");
      option.value = encodeTime(value);
      option.textContent = formatHistoricalTime(value);
      option.selected = true;
      select.append(option);
    }
    return select;
  };

  const renderPalimpsest = () => {
    title("Palimpsest", "Different scopes may deliberately inhabit different eras");
    const composite = isCompositeTemporalView(store.state.project);
    const summary = el("div", "tc-analyst-card");
    summary.append(
      composite
        ? badge("COMPOSITE TEMPORAL VIEW", "warn")
        : badge("SINGLE TEMPORAL AUTHORITY", "good"),
      el(
        "p",
        "tc-analyst-meta",
        composite
          ? "This view never claims the displayed eras coexisted. Local pins are analytical breakpoints."
          : "No divergent local historical pin is currently active.",
      ),
    );
    body.append(summary);

    for (const record of listTemporalOverrides(store.state.project)) {
      const card = el("div", "tc-analyst-card");
      const row = el("div", "tc-analyst-row");
      row.append(
        el("strong", undefined, record.entityName),
        badge(record.source === "galaxy-setting" ? "GALAXY" : "PINNED", record.divergent ? "warn" : ""),
      );
      card.append(
        row,
        el("p", "tc-analyst-meta", `${record.scope.toUpperCase()} · ${formatHistoricalTime(record.value)}${record.parentValue === null ? "" : ` · parent ${formatHistoricalTime(record.parentValue)}`}`),
      );
      const actions = el("div", "tc-analyst-row");
      const focus = button("Focus");
      focus.addEventListener("click", () => focusEntity(record.entityId));
      actions.append(focus);
      if (record.source === "entity-override") {
        const clear = button("Return to parent time");
        clear.addEventListener("click", () => store.commit((project) => clearOverride(project, record.entityId)));
        actions.append(clear);
      }
      card.append(actions);
      body.append(card);
    }
  };

  const renderTrace = () => {
    const entity = store.selected();
    title("Trace / Why?", "Explain the selected object's resolved historical reality");
    if (!entity) {
      body.append(el("div", "tc-analyst-empty", "Select an entity to trace."));
      return;
    }
    const trace = traceHistoricalState(store.state.project, entity.id);
    const state = el("div", "tc-analyst-card");
    const stateRow = el("div", "tc-analyst-row");
    stateRow.append(el("strong", undefined, trace.view.name), stateBadge(trace.view.present, trace.view.destroyed, trace.view.collapsed));
    if (trace.view.type !== entity.type) stateRow.append(badge(`${entity.type} → ${trace.view.type}`, "danger"));
    state.append(stateRow);
    for (const line of trace.summary) state.append(el("p", "tc-analyst-meta", line));
    body.append(state);

    const authority = el("div", "tc-analyst-card");
    authority.append(
      el("strong", undefined, "TEMPORAL AUTHORITY"),
      el("p", "tc-analyst-meta", `${formatHistoricalTime(trace.time.value)} · ${trace.time.authorityName} · inheritance depth ${trace.time.inheritanceDepth}`),
    );
    const chain = el("ol", "tc-analyst-chain");
    for (const step of trace.time.chain) {
      chain.append(el("li", undefined, `${step.isAuthority ? "● " : "○ "}${step.name} · ${step.timeMode}${step.overrideValue === undefined ? "" : ` · ${formatHistoricalTime(step.overrideValue)}`}`));
    }
    authority.append(chain);
    body.append(authority);

    const events = el("div", "tc-analyst-card");
    events.append(el("strong", undefined, "INFLUENCING EVENTS"));
    if (!trace.influencingEvents.length) {
      events.append(el("p", "tc-analyst-meta", "No active historical event is required to explain the current state."));
    } else {
      for (const item of trace.influencingEvents) {
        events.append(
          el("p", "tc-analyst-meta", `${item.relationship === "system-collapse" ? "↳ SYSTEM CAUSE · " : "↳ "}${formatHistoricalTime(item.event.time)} · ${item.entityName} · ${item.event.label} · ${item.event.canonStatus.toUpperCase()}`),
        );
      }
    }
    body.append(events);
  };

  const renderDelta = () => {
    const entity = store.selected();
    title("Temporal Delta", "Compare one entity's resolved state across two eras");
    const controls = el("div", "tc-analyst-controls");
    const from = eraSelect(deltaFrom);
    const to = eraSelect(deltaTo);
    from.setAttribute("aria-label", "Delta from era");
    to.setAttribute("aria-label", "Delta to era");
    from.addEventListener("change", () => { deltaFrom = decodeTime(from.value); render(); });
    to.addEventListener("change", () => { deltaTo = decodeTime(to.value); render(); });
    const swap = button("Swap");
    swap.addEventListener("click", () => { [deltaFrom, deltaTo] = [deltaTo, deltaFrom]; render(); });
    controls.append(from, to, swap);
    body.append(controls);
    if (!entity) {
      body.append(el("div", "tc-analyst-empty", "Select an entity to compare."));
      return;
    }
    const delta = diffHistoricalState(store.state.project, entity.id, deltaFrom, deltaTo);
    const summary = el("div", "tc-analyst-card");
    const row = el("div", "tc-analyst-row");
    row.append(el("strong", undefined, entity.name), badge(`${formatHistoricalTime(deltaFrom)} → ${formatHistoricalTime(deltaTo)}`));
    summary.append(row);
    const states = el("div", "tc-analyst-row");
    states.append(
      badge(`A · ${delta.before.type} · ${delta.before.present ? "present" : "absent"}`, delta.before.destroyed ? "danger" : ""),
      badge(`B · ${delta.after.type} · ${delta.after.present ? "present" : "absent"}`, delta.after.destroyed ? "danger" : ""),
    );
    summary.append(states);
    body.append(summary);
    if (!delta.changes.length) {
      body.append(el("div", "tc-analyst-empty", "No resolved state difference across these eras."));
      return;
    }
    for (const change of delta.changes) {
      const card = el("div", "tc-analyst-card");
      card.append(badge(change.kind, change.kind === "DESTROYED" || change.kind === "COLLAPSE" ? "danger" : change.kind === "CREATED" ? "good" : ""), el("p", "tc-analyst-meta", change.label));
      body.append(card);
    }
  };

  const writeTruthField = (field: TruthField, status: TruthStatus, sourceNote: string, sourceHref: string) => {
    store.updateSelected((entity) => ({
      ...entity,
      meta: {
        ...entity.meta,
        truth: {
          ...(entity.meta.truth ?? {}),
          [field]: {
            status,
            ...(sourceNote.trim() ? { sourceNote: sourceNote.trim() } : {}),
            ...(sourceHref.trim() ? { sourceHref: sourceHref.trim() } : {}),
          },
        },
      },
    }));
  };

  const renderTruth = () => {
    const entity = store.selected();
    title("Truth Lattice", "Canon confidence belongs to facts, not merely objects");
    if (!entity) {
      body.append(el("div", "tc-analyst-empty", "Select an entity to inspect its truth profile."));
      return;
    }
    body.append(el("p", "tc-analyst-meta", `${entity.name} · entity fallback ${entity.meta.canonStatus.toUpperCase()}. Explicit field classifications override the fallback.`));
    const profile = truthProfileForEntity(entity);
    for (const field of truthFields()) {
      const state = profile[field]!;
      const explicit = entity.meta.truth?.[field];
      const row = el("div", "tc-analyst-truth");
      row.append(el("strong", undefined, field));
      const select = document.createElement("select");
      select.setAttribute("aria-label", `${field} truth status`);
      for (const status of TRUTH_STATUSES) {
        const option = document.createElement("option");
        option.value = status;
        option.textContent = status.toUpperCase();
        option.selected = status === state.status;
        select.append(option);
      }
      const statusWrap = el("div", "tc-analyst-field");
      statusWrap.append(select, el("span", "tc-analyst-meta", explicit ? "explicit" : "derived fallback"));
      const sourceWrap = el("div", "tc-analyst-field");
      const note = document.createElement("input");
      note.placeholder = state.sourceNote ? `Inherited: ${state.sourceNote}` : "Field source note";
      note.value = explicit?.sourceNote ?? "";
      note.setAttribute("aria-label", `${field} source note`);
      const href = document.createElement("input");
      href.placeholder = state.sourceHref ? `Inherited URL: ${state.sourceHref}` : "Field source URL";
      href.value = explicit?.sourceHref ?? "";
      href.setAttribute("aria-label", `${field} source URL`);
      sourceWrap.append(note, href);
      const save = () => writeTruthField(field, select.value as TruthStatus, note.value, href.value);
      select.addEventListener("change", save);
      note.addEventListener("change", save);
      href.addEventListener("change", save);
      row.append(statusWrap, sourceWrap);
      body.append(row);
    }
  };

  const renderGaps = () => {
    title("Knowledge Gaps", "Unknown and schematic information are first-class data");
    const gaps = findKnowledgeGaps(store.state.project);
    const counts = el("div", "tc-analyst-counts");
    const count = (status: string) => gaps.filter((gap) => gap.status === status).length;
    counts.append(
      badge(`${count("unknown")} UNKNOWN`, "warn"),
      badge(`${count("schematic")} SCHEMATIC`),
      badge(`${count("source-missing")} UNSOURCED`, "danger"),
    );
    body.append(counts);
    if (!gaps.length) {
      body.append(el("div", "tc-analyst-empty", "No knowledge gaps detected by the current rules."));
      return;
    }
    for (const gap of gaps.slice(0, 80)) {
      const result = button("", "tc-analyst-result");
      const strong = el("strong", undefined, `${gap.entityName} · ${gap.field.toUpperCase()}`);
      const detail = el("span", undefined, `${gap.status.toUpperCase()} · ${gap.message}`);
      result.append(strong, detail);
      result.addEventListener("click", () => focusEntity(gap.entityId));
      body.append(result);
    }
    if (gaps.length > 80) body.append(el("p", "tc-analyst-meta", `${gaps.length - 80} additional gaps omitted from this compact view.`));
  };

  const renderQuery = () => {
    title("Canon Query", "Interrogate the structured archive without querying rendered Three.js state");
    const controls = el("div", "tc-analyst-card");
    const select = document.createElement("select");
    select.style.width = "100%";
    select.style.minHeight = "44px";
    select.style.background = "#08111c";
    select.style.color = "#dbe7ef";
    select.style.border = "1px solid #334b64";
    for (const definition of ANALYST_QUERY_DEFINITIONS) {
      const option = document.createElement("option");
      option.value = definition.id;
      option.textContent = definition.label;
      option.selected = definition.id === query;
      select.append(option);
    }
    select.addEventListener("change", () => { query = select.value as AnalystQueryId; render(); });
    const definition = ANALYST_QUERY_DEFINITIONS.find((candidate) => candidate.id === query)!;
    controls.append(select, el("p", "tc-analyst-meta", definition.description));
    if (query === "changed-between") controls.append(el("p", "tc-analyst-meta", `Comparison window: ${formatHistoricalTime(deltaFrom)} → ${formatHistoricalTime(deltaTo)}. Change it in DELTA.`));
    body.append(controls);
    const results = runAnalystQuery(store.state.project, query, { from: deltaFrom, to: deltaTo });
    body.append(badge(`${results.length} RESULT${results.length === 1 ? "" : "S"}`, results.length ? "good" : ""));
    if (!results.length) {
      body.append(el("div", "tc-analyst-empty", "No entities match this query."));
      return;
    }
    for (const item of results.slice(0, 100)) {
      const result = button("", "tc-analyst-result");
      result.append(el("strong", undefined, item.entityName), el("span", undefined, item.reason));
      result.addEventListener("click", () => focusEntity(item.entityId));
      body.append(result);
    }
  };

  const renderBody = () => {
    body.replaceChildren();
    switch (mode) {
      case "palimpsest": renderPalimpsest(); break;
      case "trace": renderTrace(); break;
      case "delta": renderDelta(); break;
      case "truth": renderTruth(); break;
      case "gaps": renderGaps(); break;
      case "query": renderQuery(); break;
    }
  };

  const render = () => {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (!open) return;
    renderTabs();
    renderBody();
  };

  toggle.addEventListener("click", () => { open = !open; render(); });
  close.addEventListener("click", () => { open = false; render(); toggle.focus(); });
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape" && open) {
      open = false;
      render();
    }
  };
  document.addEventListener("keydown", onKey);
  const unsubscribe = store.subscribe(() => { if (open) renderBody(); });
  render();

  return {
    destroy() {
      unsubscribe();
      document.removeEventListener("keydown", onKey);
      panel.remove();
      toggle.remove();
      style.remove();
    },
  };
}
