import type { Entity, EntityType, StarMapProject } from "./types.ts";
import { createEventId, createId } from "./ids.ts";
import { childrenOf, cloneProject, entityMap } from "./validate.ts";

const DEFAULT_VISUAL: Record<string, { displayRadius: number; color: string }> = {
  starfield: { displayRadius: 6, color: "#4ba7db" },
  system: { displayRadius: 1, color: "#e4bd46" },
  star: { displayRadius: 2, color: "#ffe7a8" },
  blackHole: { displayRadius: 0.7, color: "#000000" },
  planet: { displayRadius: 0.4, color: "#4ba7db" },
  moon: { displayRadius: 0.12, color: "#8fa8b8" },
  bloodRing: { displayRadius: 1.2, color: "#6a1018" },
  orbitalStructure: { displayRadius: 0.6, color: "#c9d5df" },
  largeScaleStructure: { displayRadius: 10, color: "#27374b" },
  other: { displayRadius: 0.3, color: "#8fa8b8" },
};

export function addEntity(
  project: StarMapProject,
  parentId: string | null,
  type: EntityType,
  name?: string,
): { project: StarMapProject; id: string } {
  const id = createId(type);
  const vis = DEFAULT_VISUAL[type] ?? DEFAULT_VISUAL.other;
  const entity: Entity = {
    id,
    parentId,
    type,
    name: name ?? `New ${type}`,
    timeline:
      type === "bloodRing"
        ? [
            {
              id: createEventId(),
              time: 3,
              label: "Blood Ring formed",
              eventType: "bloodRingCreated",
              canonStatus: "provisional",
            },
          ]
        : [],
    visual: { ...vis },
    orbit:
      type === "planet" || type === "moon" || type === "bloodRing" || type === "orbitalStructure"
        ? {
            semiMajorAxis: type === "moon" || type === "bloodRing" ? 0.22 : 1.6,
            eccentricity: 0.02,
            inclination: type === "bloodRing" ? 0.2 : 0.05,
            ascendingNode: Math.random() * Math.PI * 2,
            argumentOfPeriapsis: 0,
            meanAnomalyAtEpoch: Math.random() * Math.PI * 2,
            epoch: 0,
            period: type === "moon" || type === "bloodRing" ? 12 : 40 + Math.random() * 40,
          }
        : undefined,
    position:
      type === "starfield" || type === "system" || type === "largeScaleStructure"
        ? { x: (Math.random() - 0.5) * 24, y: (Math.random() - 0.5) * 12, z: (Math.random() - 0.5) * 24, unit: "schematic" }
        : undefined,
    meta: {
      canonStatus: "schematic",
      positionCanon: "schematic",
      sourceNote: "SCHEMATIC / NON-CANON POSITION",
    },
    order: Date.now() % 100000,
  };
  return { project: { ...project, entities: [...project.entities, entity] }, id };
}

export function duplicateEntity(project: StarMapProject, id: string): { project: StarMapProject; id: string } {
  const map = entityMap(project);
  const src = map.get(id);
  if (!src) return { project, id };
  const next = cloneProject(project);
  const idMap = new Map<string, string>();
  const walk = (entityId: string, parentId: string | null) => {
    const node = map.get(entityId);
    if (!node) return;
    const newId = createId(node.type);
    idMap.set(entityId, newId);
    next.entities.push({
      ...structuredClone(node),
      id: newId,
      parentId,
      name: `${node.name} copy`,
      timeline: structuredClone(node.timeline).map((ev) => ({ ...ev, id: createEventId() })),
    });
    for (const child of childrenOf(project, entityId)) walk(child.id, newId);
  };
  walk(id, src.parentId);
  return { project: next, id: idMap.get(id) ?? id };
}

export function deleteEntity(project: StarMapProject, id: string): StarMapProject {
  const drop = new Set<string>();
  const walk = (eid: string) => {
    drop.add(eid);
    for (const c of childrenOf(project, eid)) walk(c.id);
  };
  walk(id);
  return { ...project, entities: project.entities.filter((e) => !drop.has(e.id)) };
}

export function renameEntity(project: StarMapProject, id: string, name: string): StarMapProject {
  return {
    ...project,
    entities: project.entities.map((e) => (e.id === id ? { ...e, name } : e)),
  };
}

export function patchEntity(project: StarMapProject, id: string, patch: Partial<Entity>): StarMapProject {
  return {
    ...project,
    entities: project.entities.map((e) => (e.id === id ? { ...e, ...patch, id: e.id } : e)),
  };
}

export function patchEntityDeep(
  project: StarMapProject,
  id: string,
  fn: (e: Entity) => Entity,
): StarMapProject {
  return {
    ...project,
    entities: project.entities.map((e) => (e.id === id ? fn(e) : e)),
  };
}
