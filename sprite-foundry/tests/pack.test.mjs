import test from 'node:test';
import assert from 'node:assert/strict';
import { packAtlas, packGrid, placementsOverlap, buildSheetMetadata, toAsepriteJson, toPhaserJson } from '../app/js/lib/pack.js';
import { trimImage, blit, extractRect, createImg } from '../app/js/lib/img.js';
import { synthFrame, imgEquals } from './helpers.mjs';

test('ATLAS ACCEPTANCE: differently sized trimmed sprites pack without overlap, metadata reconstructs alignment', () => {
  const frames = [0, 1, 2, 3, 4].map(i => synthFrame(i));
  const entries = frames.map((img, i) => {
    const t = trimImage(img);
    return { key: `f${i}`, img: t.img, w: t.img.width, h: t.img.height, rect: t.rect, offset: t.sourceOffset, source: t.sourceSize };
  });
  const pack = packAtlas(entries, { padding: 2, borderPadding: 1, powerOfTwo: true, maxWidth: 512, maxHeight: 512 });
  assert.ok(!placementsOverlap(pack.placements), 'rectangles must not overlap');
  assert.ok(pack.width <= 512 && pack.height <= 512);
  assert.equal(Math.log2(pack.width) % 1, 0, 'power of two width');
  // reconstruct: draw trimmed image at placement + sourceOffset and compare to original
  const sheet = createImg(pack.width, pack.height);
  for (const e of entries) {
    const p = pack.placements.get(e.key);
    blit(sheet, e.img, p.x, p.y);
  }
  for (const [i, e] of entries.entries()) {
    const p = pack.placements.get(e.key);
    // reconstruct original canvas: extract p rect, blit onto source-size canvas at offset
    const pasted = extractRect(sheet, p.x, p.y, p.w, p.h);
    const recon = createImg(e.source.w, e.source.h);
    blit(recon, pasted, e.offset.x, e.offset.y);
    assert.ok(imgEquals(recon, frames[i]), `frame ${i} must reconstruct pixel-perfect after trim+pack`);
  }
  // metadata must match atlas placement
  const items = entries.map((e, i) => ({
    name: e.key, index: i, key: e.key, sourceW: e.source.w, sourceH: e.source.h,
    sourceOffset: e.offset, pivot: { x: 0.5, y: 1 }, durationMs: 100,
  }));
  const meta = buildSheetMetadata({ project: 'p', character: 'c', animation: 'walk', direction: 'south', width: pack.width, height: pack.height, items, placements: pack.placements });
  for (const [i, f] of meta.frames.entries()) {
    const p = pack.placements.get(`f${i}`);
    assert.equal(f.x, p.x); assert.equal(f.y, p.y);
    assert.equal(f.w, p.w); assert.equal(f.h, p.h);
    assert.equal(f.sourceW, entries[i].source.w);
    assert.equal(f.offsetX, entries[i].offset.x);
    assert.equal(f.pivotX, 0.5); assert.equal(f.pivotY, 1);
  }
  // aseprite + phaser presets derived from the same numbers
  const ase = toAsepriteJson(meta);
  const ph = toPhaserJson(meta);
  assert.equal(Object.keys(ase.frames).length, 5);
  assert.equal(Object.keys(ph.frames).length, 5);
  for (const key of Object.keys(ase.frames)) {
    assert.deepEqual(ase.frames[key].frame, { x: ph.frames[key].frame.x, y: ph.frames[key].frame.y, w: ph.frames[key].frame.w, h: ph.frames[key].frame.h });
  }
});

test('grid pack: horizontal strip + POT + occupancy basics', () => {
  const frames = [0, 1, 2].map(i => ({ key: `k${i}`, w: 16, h: 24 }));
  const g = packGrid(frames, { mode: 'horizontal', padding: 1, borderPadding: 2 });
  assert.equal(g.width, 2 * 2 + 16 * 3 + 2);
  assert.equal(g.height, 2 * 2 + 24);
  assert.ok(!placementsOverlap(g.placements));
  const pot = packGrid(frames, { mode: 'rows', count: 2, powerOfTwo: true });
  assert.equal(Math.log2(pot.width) % 1, 0);
  assert.equal(Math.log2(pot.height) % 1, 0);
});

test('packAtlas: refuses when impossible', () => {
  const frames = [{ key: 'huge', w: 4000, h: 4000 }, { key: 'huge2', w: 4000, h: 4000 }];
  assert.throws(() => packAtlas(frames, { maxWidth: 4098, maxHeight: 4100 }), /Atlas too large|Could not fit/);
});

test('packAtlas: pivot serialization preserved through metadata', () => {
  const entries = [{ key: 'a', w: 8, h: 8 }];
  const pack = packAtlas(entries, {});
  const meta = buildSheetMetadata({ width: pack.width, height: pack.height, items: [{ name: 'a', index: 0, key: 'a', sourceW: 8, sourceH: 8, sourceOffset: { x: 0, y: 0 }, pivot: { x: 0.25, y: 0.75 }, durationMs: 40 }], placements: pack.placements });
  const roundtripped = JSON.parse(JSON.stringify(meta));
  assert.equal(roundtripped.frames[0].pivotX, 0.25);
  assert.equal(roundtripped.frames[0].pivotY, 0.75);
  assert.equal(roundtripped.frames[0].durationMs, 40);
});
