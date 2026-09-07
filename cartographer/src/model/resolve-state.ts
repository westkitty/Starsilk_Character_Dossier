import type {
  Entity,
  EntityType,
  HistoricalTimeValue,
  HistoricalView,
  StarMapProject,
  TimelineEvent,
} from "./types.ts";
import { isTimeAtOrAfter } from "./time.ts";
import { resolveHistoricalTime } from "./resolve-time.ts";
import { childrenOf, entityMap } from "./validate.ts";

function applyPatch<T extends Record<string, unknown>>(base: T, patch: Record<string, unknown> | undefined): T {
  if (!patch) return base;
  const next: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v) && typeof next[k] === "object" && next[k] !== null) {
      next[k] = applyPatch(next[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      next[k] = v;
    }
  }
  return next as T;
}

export function eventsAtOrBefore(entity: Entity, asOf: HistoricalTimeValue): TimelineEvent[] {
  return [...entity.timeline]
    .filter((ev) => isTimeAtOrAfter(ev.time, asOf))
    .sort((a, b) => {
      if (isTimeAtOrAfter(a.time, b.time) && isTimeAtOrAfter(b.time, a.time)) return 0;
      return isTimeAtOrAfter(a.time, b.time) ? -1 : 1;
    });
}

function startsAbsent(entity: Entity): boolean {
  if (entity.type === "bloodRing") return true;
  return entity.timeline.some(
    (ev) =>
      ev.eventType === "created" ||
      ev.eventType === "bloodRingCreated" ||
      ev.eventType === "siegeWallFormed",
  );
}

/**
 * Resolve discrete historical state for an entity as-of a historical time.
 * Scrubbing backward visualizes the past; it does not delete events or reverse canon.
 */
export function resolveHistoricalView(
  project: StarMapProject,
  entity: Entity,
  asOf?: HistoricalTimeValue,
): HistoricalView {
  const time = asOf ?? resolveHistoricalTime(project, entity.id).value;
  const events = eventsAtOrBefore(entity, time);

  let present = !startsAbsent(entity);
  let destroyed = false;
  let collapsed = false;
  let type: EntityType = entity.type;
  let name = entity.name;
  let visual = entity.visual ? { ...entity.visual } : undefined;
  let orbit = entity.orbit ? { ...entity.orbit } : undefined;
  const annotations: string[] = [];

  for (const ev of events) {
    switch (ev.eventType) {
      case "created":
        present = true;
        destroyed = false;
        break;
      case "destroyed":
        present = false;
        destroyed = true;
        break;
      case "renamed":
        if (typeof ev.statePatch?.name === "string") name = ev.statePatch.name;
        break;
      case "visualChanged":
        if (ev.statePatch?.visual && typeof ev.statePatch.visual === "object") {
          visual = {
            ...(visual ?? { displayRadius: 1, color: "#c9d5df" }),
            ...(ev.statePatch.visual as object),
          };
        }
        break;
      case "orbitChanged":
        if (ev.statePatch?.orbit && typeof ev.statePatch.orbit === "object") {
          orbit = { ...(orbit as object), ...(ev.statePatch.orbit as object) } as typeof orbit;
        }
        break;
      case "bloodRingCreated":
        present = true;
        destroyed = false;
        break;
      case "bloodRingDestroyed":
        present = false;
        destroyed = true;
        break;
      case "starsilkExtractionCollapse":
        collapsed = true;
        destroyed = true;
        if (entity.type === "star" || entity.type === "blackHole") {
          type = "blackHole";
          present = true;
        } else if (entity.type === "system") {
          present = true;
        } else {
          present = false;
        }
        break;
      case "siegeWallFormed":
        present = true;
        break;
      case "annotation":
        annotations.push(ev.label);
        break;
      default:
        break;
    }
    if (ev.statePatch) {
      const patched = applyPatch(
        { present, destroyed, collapsed, type, name, visual, orbit } as Record<string, unknown>,
        ev.statePatch,
      );
      present = patched.present as boolean;
      destroyed = patched.destroyed as boolean;
      collapsed = patched.collapsed as boolean;
      type = patched.type as EntityType;
      name = patched.name as string;
      visual = patched.visual as typeof visual;
      orbit = patched.orbit as typeof orbit;
    }
  }

  if (entity.type === "system") {
    const star = childrenOf(project, entity.id).find((c) => c.type === "star" || c.type === "blackHole");
    if (star) {
      const starView = resolveHistoricalView(project, star, time);
      if (starView.collapsed) {
        destroyed = true;
        collapsed = true;
      }
    }
  }

  if (entity.parentId && entity.type !== "star" && entity.type !== "blackHole" && entity.type !== "galaxy") {
    const parent = entityMap(project).get(entity.parentId);
    if (parent?.type === "system") {
      const sys = resolveHistoricalView(project, parent, time);
      if (sys.collapsed) {
        present = false;
        destroyed = true;
      }
    }
  }

  return { present, destroyed, collapsed, type, name, visual, orbit, annotations };
}

export function isEntityVisible(
  project: StarMapProject,
  entity: Entity,
  asOf?: HistoricalTimeValue,
): boolean {
  const view = resolveHistoricalView(project, entity, asOf);
  if (!view.present) return false;
  if (project.settings.canonOnly && entity.meta.canonStatus === "schematic") {
    if (entity.type !== "galaxy") return false;
  }
  return true;
}
