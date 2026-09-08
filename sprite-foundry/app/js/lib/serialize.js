// serialize.js — project manifest serialization + validation for the
// portable .spriteproject format. Images live outside the manifest as
// media/<imageId>.png inside the archive; the manifest describes everything
// else (structure, lineage, versions, pivots, palettes, references...).
import { uid, createProject } from './model.js';

export const MANIFEST_VERSION = 1;

/** Build the manifest JSON document (no image pixels). */
export function projectToManifest(project) {
  return JSON.parse(JSON.stringify({
    format: 'sprite-foundry-project',
    manifestVersion: MANIFEST_VERSION,
    savedAt: new Date().toISOString(),
    project,
  }));
}

/**
 * Validate a parsed manifest. Throws descriptive errors on malformed input;
 * never returns half-trusted data.
 * Returns { project } on success (normalized clone).
 */
export function manifestFromJson(json) {
  if (!json || typeof json !== 'object') throw new Error('Manifest is not a JSON object');
  if (json.format !== 'sprite-foundry-project') throw new Error(`Not a Sprite Foundry project (format="${json.format}")`);
  if (json.manifestVersion > MANIFEST_VERSION) throw new Error(`Project was saved by a newer version (manifest v${json.manifestVersion} > v${MANIFEST_VERSION})`);
  const p = json.project;
  if (!p || typeof p !== 'object') throw new Error('Manifest has no project payload');
  if (!p.id || typeof p.id !== 'string') p.id = uid('proj');
  if (!Array.isArray(p.characters)) throw new Error('Manifest project.characters is not an array');
  const ids = new Set();
  const checkId = (id, what) => {
    if (typeof id !== 'string' || !id) throw new Error(`${what} is missing an id`);
    if (ids.has(id)) throw new Error(`Duplicate id "${id}" in project (${what}) — refusing to load corrupt data`);
    ids.add(id);
  };
  checkId(p.id, 'project');
  for (const ch of p.characters) {
    if (!ch || typeof ch !== 'object') throw new Error('Malformed character entry');
    checkId(ch.id, `character "${ch.name ?? '?'}"`);
    if (ch.masterImageId != null && typeof ch.masterImageId !== 'string') throw new Error(`Character "${ch.name}" has invalid masterImageId`);
    if (!Array.isArray(ch.animations)) throw new Error(`Character "${ch.name}" animations is not an array`);
    if (!Array.isArray(ch.references ?? [])) throw new Error(`Character "${ch.name}" references is not an array`);
    if (!Array.isArray(ch.candidates ?? [])) ch.candidates = [];
    ch.references = ch.references ?? [];
    for (const ref of ch.references) {
      if (typeof ref.imageId !== 'string') throw new Error(`Reference "${ref.id ?? '?'}" on "${ch.name}" has no imageId`);
      if (!Array.isArray(ref.roles)) throw new Error(`Reference on "${ch.name}" has invalid roles`);
    }
    for (const cand of ch.candidates) {
      if (typeof cand.imageId !== 'string') throw new Error(`Candidate on "${ch.name}" has no imageId`);
    }
    for (const anim of ch.animations) {
      checkId(anim.id, `animation "${anim.name ?? '?'}"`);
      if (!Array.isArray(anim.frames)) throw new Error(`Animation "${anim.name}" frames is not an array`);
      const fps = Number(anim.defaultFPS);
      if (!Number.isFinite(fps) || fps <= 0 || fps > 120) throw new Error(`Animation "${anim.name}" has invalid FPS (${anim.defaultFPS})`);
      if (!['loop', 'once', 'pingpong'].includes(anim.loopMode ?? 'loop')) throw new Error(`Animation "${anim.name}" has invalid loopMode`);
      for (const f of anim.frames) {
        checkId(f.id, `frame of "${anim.name}"`);
        if (typeof f.imageId !== 'string' || !f.imageId) throw new Error(`Frame "${f.name || f.id}" of "${anim.name}" has no imageId`);
        const dims = f.canvasDims;
        if (!dims || !Number.isFinite(dims.w) || !Number.isFinite(dims.h) || dims.w <= 0 || dims.h <= 0 || dims.w > 8192 || dims.h > 8192) {
          throw new Error(`Frame "${f.name || f.id}" of "${anim.name}" has invalid canvas dimensions`);
        }
        const dur = Number(f.duration);
        if (!Number.isFinite(dur) || dur <= 0 || dur > 60000) throw new Error(`Frame "${f.name || f.id}" has invalid duration (${f.duration})`);
        if (f.pivot && (!Number.isFinite(f.pivot.x) || !Number.isFinite(f.pivot.y))) throw new Error(`Frame "${f.name || f.id}" has invalid pivot`);
        if (!Array.isArray(f.versions)) throw new Error(`Frame "${f.name || f.id}" versions is not an array`);
        for (const v of f.versions) if (typeof v.imageId !== 'string') throw new Error(`Frame "${f.name || f.id}" has a version without imageId`);
        if (['draft', 'approved', 'rejected'].includes(f.status) === false) f.status = 'draft';
      }
    }
  }
  if (p.activeCharacterId && !p.characters.find(c => c.id === p.activeCharacterId)) {
    p.activeCharacterId = p.characters[0]?.id ?? null;
  }
  return { project: JSON.parse(JSON.stringify(p)) };
}

/** Collect every image id referenced by a project (used to pack media). */
export function collectImageIds(project) {
  const ids = new Set();
  for (const ch of project.characters) {
    if (ch.masterImageId) ids.add(ch.masterImageId);
    for (const r of ch.references ?? []) ids.add(r.imageId);
    for (const c of ch.candidates ?? []) ids.add(c.imageId);
    for (const anim of ch.animations) {
      for (const f of anim.frames) {
        ids.add(f.imageId);
        for (const v of f.versions ?? []) ids.add(v.imageId);
      }
    }
  }
  try { new Set(ids); } catch { throw new Error('Project contains a null image reference'); }
  return [...ids].filter(Boolean);
}
