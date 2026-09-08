import type {
  Entity,
  HistoricalTimeValue,
  HistoricalView,
  StarMapProject,
  TimelineEvent,
  TruthField,
  TruthFieldState,
  TruthProfile,
  TruthStatus,
} from "./types.ts";
import { compareTime, formatHistoricalTime } from "./time.ts";
import { resolveHistoricalTime } from "./resolve-time.ts";
import { eventsAtOrBefore, resolveHistoricalView } from "./resolve-state.ts";
import { ancestorsOf, childrenOf, entityMap } from "./validate.ts";

export interface TimeTraceStep {
  id: string;
  name: string;
  type: Entity["type"];
  timeMode: "inherit" | "override" | "galaxy-setting";
  overrideValue?: HistoricalTimeValue;
  isAuthority: boolean;
}

export interface HistoricalTimeTrace {
  selectedId: string;
  value: HistoricalTimeValue;
  scope: "galaxy" | "starfield" | "system" | "object";
  mode: "inherit" | "override";
  immediateParentId: string | null;
  authorityId: string | null;
  authorityName: string;
  authorityKind: "entity-override" | "galaxy-setting";
  inheritanceDepth: number;
  chain: TimeTraceStep[];
}

export interface TemporalOverrideRecord {
  entityId: string;
  entityName: string;
  scope: "galaxy" | "starfield" | "system" | "object";
  value: HistoricalTimeValue;
  parentValue: HistoricalTimeValue | null;
  divergent: boolean;
  source: "galaxy-setting" | "entity-override";
}

export interface InfluencingEvent {
  entityId: string;
  entityName: string;
  event: TimelineEvent;
  relationship: "direct" | "system-collapse";
}

export interface HistoricalStateTrace {
  entity: Entity;
  time: HistoricalTimeTrace;
  view: HistoricalView;
  influencingEvents: InfluencingEvent[];
  truth: TruthProfile;
  summary: string[];
}

export type DeltaKind =
  | "CREATED"
  | "DESTROYED"
  | "TRANSFORMED"
  | "RENAMED"
  | "COLLAPSE"
  | "VISUAL"
  | "ORBIT"
  | "ANNOTATION";

export interface DeltaChange {
  kind: DeltaKind;
  label: string;
  before?: unknown;
  after?: unknown;
}

export interface HistoricalDelta {
  entityId: string;
  entityName: string;
  from: HistoricalTimeValue;
  to: HistoricalTimeValue;
  before: HistoricalView;
  after: HistoricalView;
  changes: DeltaChange[];
}

export interface KnowledgeGap {
  entityId: string;
  entityName: string;
  field: TruthField | "source";
  status: "unknown" | "schematic" | "editorial" | "source-missing";
  message: string;
}

export type AnalystQueryId =
  | "locked-schematic-position"
  | "unknown-position"
  | "collapse-affected"
  | "changed-between"
  | "unsourced-canon"
  | "active-overrides";

export interface AnalystQueryDefinition {
  id: AnalystQueryId;
  label: string;
  description: string;
}

export interface AnalystQueryResult {
  entityId: string;
  entityName: string;
  reason: string;
}

export const ANALYST_QUERY_DEFINITIONS: AnalystQueryDefinition[] = [
  {
    id: "locked-schematic-position",
    label: "Locked entities with schematic positions",
    description: "Canon identity exists, but its plotted location is explicitly non-canon.",
  },
  {
    id: "unknown-position",
    label: "Objects with unknown positions",
    description: "Known entities for which the archive currently asserts no map position.",
  },
  {
    id: "collapse-affected",
    label: "Affected by Starsilk extraction collapse",
    description: "Objects whose resolved main-narrative state is causally affected by a stellar extraction collapse.",
  },
  {
    id: "changed-between",
    label: "State differs between comparison eras",
    description: "Objects whose resolved historical state changes between the DELTA eras.",
  },
  {
    id: "unsourced-canon",
    label: "Canon assertions lacking source notes",
    description: "Locked, working, or provisional entities without a source note or source URL.",
  },
  {
    id: "active-overrides",
    label: "Local historical overrides",
    description: "Scopes deliberately pinned away from inherited historical time.",
  },
];

