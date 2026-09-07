import { ancestorsOf, getEntity, type Entity, type HistoricalTime, type StarMapProject, type TimelineEvent } from "./core.js";

const SYMBOLIC_ORDER: Record<string, number> = {
  "PRE-WAR": -1,
  "POST-SIEGE-WALL": 171,
  "MAIN NARRATIVE — DATE UNSPECIFIED": 1_000_000,
};

export interface ResolvedHistoricalTime {
  value: HistoricalTime;
  sourceId: string;
  inherited: boolean;
}

export interface HistoricalEntityState {
  visible: boolean;
  effectiveType: Entity["type"];
  name: string;
  destroyed: boolean;
  resolvedTime: ResolvedHistoricalTime;
}

export function historicalOrder(value: HistoricalTime): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    if (value in SYMBOLIC_ORDER) return SYMBOLIC_ORDER[value]!;
    const trimmed = value.trim();
    if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  }
  return null;
}

export function historicalTimeLabel(value: HistoricalTime): string {
  if (typeof value === "number") return value < 0 ? "PRE-WAR" : `YEAR ${value}`;
  return value;
}

export function eventIsActive(eventTime: HistoricalTime, currentTime: HistoricalTime): boolean {
  const eventOrder = historicalOrder(eventTime);
  const currentOrder = historicalOrder(currentTime);
  if (eventOrder !== null && currentOrder !== null) return eventOrder <= currentOrder;
  return eventTime === currentTime;
}

export function resolveHistoricalTime(project: StarMapProject, entityId: string): ResolvedHistoricalTime {
  const entity = getEntity(project, entityId);
  if (!entity) throw new Error(`Unknown entity: ${entityId}`);
  let current: Entity | undefined = entity;
  while (current) {
    if (current.time.mode === "override" && current.time.overrideValue !== undefined) {
      return { value: current.time.overrideValue, sourceId: current.id, inherited: current.id !== entity.id };
    }
    current = getEntity(project, current.parentId);
  }
  throw new Error(`No historical time source resolves for ${entityId}.`);
}

export function setHistoricalOverride(project: StarMapProject, entityId: string, value: HistoricalTime): void {
  const entity = getEntity(project, entityId);
  if (!entity) throw new Error(`Unknown entity: ${entityId}`);
  entity.time = { mode: "override", overrideValue: value };
}

export function returnToParentTime(project: StarMapProject, entityId: string): void {
  const entity = getEntity(project, entityId);
  if (!entity) throw new Error(`Unknown entity: ${entityId}`);
  if (entity.type === "galaxy" || entity.parentId === null) throw new Error("The root galaxy must own an explicit historical time.");
  entity.time = { mode: "inherit" };
}

function activeEvents(events: TimelineEvent[], current: HistoricalTime): TimelineEvent[] {
  return events
    .filter((event) => eventIsActive(event.time, current))
    .sort((a, b) => (historicalOrder(a.time) ?? 0) - (historicalOrder(b.time) ?? 0));
}

function systemAncestor(project: StarMapProject, entity: Entity): Entity | undefined {
  if (entity.type === "system") return entity;
  return [entity, ...ancestorsOf(project, entity.id)].find((candidate) => candidate.type === "system");
}

function activeCollapse(project: StarMapProject, entity: Entity, time: HistoricalTime): TimelineEvent | undefined {
  const system = systemAncestor(project, entity);
  if (!system) return undefined;
  return activeEvents(system.timeline, time).find((event) => event.eventType === "starsilkExtractionCollapse");
}

export function resolveEntityHistoricalState(project: StarMapProject, entityId: string): HistoricalEntityState {
  const entity = getEntity(project, entityId);
  if (!entity) throw new Error(`Unknown entity: ${entityId}`);
  const resolvedTime = resolveHistoricalTime(project, entity.id);
  const events = activeEvents(entity.timeline, resolvedTime.value);
  const hasCreation = entity.timeline.some((event) => event.eventType === "created" || event.eventType === "bloodRingCreated");
  let visible = !hasCreation;
  let destroyed = false;
  let effectiveType = entity.type;
  let name = entity.name;

  for (const event of events) {
    if (event.eventType === "created" || event.eventType === "bloodRingCreated") visible = true;
    if (event.eventType === "destroyed" || event.eventType === "bloodRingDestroyed") { visible = false; destroyed = true; }
    if (event.eventType === "renamed" && typeof event.statePatch?.name === "string") name = event.statePatch.name;
    if (event.eventType === "starsilkExtractionCollapse") {
      destroyed = entity.type === "system";
      if (entity.type === "system") visible = true;
    }
  }

  const collapse = activeCollapse(project, entity, resolvedTime.value);
  if (collapse) {
    const targetStarId = typeof collapse.statePatch?.starId === "string" ? collapse.statePatch.starId : undefined;
    const system = systemAncestor(project, entity);
    if (entity.type === "star" && (!targetStarId || targetStarId === entity.id)) effectiveType = "blackHole";
    if (entity.type === "planet" || entity.type === "moon" || entity.type === "bloodRing" || entity.type === "orbitalStructure") {
      visible = false;
      destroyed = true;
    }
    if (entity.type === "system" || entity.id === system?.id) destroyed = true;
  }

  return { visible, effectiveType, name, destroyed, resolvedTime };
}

export function eventsForScope(project: StarMapProject, entityId: string): TimelineEvent[] {
  const entity = getEntity(project, entityId);
  if (!entity) return [];
  return [...entity.timeline].sort((a, b) => (historicalOrder(a.time) ?? 0) - (historicalOrder(b.time) ?? 0));
}
