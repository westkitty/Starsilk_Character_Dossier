import type { EraPreset, HistoricalTimeValue } from "./types.ts";

/** Ordered mapping for comparison. Main narrative is after every dated event
 *  and is never given an invented numeric year. */
const SENTINEL_ORDER: Record<Exclude<HistoricalTimeValue, number>, number> = {
  "pre-war": Number.NEGATIVE_INFINITY,
  "post-siege-wall": 170.5,
  "main-narrative": Number.POSITIVE_INFINITY,
};

export function timeToOrder(value: HistoricalTimeValue): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value in SENTINEL_ORDER) {
    return SENTINEL_ORDER[value as Exclude<HistoricalTimeValue, number>];
  }
  return Number.NaN;
}

export function compareTime(a: HistoricalTimeValue, b: HistoricalTimeValue): number {
  const oa = timeToOrder(a);
  const ob = timeToOrder(b);
  if (oa < ob) return -1;
  if (oa > ob) return 1;
  return 0;
}

export function isTimeAtOrAfter(
  eventTime: HistoricalTimeValue,
  asOf: HistoricalTimeValue,
): boolean {
  return compareTime(eventTime, asOf) <= 0;
}

export function formatHistoricalTime(value: HistoricalTimeValue): string {
  if (value === "pre-war") return "PRE-WAR";
  if (value === "post-siege-wall") return "POST-SIEGE-WALL";
  if (value === "main-narrative") return "MAIN NARRATIVE — DATE UNSPECIFIED";
  if (typeof value === "number") {
    const preset = DEFAULT_ERA_PRESETS.find((p) => p.value === value && p.id !== "custom");
    if (preset) return preset.label;
    if (Number.isInteger(value)) return `YEAR ${value}`;
    return `YEAR ${value}`;
  }
  return String(value);
}

export function parseHistoricalTime(input: string): HistoricalTimeValue | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  if (
    trimmed === "pre-war" ||
    trimmed === "prewar" ||
    trimmed === "pre war"
  ) {
    return "pre-war";
  }
  if (
    trimmed === "post-siege-wall" ||
    trimmed === "post siege wall" ||
    trimmed === "post-war"
  ) {
    return "post-siege-wall";
  }
  if (
    trimmed === "main-narrative" ||
    trimmed === "main narrative" ||
    trimmed === "main narrative — date unspecified" ||
    trimmed === "unspecified"
  ) {
    return "main-narrative";
  }
  const yearMatch = trimmed.match(/^(?:year\s*)?(-?\d+(?:\.\d+)?)$/);
  if (yearMatch) return Number(yearMatch[1]);
  return null;
}

export const DEFAULT_ERA_PRESETS: EraPreset[] = [
  { id: "pre-war", label: "PRE-WAR", value: "pre-war", editable: true },
  { id: "be-0", label: "BLOOD ECLIPSE — YEAR 0", value: 0, editable: true },
  { id: "be-3", label: "BLOOD ECLIPSE — YEAR 3", value: 3, editable: true },
  { id: "be-121", label: "BLOOD ECLIPSE — YEAR 121", value: 121, editable: true },
  { id: "be-170", label: "BLOOD ECLIPSE — YEAR 170", value: 170, editable: true },
  {
    id: "post-wall",
    label: "POST-SIEGE-WALL",
    value: "post-siege-wall",
    editable: true,
  },
  {
    id: "main",
    label: "MAIN NARRATIVE — DATE UNSPECIFIED",
    value: "main-narrative",
    editable: true,
  },
  { id: "custom", label: "CUSTOM", value: 0, editable: true },
];

export function scopeOfType(
  type: string,
): "galaxy" | "starfield" | "system" | "object" {
  if (type === "galaxy") return "galaxy";
  if (type === "starfield") return "starfield";
  if (type === "system") return "system";
  return "object";
}