const TRUTH_FIELDS: TruthField[] = [
  "existence",
  "name",
  "position",
  "orbit",
  "visual",
  "timeline",
];

function sameTime(a: HistoricalTimeValue, b: HistoricalTimeValue): boolean {
  return compareTime(a, b) === 0;
}

function nearestSystem(project: StarMapProject, entity: Entity): Entity | undefined {
  if (entity.type === "system") return entity;
  return [entity, ...ancestorsOf(project, entity.id)].find((candidate) => candidate.type === "system");
}

function eventKey(entityId: string, event: TimelineEvent): string {
  return `${entityId}:${event.id}`;
}

export function resolveHistoricalTimeTrace(
  project: StarMapProject,
  entityId: string,
): HistoricalTimeTrace {
  const map = entityMap(project);
  const selected = map.get(entityId);
  if (!selected) throw new Error(`Unknown entity: ${entityId}`);
  const resolved = resolveHistoricalTime(project, entityId);
  const chainEntities: Entity[] = [selected, ...ancestorsOf(project, entityId)];
  const explicitAuthority = chainEntities.find(
    (candidate) => candidate.time?.mode === "override" && candidate.time.overrideValue !== undefined,
  );
  const galaxy = project.entities.find((candidate) => candidate.type === "galaxy" && candidate.parentId === null);
  const authority = explicitAuthority ?? galaxy;
  const authorityKind = explicitAuthority ? "entity-override" : "galaxy-setting";
  const authorityIndex = authority ? chainEntities.findIndex((candidate) => candidate.id === authority.id) : -1;
  const chain = chainEntities.map<TimeTraceStep>((candidate) => {
    const isAuthority = authority?.id === candidate.id;
    const hasOverride = candidate.time?.mode === "override" && candidate.time.overrideValue !== undefined;
    return {
      id: candidate.id,
      name: candidate.name,
      type: candidate.type,
      timeMode: isAuthority && authorityKind === "galaxy-setting"
        ? "galaxy-setting"
        : hasOverride
          ? "override"
          : "inherit",
      ...(hasOverride ? { overrideValue: candidate.time!.overrideValue } : {}),
      isAuthority,
    };
  });

  return {
    selectedId: selected.id,
    value: resolved.value,
    scope: resolved.scope,
    mode: resolved.mode,
    immediateParentId: selected.parentId,
    authorityId: authority?.id ?? null,
    authorityName: authority?.name ?? "GALAXY HISTORICAL TIME",
    authorityKind,
    inheritanceDepth: authorityIndex >= 0 ? authorityIndex : Math.max(0, chain.length - 1),
    chain,
  };
}

export function listTemporalOverrides(project: StarMapProject): TemporalOverrideRecord[] {
  const records: TemporalOverrideRecord[] = [];
  const galaxy = project.entities.find((entity) => entity.type === "galaxy" && entity.parentId === null);
  if (galaxy) {
    records.push({
      entityId: galaxy.id,
      entityName: galaxy.name,
      scope: "galaxy",
      value: project.settings.galaxyHistoricalTime,
      parentValue: null,
      divergent: false,
      source: "galaxy-setting",
    });
  }

  for (const entity of project.entities) {
    if (entity.time?.mode !== "override" || entity.time.overrideValue === undefined) continue;
    if (entity.id === galaxy?.id) continue;
    const parentValue = entity.parentId
      ? resolveHistoricalTime(project, entity.parentId).value
      : project.settings.galaxyHistoricalTime;
    records.push({
      entityId: entity.id,
      entityName: entity.name,
      scope: resolveHistoricalTime(project, entity.id).scope,
      value: entity.time.overrideValue,
      parentValue,
      divergent: !sameTime(entity.time.overrideValue, parentValue),
      source: "entity-override",
    });
  }
  return records;
}

