import { DEFAULT_ERA_PRESETS, SCHEMA_VERSION, type Entity, type StarMapProject } from "./core.js";

const schematic = (sourceNote = "SCHEMATIC / NON-CANON POSITION"): Entity["meta"] => ({
  canonStatus: "schematic",
  positionStatus: "schematic",
  sourceNote
});

const orbit = (semiMajorAxis: number, period: number, inclination = 0, phase = 0) => ({
  semiMajorAxis,
  eccentricity: 0.035,
  inclination,
  ascendingNode: 0,
  argumentOfPeriapsis: 0,
  meanAnomalyAtEpoch: phase,
  epoch: 0,
  period
});

export function createDemoProject(): StarMapProject {
  const entities: Entity[] = [
    { id: "galaxy-starsilk-demo", parentId: null, type: "galaxy", name: "STARSiLK CARTOGRAPHIC DEMO", time: { mode: "override", overrideValue: 121 }, timeline: [], meta: schematic("Demonstration topology only. Named locations are canon references; coordinates are not supplied canon."), visual: { color: "#55dfff" } },
    { id: "sector-pharos", parentId: "galaxy-starsilk-demo", type: "starfield", name: "PHAROS NEBULA", position: { x: -36, y: 8, z: 20, unit: "schematic" }, time: { mode: "inherit" }, timeline: [], meta: schematic(), visual: { color: "#4ba7db" } },
    { id: "sector-fallenstar", parentId: "galaxy-starsilk-demo", type: "starfield", name: "FALLENSTAR REGION", position: { x: 28, y: -5, z: -18, unit: "schematic" }, time: { mode: "inherit" }, timeline: [], meta: schematic(), visual: { color: "#d95d6c" } },
    { id: "sector-aureal", parentId: "galaxy-starsilk-demo", type: "starfield", name: "AUREAL APPROACH", position: { x: 5, y: 18, z: 42, unit: "schematic" }, time: { mode: "inherit" }, timeline: [], meta: schematic(), visual: { color: "#e4bd46" } },
    { id: "system-pharos-03", parentId: "sector-pharos", type: "system", name: "PHAROS SYSTEM 03", position: { x: -40, y: 7, z: 18, unit: "schematic" }, time: { mode: "inherit" }, timeline: [], meta: schematic(), visual: { color: "#a6efff" } },
    { id: "star-pharos-03", parentId: "system-pharos-03", type: "star", name: "PHAROS 03", time: { mode: "inherit" }, timeline: [], meta: { canonStatus: "schematic", sourceNote: "Demonstration star; not asserted as canon." }, visual: { displayRadius: 2.8, color: "#c9d5df", emissive: 0.8 } },
    { id: "planet-pharos-a", parentId: "system-pharos-03", type: "planet", name: "PHAROS A", orbit: orbit(1.8, 50, 3, 15), time: { mode: "inherit" }, timeline: [], meta: schematic("Demonstration planet; not asserted as canon."), visual: { displayRadius: 1.05, color: "#7dbf82", atmosphere: true } },
    { id: "moon-pharos-a1", parentId: "planet-pharos-a", type: "moon", name: "PHAROS A-I", orbit: orbit(0.18, 8, 12, 180), time: { mode: "inherit" }, timeline: [], meta: schematic("Demonstration moon; not asserted as canon."), visual: { displayRadius: 0.35, color: "#8fa8b8" } },
    { id: "system-fallenstar", parentId: "sector-fallenstar", type: "system", name: "FALLENSTAR SYSTEM", position: { x: 31, y: -6, z: -16, unit: "schematic" }, time: { mode: "inherit" }, timeline: [], meta: schematic(), visual: { color: "#d95d6c" } },
    { id: "star-fallenstar", parentId: "system-fallenstar", type: "star", name: "FALLENSTAR", time: { mode: "inherit" }, timeline: [], meta: { canonStatus: "provisional", sourceNote: "Display star for the known Fallenstar Prime location; stellar properties are schematic." }, visual: { displayRadius: 3.2, color: "#e4bd46", emissive: 1 } },
    { id: "planet-fallenstar-prime", parentId: "system-fallenstar", type: "planet", name: "FALLENSTAR PRIME", orbit: orbit(2.4, 84, 1.5, 70), time: { mode: "inherit" }, timeline: [], meta: { canonStatus: "locked", sourceNote: "Known canon name. Orbit and position are schematic." }, visual: { displayRadius: 1.35, color: "#8fa8b8", atmosphere: true } },
    { id: "system-aureal-gate", parentId: "sector-aureal", type: "system", name: "AUREAL GATE", position: { x: 7, y: 20, z: 45, unit: "schematic" }, time: { mode: "inherit" }, timeline: [], meta: schematic(), visual: { color: "#e4bd46" } },
    { id: "star-aureal", parentId: "system-aureal-gate", type: "star", name: "AUREAL PRIMARY", time: { mode: "inherit" }, timeline: [], meta: schematic("Demonstration stellar identity; the task supplies Aureal Gate, not exact stellar properties."), visual: { displayRadius: 3, color: "#a6efff", emissive: 0.9 } },
    { id: "planet-aureal-a", parentId: "system-aureal-gate", type: "planet", name: "AUREAL A", orbit: orbit(2.1, 72, 6, 225), time: { mode: "inherit" }, timeline: [], meta: schematic("Demonstration planet; not asserted as canon."), visual: { displayRadius: 1.1, color: "#4ba7db", atmosphere: true } }
  ];

  return {
    schemaVersion: SCHEMA_VERSION,
    id: "starsilk-cartographer-demo-v1",
    title: "STARSiLK Temporal Cartographer — Demonstration",
    eraPresets: structuredClone(DEFAULT_ERA_PRESETS),
    entities,
    settings: { simulation: { running: true, speed: 1 }, view: { labels: true, orbitPaths: true, trails: false, referenceGrid: false, analystOverlay: false, canonOnly: false, annotations: true } }
  };
}
