import { describe, expect, it } from 'vitest';
import {
  atOrBefore,
  BLOOD_ECLIPSE_WAR_YEARS,
  compareTime,
  defaultEraPresets,
  describeTime,
  describeTimeShort,
  formatWarYear,
  MAIN_NARRATIVE_PRESET_ID,
  nearestPreset,
  orderedPresets,
  presetToValue,
  railStops,
  sortEvents,
} from '../src/core/time';

const presets = defaultEraPresets();

describe('historical axis ordering', () => {
  it('orders war years numerically', () => {
    expect(compareTime(0, 3, presets)).toBeLessThan(0);
    expect(compareTime(121, 170, presets)).toBeLessThan(0);
    expect(compareTime(170, 121, presets)).toBeGreaterThan(0);
    expect(compareTime(7, 7, presets)).toBe(0);
  });

  it('treats era presets as their anchored year', () => {
    expect(compareTime(3, 'bew-3', presets)).toBe(0);
    expect(compareTime('bew-121', 121, presets)).toBe(0);
    expect(compareTime('bew-0', 'bew-170', presets)).toBeLessThan(0);
  });

  it('places PRE-WAR before every war year', () => {
    expect(compareTime('pre-war', 0, presets)).toBeLessThan(0);
    expect(compareTime(0, 'pre-war', presets)).toBeGreaterThan(0);
    expect(compareTime('pre-war', -50, presets)).toBeLessThan(0);
  });

  it('places the Siege Wall era and the main narrative after the war', () => {
    expect(compareTime(170, 'post-siege-wall', presets)).toBeLessThan(0);
    expect(compareTime('post-siege-wall', MAIN_NARRATIVE_PRESET_ID, presets)).toBeLessThan(0);
    expect(compareTime(121, MAIN_NARRATIVE_PRESET_ID, presets)).toBeLessThan(0);
  });

  it('keeps the main narrative undated (no numeric equivalent)', () => {
    const main = presets.find((p) => p.id === MAIN_NARRATIVE_PRESET_ID)!;
    expect(main.time).toBeUndefined();
    expect(describeTime(MAIN_NARRATIVE_PRESET_ID, presets)).toBe(
      'MAIN NARRATIVE — DATE UNSPECIFIED',
    );
  });

  it('the war chronology spans 170 years', () => {
    expect(BLOOD_ECLIPSE_WAR_YEARS).toBe(170);
    const labels = presets.map((p) => p.label).join(' | ');
    expect(labels).toMatch(/YEAR 170/);
    expect(labels).not.toMatch(/YEAR 17(?!\d)/);
  });

  it('atOrBefore is inclusive and total', () => {
    expect(atOrBefore(3, 3, presets)).toBe(true);
    expect(atOrBefore('bew-170', 'post-siege-wall', presets)).toBe(true);
    expect(atOrBefore('post-siege-wall', 170, presets)).toBe(false);
  });

  it('orders unknown era markers after dated anchors without crashing', () => {
    expect(compareTime(170, 'some-future-era', presets)).toBeLessThan(0);
    expect(compareTime('some-future-era', 'another-era', presets)).not.toBeNaN();
    expect(describeTime('some-future-era', presets)).toBe('ERA MARKER “some-future-era”');
  });
});

describe('historical axis presentation', () => {
  it('formats war years with pre/post-war markers', () => {
    expect(formatWarYear(0)).toBe('0');
    expect(formatWarYear(170)).toBe('170');
    expect(formatWarYear(-3)).toBe('-3 (PRE-WAR)');
    expect(formatWarYear(212)).toBe('212 (POST-WAR)');
    expect(describeTime(3, presets)).toBe('YEAR 3');
  });

  it('orders presets along the axis and hides CUSTOM from the rail', () => {
    const ordered = orderedPresets(presets).map((p) => p.id);
    expect(ordered[0]).toBe('pre-war');
    expect(ordered[ordered.length - 1]).toBe('custom');
    const stops = railStops(presets);
    expect(stops.some((s) => s.value === 'custom')).toBe(false);
    expect(stops.map((s) => s.value)).toEqual([
      'pre-war',
      0,
      3,
      121,
      170,
      'post-siege-wall',
      'main-narrative',
    ]);
  });

  it('gives compact rail labels', () => {
    expect(describeTimeShort(121, presets)).toBe('Y121');
    expect(describeTimeShort('bew-3', presets)).toBe('BEW YEAR 3');
    expect(describeTimeShort(MAIN_NARRATIVE_PRESET_ID, presets)).toBe('MAIN NARRATIVE');
  });

  it('finds the nearest named preset', () => {
    expect(nearestPreset(4, presets)?.id).toBe('bew-3');
    expect(nearestPreset(170, presets)?.id).toBe('bew-170');
  });

  it('converts presets to storable values', () => {
    expect(presetToValue(presets.find((p) => p.id === 'bew-121')!)).toBe(121);
    expect(presetToValue(presets.find((p) => p.id === 'pre-war')!)).toBe('pre-war');
  });
});

describe('event ordering', () => {
  it('sorts mixed numeric and named event times chronologically', () => {
    const events = [
      { id: 'c', time: MAIN_NARRATIVE_PRESET_ID },
      { id: 'a', time: 121 },
      { id: 'b', time: 'pre-war' },
      { id: 'd', time: 3 },
    ];
    expect(sortEvents(events, presets).map((e) => e.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('does not mutate the source array', () => {
    const events = [{ id: 'a', time: 170 }, { id: 'b', time: 0 }];
    sortEvents(events, presets);
    expect(events.map((e) => e.id)).toEqual(['a', 'b']);
  });
});