export function isCompositeTemporalView(project: StarMapProject): boolean {
  return listTemporalOverrides(project).some((record) => record.source === "entity-override" && record.divergent);
}

function collectInfluencingEvents(
  project: StarMapProject,
  entity: Entity,
  asOf: HistoricalTimeValue,
): InfluencingEvent[] {
  const out: InfluencingEvent[] = [];
  const seen = new Set<string>();
  for (const event of eventsAtOrBefore(entity, asOf)) {
    const key = eventKey(entity.id, event);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ entityId: entity.id, entityName: entity.name, event, relationship: "direct" });
  }

  const system = nearestSystem(project, entity);
  if (system && system.id !== entity.id) {
    for (const star of childrenOf(project, system.id).filter(
      (candidate) => candidate.type === "star" || candidate.type === "blackHole",
    )) {
      for (const event of eventsAtOrBefore(star, asOf)) {
        if (event.eventType !== "starsilkExtractionCollapse") continue;
        const key = eventKey(star.id, event);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ entityId: star.id, entityName: star.name, event, relationship: "system-collapse" });
      }
    }
  }
  return out;
}

export function traceHistoricalState(
  project: StarMapProject,
  entityId: string,
  asOf?: HistoricalTimeValue,
): HistoricalStateTrace {
  const entity = entityMap(project).get(entityId);
  if (!entity) throw new Error(`Unknown entity: ${entityId}`);
  const time = resolveHistoricalTimeTrace(project, entityId);
  const effectiveTime = asOf ?? time.value;
  const view = resolveHistoricalView(project, entity, effectiveTime);
  const influencingEvents = collectInfluencingEvents(project, entity, effectiveTime);
  const summary: string[] = [
    `${view.present ? "PRESENT" : "ABSENT"} at ${formatHistoricalTime(effectiveTime)}.`,
    `Historical authority: ${time.authorityName} (${time.authorityKind === "entity-override" ? "local override" : "galaxy setting"}).`,
  ];
  if (view.type !== entity.type) summary.push(`Type resolves ${entity.type} → ${view.type}.`);
  if (view.destroyed) summary.push("Historically destroyed in this resolved state.");
  if (view.collapsed) summary.push("Stellar/system collapse is active in this resolved state.");
  if (influencingEvents.length) {
    summary.push(`${influencingEvents.length} active event${influencingEvents.length === 1 ? "" : "s"} contributes to this explanation.`);
  }
  return {
    entity,
    time: { ...time, value: effectiveTime },
    view,
    influencingEvents,
    truth: truthProfileForEntity(entity),
    summary,
  };
}

function different(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
}

export function diffHistoricalState(
  project: StarMapProject,
  entityId: string,
  from: HistoricalTimeValue,
  to: HistoricalTimeValue,
): HistoricalDelta {
  const entity = entityMap(project).get(entityId);
  if (!entity) throw new Error(`Unknown entity: ${entityId}`);
  const before = resolveHistoricalView(project, entity, from);
  const after = resolveHistoricalView(project, entity, to);
  const changes: DeltaChange[] = [];

  if (before.present !== after.present) {
    changes.push({
      kind: after.present ? "CREATED" : "DESTROYED",
      label: after.present ? "Entity becomes present" : "Entity becomes absent",
      before: before.present,
      after: after.present,
    });
  }
  if (before.destroyed !== after.destroyed && before.present === after.present) {
    changes.push({
      kind: "DESTROYED",
      label: after.destroyed ? "Historical destruction becomes active" : "Historical destruction is not yet active",
      before: before.destroyed,
      after: after.destroyed,
    });
  }
  if (before.type !== after.type) {
    changes.push({ kind: "TRANSFORMED", label: `${before.type} → ${after.type}`, before: before.type, after: after.type });
  }
  if (before.collapsed !== after.collapsed) {
    changes.push({
      kind: "COLLAPSE",
      label: after.collapsed ? "Collapse becomes active" : "Collapse is outside the selected era",
      before: before.collapsed,
      after: after.collapsed,
    });
  }
  if (before.name !== after.name) {
    changes.push({ kind: "RENAMED", label: `${before.name} → ${after.name}`, before: before.name, after: after.name });
  }
  if (different(before.visual, after.visual)) {
    changes.push({ kind: "VISUAL", label: "Resolved visual state changes", before: before.visual, after: after.visual });
  }
  if (different(before.orbit, after.orbit)) {
    changes.push({ kind: "ORBIT", label: "Resolved orbit changes", before: before.orbit, after: after.orbit });
  }
  if (different(before.annotations, after.annotations)) {
    changes.push({
      kind: "ANNOTATION",
      label: "Active annotations change",
      before: before.annotations,
      after: after.annotations,
    });
  }

  return { entityId, entityName: entity.name, from, to, before, after, changes };
}

