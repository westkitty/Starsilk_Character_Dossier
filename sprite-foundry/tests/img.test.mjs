import test from 'node:test';
import assert from 'node:assert/strict';
import * as I from '../app/js/lib/img.js';
import { synthFrame, createImg, fillRect } from './helpers.mjs';

test('trimImage: trims transparency and stores reconstruction metadata', () => {
  const img = createImg(20, 20);
  fillRect(img, 5, 3, 8, 10, [255, 0, 0, 255]);
  const t = I.trimImage(img);
  assert.deepEqual(t.rect, { x: 5, y: 3, w: 8, h: 10 });
  assert.deepEqual(t.sourceOffset, { x: 5, y: 3 });
  assert.deepEqual(t.sourceSize, { w: 20, h: 20 });
  assert.equal(t.img.width, 8);
  // reconstruct
  const recon = createImg(20, 20);
  I.blit(recon, t.img, t.sourceOffset.x, t.sourceOffset.y);
  assert.deepEqual([...recon.data], [...img.data]);
});

test('resizeNearest: doubles without smearing', () => {
  const img = createImg(2, 1);
  I.setPx(img, 0, 0, [255, 0, 0, 255]); I.setPx(img, 1, 0, [0, 0, 255, 255]);
  const up = I.resizeNearest(img, 4, 2);
  assert.deepEqual(I.getPx(up, 1, 1), [255, 0, 0, 255]);
  assert.deepEqual(I.getPx(up, 3, 0), [0, 0, 255, 255]);
});

test('flipHorizontal mirrors pixels', () => {
  const img = createImg(3, 1);
  I.setPx(img, 0, 0, [255, 0, 0, 255]);
  const f = I.flipHorizontal(img);
  assert.deepEqual(I.getPx(f, 2, 0), [255, 0, 0, 255]);
});

test('palette: extract ≤ N, quantize idempotent, drift detect', () => {
  const img = synthFrame(0, 16, 16);
  const pal = I.extractPalette(img, 4);
  assert.ok(pal.length <= 4 && pal.length >= 2);
  const q = I.quantizeToPalette(img, pal);
  // quantized img uses only palette colors (among opaque px)
  const outside = I.colorsOutsidePalette(q, pal, 0);
  assert.equal(outside.length, 0);
  // drift: an image with a color not in palette is flagged
  const drift = I.colorsOutsidePalette(img, [[0, 0, 0]], 24);
  assert.ok(drift.length > 0);
  // exact-palette preservation for already-limited art
  const pal2 = I.extractPalette(img, 999);
  const q2 = I.quantizeToPalette(img, pal2);
  assert.equal(q2.data.length, img.data.length);
  assert.deepEqual([...q2.data.filter((_, i) => i % 4 !== 3)], [...img.data.filter((_, i) => i % 4 !== 3)]);
});

test('quantizeToPalette preserves transparency', () => {
  const img = createImg(4, 4);
  I.setPx(img, 1, 1, [200, 10, 10, 255]);
  const q = I.quantizeToPalette(img, [[200, 0, 0], [0, 200, 0]]);
  assert.deepEqual(I.getPx(q, 1, 1), [200, 0, 0, 255]);
  assert.deepEqual(I.getPx(q, 0, 0), [0, 0, 0, 0]);
});

test('hard alpha, halo count, strays, chroma key, bg detect, extrude', () => {
  const img = createImg(8, 8);
  fillRect(img, 2, 2, 4, 4, [255, 255, 255, 255]);
  I.setPx(img, 1, 1, [255, 255, 255, 80]);   // semi-transparent halo
  I.setPx(img, 7, 7, [255, 255, 255, 255]);  // stray pixel
  assert.equal(I.semiAlphaCount(img), 1);
  const hard = I.hardAlpha(img, 128);
  assert.equal(I.getPx(hard, 1, 1)[3], 0);
  assert.equal(I.findStrayPixels(img).length, 1);
  const { img: cleaned, removed } = I.removeStrayPixels(img);
  assert.equal(removed, 1);
  assert.equal(I.getPx(cleaned, 7, 7)[3], 0);
  // chroma key on white bg
  const keyed = I.chromaKey(img, [255, 255, 255], 16);
  assert.equal(I.alphaBBox(keyed), null);
  // bg detect
  const bg = I.detectBackgroundColor(I.solidImg(4, 4, [10, 20, 30, 255]));
  assert.deepEqual(bg, [10, 20, 30]);
  // extrude copies edge outward
  const one = I.solidImg(2, 2, [9, 9, 9, 255]);
  const ex = I.extrude(one, 3);
  assert.equal(ex.width, 8);
  assert.deepEqual(I.getPx(ex, 0, 0), [9, 9, 9, 255]);
  assert.deepEqual(I.getPx(ex, 7, 7), [9, 9, 9, 255]);
});

test('phash detects duplicates vs differences; silhouetteIoU', () => {
  const a = synthFrame(0, 32, 32);
  const same = I.cloneImg(a);
  assert.ok(I.hamming(I.phash(a), I.phash(same)) <= 2);
  const other = synthFrame(2, 32, 32);
  assert.ok(I.hamming(I.phash(a), I.phash(other)) > 4);
  assert.equal(I.silhouetteIoU(a, same), 1);
  assert.ok(I.silhouetteIoU(a, other) < 1);
});
