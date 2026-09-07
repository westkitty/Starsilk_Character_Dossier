/**
 * Stable id generation.
 *
 * Ids are opaque, unique, and never reused: history entries, timeline events and
 * selection all reference them, and undo/redo restores them verbatim.
 * A deterministic generator can be injected for tests and demo fixtures.
 */

export type IdGenerator = (prefix: string) => string;

let counter = 0;

function randomToken(): string {
  const bytes = new Uint8Array(4);
  const cryptoObj: Crypto | undefined =
    typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (const b of bytes) out += b.toString(36).padStart(2, '0');
  return out.slice(0, 8);
}

/** Non-deterministic generator for interactive authoring. */
export const newId: IdGenerator = (prefix: string) => {
  counter = (counter + 1) % 1_679_616;
  return `${prefix}-${counter.toString(36)}${randomToken()}`;
};

/**
 * Deterministic sequence generator: `createIdGenerator()` yields
 * `ent-a1`, `ent-a2`, … Used by demo fixtures and unit tests so that repeated
 * runs produce byte-identical projects.
 */
export function createIdGenerator(prefixSeed = 0): IdGenerator {
  let n = prefixSeed;
  return (prefix: string) => {
    n += 1;
    return `${prefix}-${n.toString(36).padStart(2, '0')}`;
  };
}

/** Slug helper for readable demo ids ("Fallenstar Prime" → "fallenstar-prime"). */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'entity';
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