function fieldState(status: TruthStatus, entity: Entity, sourceNote?: string): TruthFieldState {
  return {
    status,
    ...(sourceNote || entity.meta.sourceNote ? { sourceNote: sourceNote ?? entity.meta.sourceNote } : {}),
    ...(entity.meta.sourceHref ? { sourceHref: entity.meta.sourceHref } : {}),
  };
}

function timelineTruth(entity: Entity): TruthFieldState {
  if (!entity.timeline.length) return fieldState("unknown", entity, "No historical events are authored for this entity.");
  const states = new Set(entity.timeline.map((event) => event.canonStatus));
  if (states.size === 1 && states.has("locked")) return fieldState("locked", entity, "Derived from locked event records.");
  if (states.has("schematic")) return fieldState("schematic", entity, "At least one event is explicitly schematic.");
  if (states.has("provisional")) return fieldState("provisional", entity, "At least one event is provisional.");
  return fieldState("working", entity, "Derived from event canon statuses.");
}

export function truthProfileForEntity(entity: Entity): TruthProfile {
  const explicit = entity.meta.truth ?? {};
  const profile: TruthProfile = {};
  profile.existence = explicit.existence ?? fieldState(entity.meta.canonStatus, entity);
  profile.name = explicit.name ?? fieldState(entity.meta.canonStatus, entity);

  profile.position = explicit.position ?? (() => {
    if (!entity.position || entity.meta.positionCanon === "unknown") return fieldState("unknown", entity, "No map position is asserted.");
    if (entity.meta.positionCanon === "locked") return fieldState("locked", entity);
    if (entity.meta.positionCanon === "schematic" || entity.meta.canonStatus === "schematic") {
      return fieldState("schematic", entity, "SCHEMATIC / NON-CANON POSITION");
    }
    return fieldState("unknown", entity, "Position exists but has no explicit truth classification.");
  })();

  profile.orbit = explicit.orbit ?? (() => {
    if (!entity.orbit) return fieldState("unknown", entity, "No orbit is authored.");
    if (entity.meta.canonStatus === "schematic") return fieldState("schematic", entity, "Orbit belongs to a schematic entity.");
    return fieldState("unknown", entity, "Authored orbit has no explicit truth classification.");
  })();

  profile.visual = explicit.visual ?? (() => {
    if (!entity.visual) return fieldState("unknown", entity, "No visual state is authored.");
    if (entity.meta.canonStatus === "schematic") return fieldState("schematic", entity, "Visual treatment belongs to a schematic entity.");
    return fieldState("editorial", entity, "Display styling is editorial unless explicitly locked.");
  })();
  profile.timeline = explicit.timeline ?? timelineTruth(entity);
  return profile;
}

function relevantPosition(entity: Entity): boolean {
  return entity.type === "starfield" || entity.type === "system" || entity.type === "largeScaleStructure" || entity.type === "other";
}

function relevantOrbit(entity: Entity): boolean {
  return entity.type === "planet" || entity.type === "moon" || entity.type === "bloodRing" || entity.type === "orbitalStructure";
}

