/**
 * ORBITAL SIMULATION TIME — clock #1.
 *
 * A pure, monotonic clock that only governs motion: revolution, rotation, trails,
 * animation speed. It has nothing to do with historical eras (`core/time.ts`),
 * which decide what exists. Pausing this clock must never stop era scrubbing.
 */

import type { OrbitalElements } from './types';

export const SPEED_PRESETS: readonly number[] = [0.1, 1, 10, 100] as const;

/** Authored days that elapse per real second at 1× speed. */
export const DAYS_PER_SIM_SECOND = 50;

export function labelForSpeed(speed: number): string {
  if (speed <= 0) return 'PAUSED';
  if (!Number.isInteger(speed)) return `${speed}×`;
  return `${speed}×`;
}

export interface SimulationSnapshot {
  /** Elapsed simulated seconds (already speed-scaled). */
  time: number;
  speed: number;
  paused: boolean;
}

export class SimulationClock {
  time = 0;
  speed = 1;
  paused = false;

  private listeners = new Set<(snapshot: SimulationSnapshot) => void>();

  constructor(options: { speed?: number; paused?: boolean } = {}) {
    if (typeof options.speed === 'number' && options.speed > 0) this.speed = options.speed;
    this.paused = options.paused ?? false;
  }

  subscribe(listener: (snapshot: SimulationSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snapshot = this.snapshot();
    for (const listener of [...this.listeners]) listener(snapshot);
  }

  /** Advance by a real-time delta (seconds). Ignored while paused. */
  advance(deltaSeconds: number): void {
    if (this.paused || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    // Clamp so a backgrounded tab cannot teleport the whole galaxy.
    const clamped = Math.min(deltaSeconds, 0.25);
    this.time += clamped * this.speed;
  }

  setSpeed(speed: number): void {
    if (!Number.isFinite(speed) || speed <= 0) return;
    if (this.speed === speed) return;
    this.speed = speed;
    if (this.paused) this.setPaused(false);
    this.emit();
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.emit();
  }

  togglePaused(): void {
    this.setPaused(!this.paused);
  }

  setTime(time: number): void {
    if (!Number.isFinite(time)) return;
    this.time = Math.max(0, time);
    this.emit();
  }

  reset(): void {
    this.time = 0;
    this.emit();
  }

  /** Authored days elapsed at the current clock reading. */
  get days(): number {
    return this.time * DAYS_PER_SIM_SECOND;
  }

  snapshot(): SimulationSnapshot {
    return { time: this.time, speed: this.speed, paused: this.paused };
  }
}

/** Mean anomaly (degrees) of an orbit at a given authored day count. */
export function meanAnomalyAt(elements: OrbitalElements, days: number): number {
  if (!Number.isFinite(elements.period) || elements.period <= 0) return elements.meanAnomalyAtEpoch;
  const revolutions = (days - elements.epoch) / elements.period;
  return elements.meanAnomalyAtEpoch + 360 * revolutions;
}
