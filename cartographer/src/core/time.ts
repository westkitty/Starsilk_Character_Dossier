/**
 * HISTORICAL TIME AXIS.
 *
 * Two independent clocks exist in this application and must never be merged:
 *
 *   1. ORBITAL SIMULATION TIME — a floating point number of seconds advanced by
 *      the render loop. Governs revolution, rotation, trails, animation speed.
 *      Lives in `core/simulation.ts`.
 *   2. HISTORICAL / ERA TIME — this module. A *discrete authored* coordinate on
 *      the STARSiLK historical axis that decides what exists, what has collapsed,
 *      and what has been renamed. It is comparable and ordered, but it is never
 *      advanced by animation and never interpolated.
 *
 * Values are either a Blood Eclipse War year (the war spans 170 years) or an era
 * preset id for anchors that deliberately have no supplied numeric date — the
 * main STARSiLK narrative is one of those and stays undated.
 */

import type { EraPreset, TimeValue } from './types';

export const CUSTOM_PRESET_ID = 'custom';
export const MAIN_NARRATIVE_PRESET_ID = 'main-narrative';
export const PRE_WAR_PRESET_ID = 'pre-war';
export const POST_SIEGE_WALL_PRESET_ID = 'post-siege-wall';

/** The Blood Eclipse War chronology spans 170 years. */
export const BLOOD_ECLIPSE_WAR_YEARS = 170;

/**
 * Editable starter presets. This list is explicitly NOT an exhaustive account of
 * STARSiLK history — authors add presets and custom values freely.
 */
export function defaultEraPresets(): EraPreset[] {
  return [
    {
      id: PRE_WAR_PRESET_ID,
      label: 'PRE-WAR',
      order: 0,
      description:
        'Fringe-colony tension before Blood Eclipse War hostilities. Exact date deliberately unspecified.',
      canonStatus: 'working',
    },
    {
      id: 'bew-0',
      label: 'BLOOD ECLIPSE — YEAR 0',
      order: 10,
      time: 0,
      description:
        'Fringe-colony hostilities begin after Drakken lightning-strike terraformings trigger Administration counter-Macros.',
      canonStatus: 'locked',
    },
    {
      id: 'bew-3',
      label: 'BLOOD ECLIPSE — YEAR 3',
      order: 20,
      time: 3,
      description: 'First Blood Rings erected around Fallenstar Prime.',
      canonStatus: 'locked',
    },
    {
      id: 'bew-121',
      label: 'BLOOD ECLIPSE — YEAR 121',
      order: 30,
      time: 121,
      description:
        'Administration attacks a Drakken forward node in the Pharos Nebula. Siege of the Ruby Eclipse.',
      canonStatus: 'locked',
    },
    {
      id: 'bew-170',
      label: 'BLOOD ECLIPSE — YEAR 170',
      order: 40,
      time: 170,
      description:
        'Final collapse at the Aureal Gate. Drakken use Starsilk against gods for the first time.',
      canonStatus: 'locked',
    },
    {
      id: POST_SIEGE_WALL_PRESET_ID,
      label: 'POST-SIEGE-WALL',
      order: 50,
      description:
        'After the Aureal Gate, Shard-God Tiger collapses vast numbers of stars; those stellar deaths establish the Siege Wall, which contains — does not annihilate — the Drakken. No exact date supplied.',
      canonStatus: 'working',
    },
    {
      id: MAIN_NARRATIVE_PRESET_ID,
      label: 'MAIN NARRATIVE — DATE UNSPECIFIED',
      order: 60,
      description:
        'The era of the main STARSiLK narrative. It occurs later than the war; no exact numerical year is supplied and none is invented here.',
      canonStatus: 'working',
    },
    {
      id: CUSTOM_PRESET_ID,
      label: 'CUSTOM',
      order: 70,
      description: 'Type an exact value: a war year, or an era marker id.',
      canonStatus: 'provisional',
      custom: true,
    },
  ];
}

type Classification =
  | { kind: 'numeric'; value: number }
  | { kind: 'preset'; preset: EraPreset }
  | { kind: 'unknown'; id: string };

export function isTimeValue(value: unknown): value is TimeValue {
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'string' && value.trim().length > 0;
}

export function presetById(presets: readonly EraPreset[], id: string): EraPreset | undefined {
  return presets.find((p) => p.id === id);
}

export function classifyTime(value: TimeValue, presets: readonly EraPreset[]): Classification {
  if (typeof value === 'number') return { kind: 'numeric', value };
  const preset = presetById(presets, value);
  if (preset) return { kind: 'preset', preset };
  return { kind: 'unknown', id: value };
}

/** -1 = strictly before every war year, +1 = strictly after every war year. */
function relationToWarYears(c: Classification): number {
  if (c.kind === 'preset') {
    if (typeof c.preset.time === 'number') return 0;
    return c.preset.id === PRE_WAR_PRESET_ID ? -1 : 1;
  }
  if (c.kind === 'unknown') return 1;
  return 0;
}

function numericEquivalent(c: Classification): number | null {
  if (c.kind === 'numeric') return c.value;
  if (c.kind === 'preset' && typeof c.preset.time === 'number') return c.preset.time;
  return null;
}

function ordinalOf(c: Classification): number {
  if (c.kind === 'preset') return c.preset.order;
  if (c.kind === 'unknown') return Number.POSITIVE_INFINITY;
  return 0;
}

