import { createEntity, getEntity, newId, type Entity, type EntityType, type StarMapProject, type TimelineEvent } from "./core.js";
import { resolveHistoricalTime } from "./timeline.js";

const CHILDREN: Partial<Record<EntityType, EntityType[]>> = {
  galaxy: ["starfield", "largeScaleStructure"],
  starfield: ["system"],
  system: ["star", "planet", "other"],
  planet: ["moon", "bloodRing", "orbitalStructure"],
  moon: ["orbitalStructure"]
};

export function allowedChildTypes(parent: Entity): EntityType[] {
  return [...(CHILDREN[parent.type] ?? [])];
}

export function createAuthoredChild(project: StarMapProject, parentId: string, type: EntityType): Entity {
  const parent = getEntity(project, parentId);
  if (!parent) throw new Error("Parent entity not found.");
  if (!allowedChildTypes(parent).includes(type)) throw new Error(`${type} cannot be created under ${parent.type}.`);
  const entity = createEntity(type, parentId, `NEW ${type.replace(/([A-Z])/g, " $1").toUpperCase()}`);
  entity.meta.canonStatus = "schematic";
  entity.meta.positionStatus = "unknown";
  entity.meta.sourceNote = "New authoring object. Canon/provenance not yet supplied.";
  if (type === "system" || type === "starfield") entity.position = { x: 0, y: 0, z: 0, unit: "schematic" };
  if (["planet", "moon", "bloodRing", "orbitalStructure"].includes(type)) {
    entity.orbit = { semiMajorAxis: type === "moon" ? 0.2 : type === "bloodRing" ? 0.35 : 2, eccentricity: 0, inclination: 0, ascendingNode: 0, argumentOfPeriapsis: 0, meanAnomalyAtEpoch: 0, epoch: 0, period: type === "moon" ? 8 : 60 };
  }
  if (type === "bloodRing") {
    entity.visual = { displayRadius: 1.75, color: "#5b101b", ringAppearance: "vitrified crimson-black composite" };
    entity.timeline.push({ id: newId("event"), time: resolveHistoricalTime(project, parentId).value, label: "Blood Ring created", eventType: "bloodRingCreated", canonStatus: "schematic", sourceNote: "Author-created event; supply provenance." });
  }
  return entity;
}

export function createTimelineEvent(project: StarMapProject, entityId: string): TimelineEvent {
  return {
    id: newId("event"),
    time: resolveHistoricalTime(project, entityId).value,
    label: "New annotation",
    eventType: "annotation",
    canonStatus: "schematic",
    sourceNote: "Author-created event; supply provenance."
  };
}

export function moveSibling(project: StarMapProject, entityId: string, direction: -1 | 1): void {
  const entity = getEntity(project, entityId);
  if (!entity) return;
  const siblings = project.entities.filter((candidate) => candidate.parentId === entity.parentId);
  const index = siblings.findIndex((candidate) => candidate.id === entity.id);
  const target = siblings[index + direction];
  if (!target) return;
  const a = project.entities.findIndex((candidate) => candidate.id === entity.id);
  const b = project.entities.findIndex((candidate) => candidate.id === target.id);
  const temp = project.entities[a];
  project.entities[a] = project.entities[b]!;
  project.entities[b] = temp!;
}