export function findKnowledgeGaps(project: StarMapProject): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  for (const entity of project.entities) {
    const truth = truthProfileForEntity(entity);
    if (relevantPosition(entity)) {
      const position = truth.position!;
      if (position.status === "unknown" || position.status === "schematic") {
        gaps.push({
          entityId: entity.id,
          entityName: entity.name,
          field: "position",
          status: position.status,
          message: position.status === "unknown"
            ? "Known entity has no asserted map position."
            : "Displayed position is deliberately schematic / non-canon.",
        });
      }
    }
    if (relevantOrbit(entity)) {
      const orbit = truth.orbit!;
      if (orbit.status === "unknown" || orbit.status === "schematic") {
        gaps.push({
          entityId: entity.id,
          entityName: entity.name,
          field: "orbit",
          status: orbit.status,
          message: orbit.status === "unknown"
            ? "Orbital truth is unknown or unclassified."
            : "Displayed orbit is schematic / non-canon.",
        });
      }
    }
    const status = entity.meta.canonStatus;
    if (status !== "schematic" && !entity.meta.sourceNote && !entity.meta.sourceHref) {
      gaps.push({
        entityId: entity.id,
        entityName: entity.name,
        field: "source",
        status: "source-missing",
        message: `${status.toUpperCase()} assertion has no source note or URL.`,
      });
    }
  }
  return gaps;
}

export function runAnalystQuery(
  project: StarMapProject,
  query: AnalystQueryId,
  options: { from?: HistoricalTimeValue; to?: HistoricalTimeValue } = {},
): AnalystQueryResult[] {
  switch (query) {
    case "locked-schematic-position":
      return project.entities
        .filter((entity) => entity.meta.canonStatus === "locked" && truthProfileForEntity(entity).position?.status === "schematic")
        .map((entity) => ({ entityId: entity.id, entityName: entity.name, reason: "Locked identity; schematic / non-canon position." }));
    case "unknown-position":
      return findKnowledgeGaps(project)
        .filter((gap) => gap.field === "position" && gap.status === "unknown")
        .map((gap) => ({ entityId: gap.entityId, entityName: gap.entityName, reason: gap.message }));
    case "collapse-affected":
      return project.entities.flatMap((entity) => {
        const trace = traceHistoricalState(project, entity.id, "main-narrative");
        const collapse = trace.influencingEvents.find((item) => item.event.eventType === "starsilkExtractionCollapse");
        return collapse
          ? [{ entityId: entity.id, entityName: entity.name, reason: `Affected by ${collapse.entityName}: ${collapse.event.label}` }]
          : [];
      });
    case "changed-between": {
      const from = options.from ?? 3;
      const to = options.to ?? 170;
      return project.entities.flatMap((entity) => {
        const delta = diffHistoricalState(project, entity.id, from, to);
        return delta.changes.length
          ? [{
              entityId: entity.id,
              entityName: entity.name,
              reason: `${delta.changes.length} resolved change${delta.changes.length === 1 ? "" : "s"} from ${formatHistoricalTime(from)} to ${formatHistoricalTime(to)}.`,
            }]
          : [];
      });
    }
    case "unsourced-canon":
      return project.entities
        .filter((entity) => entity.meta.canonStatus !== "schematic" && !entity.meta.sourceNote && !entity.meta.sourceHref)
        .map((entity) => ({ entityId: entity.id, entityName: entity.name, reason: `${entity.meta.canonStatus.toUpperCase()} entity has no source note or URL.` }));
    case "active-overrides":
      return listTemporalOverrides(project)
        .filter((record) => record.source === "entity-override")
        .map((record) => ({
          entityId: record.entityId,
          entityName: record.entityName,
          reason: `${record.divergent ? "Divergent" : "Redundant"} local override: ${formatHistoricalTime(record.value)}.`,
        }));
  }
}

export function truthFields(): readonly TruthField[] {
  return TRUTH_FIELDS;
}
