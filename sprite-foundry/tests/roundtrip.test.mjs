import test from 'node:test';
import assert from 'node:assert/strict';
import { encodePng, decodePng, encodeApng } from '../app/js/lib/png.js';
import { codec, synthFrame, imgEquals, createImg } from './helpers.mjs';
import { packGrid } from '../app/js/lib/pack.js';
import { gridSlices } from '../app/js/lib/slice.js';
import { blit, extractRect } from '../app/js/lib/img.js';

test('PNG codec round-trip (injected zlib)', () => {
  const img = synthFrame(3, 24, 24);
  const png = encodePng(img, codec);
  const back = decodePng(png, codec);
  assert.ok(imgEquals(img, back));
});

test('GOLDEN ROUND-TRIP: frames → pack grid → PNG → decode → slice → pixel-identical', () => {
  // synthetic deterministic frame set
  const frames = [...Array(6)].map((_, i) => synthFrame(i, 32, 32));
  // pack grid 3x2, no trim (lossless path)
  const entries = frames.map((img, i) => ({ key: `f${i}`, w: img.width, h: img.height }));
  const pack = packGrid(entries, { mode: 'rows', count: 3, padding: 0, borderPadding: 0 });
  const sheet = createImg(pack.width, pack.height);
  frames.forEach((img, i) => {
    const p = pack.placements.get(`f${i}`);
    blit(sheet, img, p.x, p.y);
  });
  // export → PNG bytes → re-import
  const pngBytes = encodePng(sheet, codec);
  assert.ok(pngBytes.length > 8, 'PNG written');
  const imported = decodePng(pngBytes, codec);
  assert.equal(imported.width, pack.width);
  assert.ok(imgEquals(sheet, imported), 'PNG encode/decode must be lossless');
  // slice with the same grid geometry
  const rects = gridSlices({ sheetW: imported.width, sheetH: imported.height, columns: 3, rows: 2 });
  assert.equal(rects.length, 6, 'exactly six frames extracted');
  rects.forEach((rect, i) => {
    const cell = extractRect(imported, rect.x, rect.y, rect.w, rect.h);
    assert.ok(imgEquals(cell, frames[i]), `extracted frame ${i} must be pixel-identical to source frame`);
  });
});

test('APNG encoder produces a parseable multi-frame PNG with acTL', () => {
  const frames = [0, 1, 2].map(i => ({ img: synthFrame(i, 16, 16), delayMs: 100 }));
  const bytes = encodeApng(frames, codec);
  assert.equal(String.fromCharCode(...bytes.subarray(1, 4)), 'PNG');
  const text = [...bytes].map(b => String.fromCharCode(b)).join('');
  assert.ok(text.includes('acTL'), 'contains acTL');
  assert.ok(text.includes('fcTL'), 'contains fcTL');
  assert.ok(text.includes('fdAT'), 'contains fdAT');
});