function labelOf(c: Classification): string {
  if (c.kind === 'preset') return c.preset.id;
  if (c.kind === 'unknown') return c.id;
  return String(c.value);
}

/**
 * Total order over the historical axis.
 *
 * War years compare numerically. Undated anchors are placed relationally:
 * PRE-WAR precedes every war year; POST-SIEGE-WALL and the main narrative follow
 * them (the narrative is later still). This keeps the main narrative genuinely
 * undated while remaining orderable.
 */
export function compareTime(
  a: TimeValue,
  b: TimeValue,
  presets: readonly EraPreset[],
): number {
  const ca = classifyTime(a, presets);
  const cb = classifyTime(b, presets);
  const na = numericEquivalent(ca);
  const nb = numericEquivalent(cb);

  if (na !== null && nb !== null) return na === nb ? 0 : na < nb ? -1 : 1;
  if (na !== null) return -relationToWarYears(cb) || -1;
  if (nb !== null) return relationToWarYears(ca) || 1;

  const oa = ordinalOf(ca);
  const ob = ordinalOf(cb);
  if (oa !== ob) return oa < ob ? -1 : 1;
  const la = labelOf(ca);
  const lb = labelOf(cb);
  if (la === lb) return 0;
  return la < lb ? -1 : 1;
}

/** True when `a` is at or before `b` on the historical axis. */
export function atOrBefore(a: TimeValue, b: TimeValue, presets: readonly EraPreset[]): boolean {
  return compareTime(a, b, presets) <= 0;
}

export function formatWarYear(year: number): string {
  if (!Number.isInteger(year)) return String(Math.round(year * 100) / 100);
  if (year < 0) return `${year} (PRE-WAR)`;
  if (year > BLOOD_ECLIPSE_WAR_YEARS) return `${year} (POST-WAR)`;
  return String(year);
}

/** Human label for any historical value. */
export function describeTime(value: TimeValue, presets: readonly EraPreset[]): string {
  if (typeof value === 'number') {
    return `YEAR ${formatWarYear(value)}`;
  }
  const preset = presetById(presets, value);
  if (preset) return preset.label;
  return `ERA MARKER “${value}”`;
}

/** Short label used on rail markers. */
export function describeTimeShort(value: TimeValue, presets: readonly EraPreset[]): string {
  if (typeof value === 'number') return `Y${formatWarYear(value)}`;
  const preset = presetById(presets, value);
  if (preset) {
    return preset.id === MAIN_NARRATIVE_PRESET_ID
      ? 'MAIN NARRATIVE'
      : preset.label.replace(/^BLOOD ECLIPSE — /, 'BEW ');
  }
  return value.toUpperCase();
}

export function sortEvents<T extends { time: TimeValue }>(
  events: readonly T[],
  presets: readonly EraPreset[],
): T[] {
  return [...events].sort((a, b) => compareTime(a.time, b.time, presets));
}

/**
 * Resolve a UI preset selection into a storable value.
 * The `custom` preset is never stored: it resolves to the typed value instead.
 */
export function presetToValue(preset: EraPreset): TimeValue {
  return typeof preset.time === 'number' ? preset.time : preset.id;
}

/**
 * Presentation-only numeric stand-in for any historical value.
 *
 * Undated anchors get bounded virtual positions so UI controls can measure
 * "how far away" a marker is: PRE-WAR sits one war-length before Year 0 and the
 * post-war anchors sit after Year 170. This is a *snapping heuristic only* — canon
 * ordering is decided by `compareTime`, never by these numbers, so the main
 * narrative still has no authored date.
 */
export function virtualYear(value: TimeValue, presets: readonly EraPreset[]): number {
  if (typeof value === 'number') return value;
  const preset = presetById(presets, value);
  if (!preset) return Number.MAX_SAFE_INTEGER / 2;
  if (typeof preset.time === 'number') return preset.time;
  if (preset.id === PRE_WAR_PRESET_ID) return -BLOOD_ECLIPSE_WAR_YEARS;
  if (preset.id === POST_SIEGE_WALL_PRESET_ID) return BLOOD_ECLIPSE_WAR_YEARS * 2;
  if (preset.id === MAIN_NARRATIVE_PRESET_ID) return BLOOD_ECLIPSE_WAR_YEARS * 3;
  return Number.MAX_SAFE_INTEGER / 2;
}

export function nearestPreset(
  value: TimeValue,
  presets: readonly EraPreset[],
): EraPreset | undefined {
  const candidates = presets.filter((p) => !p.custom);
  if (candidates.length === 0) return undefined;
  const target = virtualYear(value, presets);
  let best: EraPreset | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const preset of candidates) {
    const distance = Math.abs(virtualYear(presetToValue(preset), presets) - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = preset;
    }
  }
  return best;
}

/** Preset markers ordered along the axis — used by the historical rail. */
export function orderedPresets(presets: readonly EraPreset[]): EraPreset[] {
  return [...presets].sort((a, b) => a.order - b.order);
}

/**
 * Scrubber range for the rail: numeric war years when the current value is a war
 * year, otherwise the ordered preset list. Returned as discrete stops so the
 * scrubber can never fabricate a date that was not authored.
 */
export function railStops(
  presets: readonly EraPreset[],
): Array<{ value: TimeValue; label: string }> {
  return orderedPresets(presets)
    .filter((p) => !p.custom)
    .map((p) => ({ value: presetToValue(p), label: p.label }));
}
