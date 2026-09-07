import type {
  Entity,
  HistoricalTimeValue,
  ResolvedTime,
  StarMapProject,
} from "./types.ts";
import { scopeOfType } from "./time.ts";
import { entityMap } from "./validate.ts";

export function galaxyEntity(project: StarMapProject): Entity | undefined {
  return project.entities.find((e) => e.type === "galaxy" && e.parentId === null);
}

/**
 * Hierarchical historical time.
 * Children inherit parent time unless they set mode: "override".
 * Galaxy time comes from project.settings.galaxyHistoricalTime (the archive
 * scrubber), not from orbital simulation time.
 */
export function resolveHistoricalTime(
  project: StarMapProject,
  entityId: string | null,
): ResolvedTime {
  const galaxyTime = project.settings.galaxyHistoricalTime;
  if (!entityId) {
    const g = galaxyEntity(project);
    return {
      value: galaxyTime,
      mode: "inherit",
      inheritedFromId: g?.id ?? null,
      scope: "galaxy",
    };
  }

  const map = entityMap(project);
  const entity = map.get(entityId);
  if (!entity) {
    return {
      value: galaxyTime,
      mode: "inherit",
      inheritedFromId: null,
      scope: "galaxy",
    };
  }

  if (entity.time?.mode === "override" && entity.time.overrideValue !== undefined) {
    return {
      value: entity.time.overrideValue,
      mode: "override",
      inheritedFromId: null,
      scope: scopeOfType(entity.type),
    };
  }

  if (entity.type === "galaxy" || entity.parentId === null) {
    return {
      value: galaxyTime,
      mode: "inherit",
      inheritedFromId: entity.id,
      scope: "galaxy",
    };
  }

  const parent = resolveHistoricalTime(project, entity.parentId);
  return {
    value: parent.value,
    mode: "inherit",
    inheritedFromId: entity.parentId,
    scope: scopeOfType(entity.type),
  };
}

export function setOverride(
  project: StarMapProject,
  entityId: string,
  value: HistoricalTimeValue,
): StarMapProject {
  return {
    ...project,
    entities: project.entities.map((e) =>
      e.id === entityId
        ? { ...e, time: { mode: "override", overrideValue: value } }
        : e,
    ),
  };
}

export function clearOverride(project: StarMapProject, entityId: string): StarMapProject {
  return {
    ...project,
    entities: project.entities.map((e) =>
      e.id === entityId ? { ...e, time: { mode: "inherit" } } : e,
    ),
  };
}

export function setGalaxyTime(
  project: StarMapProject,
  value: HistoricalTimeValue,
): StarMapProject {
  return {
    ...project,
    settings: { ...project.settings, galaxyHistoricalTime: value },
  };
}
