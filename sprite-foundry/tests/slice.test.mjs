import test from 'node:test';
import assert from 'node:assert/strict';
import { gridSlices, detectRegions, parseSheetMetadata } from '../app/js/lib/slice.js';
import { createImg, fillRect } from './helpers.mjs';
import { extractRect } from '../app/js/lib/img.js';
import * as Img from '../app/js/lib/img.js';

test('SLICER ACCEPTANCE: 8-frame 4x2 grid sheet slices to exactly 8 correct frames', () => {
  // build a 4x2 sheet of 16px cells, each cell uniquely tinted
  const cellW = 16, cellH = 16, cols = 4, rows = 2;
  const sheet = createImg(cellW * cols, cellH * rows);
  const expected = [];
  let k = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const color = [(k * 37) % 255, (k * 91) % 255, (k * 53) % 255, 255];
    fillRect(sheet, c * cellW, r * cellH, cellW, cellH, color);
    expected.push(color);
    k++;
  }
  const rects = gridSlices({ sheetW: sheet.width, sheetH: sheet.height, columns: 4, rows: 2 });
  assert.equal(rects.length, 8);
  rects.forEach((rect, i) => {
    const c = i % 4, r = (i / 4) | 0;
    assert.deepEqual(rect, { x: c * cellW, y: r * cellH, w: cellW, h: cellH });
    const cell = extractRect(sheet, rect.x, rect.y, rect.w, rect.h);
    const px = cell.data.slice(0, 4);
    assert.deepEqual([...px], expected[i], `cell ${i} pixel content must match sheet`);
  });
});

test('gridSlices: cell-size mode derives counts; spacing/offset supported', () => {
  const rects = gridSlices({ sheetW: 100, sheetH: 50, cellW: 20, cellH: 20, offsetX: 5, offsetY: 5, spacingX: 2, spacingY: 0 });
  // avail 95x45 → cols = floor((95+2)/22)=4, rows = floor(45/20)=2
  assert.equal(rects.length, 8);
  assert.deepEqual(rects[0], { x: 5, y: 5, w: 20, h: 20 });
  assert.deepEqual(rects[1], { x: 27, y: 5, w: 20, h: 20 });
});

test('gridSlices: throws useful errors on invalid dimensions', () => {
  assert.throws(() => gridSlices({ sheetW: 100, sheetH: 100 }), /either columns\+rows or cell width/);
  assert.throws(() => gridSlices({ sheetW: 100, sheetH: 100, cellW: 500, cellH: 5 }), /does not fit/);
  assert.throws(() => gridSlices({ sheetW: 100, sheetH: 100, offsetX: 200, columns: 2, rows: 2 }), /lies outside/);
});

test('smart detectRegions: finds separated irregular sprites in reading order', () => {
  const sheet = createImg(128, 48);
  fillRect(sheet, 4, 8, 9, 12, [255, 0, 0, 255]);       // sprite A
  fillRect(sheet, 6, 20, 3, 4, [255, 0, 0, 255]);       // A's foot (disjoint part)
  fillRect(sheet, 60, 4, 20, 30, [0, 0, 255, 255]);     // sprite B (bigger)
  fillRect(sheet, 100, 30, 12, 8, [0, 200, 0, 255]);    // sprite C
  const { rects } = detectRegions(sheet, { minSize: 4, mergeRadius: 3 });
  assert.equal(rects.length, 3);
  assert.deepEqual(rects[0], { x: 4, y: 8, w: 9, h: 16 }); // A incl. foot
  assert.deepEqual(rects[1], { x: 60, y: 4, w: 20, h: 30 });
  assert.deepEqual(rects[2], { x: 100, y: 30, w: 12, h: 8 });
});

test('metadata import: aseprite hash format with validation', () => {
  const json = {
    frames: { 'walk_0': { frame: { x: 0, y: 0, w: 16, h: 16 }, spriteSourceSize: { x: 2, y: 1, w: 16, h: 16 }, sourceSize: { w: 20, h: 20 }, duration: 100, pivot: { x: 0.5, y: 1 } } },
    meta: { frameTags: [{ name: 'walk', from: 0, to: 0 }] },
  };
  const out = parseSheetMetadata(json, { sheetW: 64, sheetH: 64 });
  assert.equal(out.frames.length, 1);
  assert.equal(out.frames[0].name, 'walk_0');
  assert.equal(out.frames[0].sourceW, 20);
  assert.equal(out.frames[0].offsetX, 2);
  assert.equal(out.frames[0].durationMs, 100);
  assert.equal(out.tags.length, 1);
});

test('metadata import: rejects coordinates outside the sheet', () => {
  const json = { frames: [{ name: 'bad', x: 50, y: 0, w: 32, h: 16 }] };
  assert.throws(() => parseSheetMetadata(json, { sheetW: 64, sheetH: 64 }), /lies outside/);
  assert.throws(() => parseSheetMetadata({ frames: [] }), /zero frames/);
  assert.throws(() => parseSheetMetadata({ nope: 1 }), /frames/);
});
