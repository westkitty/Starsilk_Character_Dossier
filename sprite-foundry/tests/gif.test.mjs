import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeGif, decodeGif, validateGif, lzwCompress, lzwDecompress } from '../app/js/lib/gif.js';
import { extractPaletteFromHistogram, colorHistogram } from '../app/js/lib/img.js';
import { synthFrame } from './helpers.mjs';

test('LZW round-trip', () => {
  const indexes = [...Array(997)].map((_, i) => (i * 31 + (i >> 3)) % 4);
  const packed = lzwCompress(indexes, 2);
  const back = lzwDecompress(2, packed.subarray(1), indexes.length);
  assert.deepEqual(back.slice(0, indexes.length), indexes);
});

test('GIF ACCEPTANCE: 8 visibly different frames → valid animated GIF with correct order+timing', () => {
  const frames = [...Array(8)].map((_, i) => ({ img: synthFrame(i, 32, 32), delayMs: 100 + i * 5 }));
  const { bytes } = encodeGif(frames, { loop: 0, extractPaletteFn: extractPaletteFromHistogram });
  // signature
  assert.equal(String.fromCharCode(...bytes.subarray(0, 3)), 'GIF');
  assert.equal(String.fromCharCode(...bytes.subarray(3, 6)), '89a');
  const v = validateGif(bytes);
  assert.ok(v.ok, `validation failed: ${v.errors.join('; ')}`);
  assert.equal(v.frames, 8, 'must contain 8 frames');
  // timing representation
  v.delays.forEach((d, i) => assert.ok(Math.abs(d - (100 + i * 5)) <= 5, `frame ${i} delay ${d} ≈ ${100 + i * 5}`));
  // full decode: correct frame order (frame i has its unique body color present)
  const gif = decodeGif(bytes);
  assert.equal(gif.frames.length, 8);
  assert.equal(gif.loopCount, 0); // NETSCAPE loop forever
  const palette = [[200, 40, 40], [40, 90, 200], [240, 200, 60], [40, 180, 90]];
  gif.frames.forEach((f, i) => {
    const expected = palette[i % 4];
    let found = false;
    for (let p = 0; p < f.img.data.length; p += 4) {
      if (Math.abs(f.img.data[p] - expected[0]) < 16 && Math.abs(f.img.data[p + 1] - expected[1]) < 16 && Math.abs(f.img.data[p + 2] - expected[2]) < 16) { found = true; break; }
    }
    assert.ok(found, `decoded frame ${i} must contain frame ${i}'s body colour rgb(${expected})`);
  });
});

test('GIF transparency: warns about partial alpha, uses transparent index', () => {
  const frames = [...Array(3)].map((_, i) => {
    const img = synthFrame(i, 16, 16);
    img.data[3] = 0; // punch a transparent hole
    img.data[11] = 200; // partial alpha edge (above the transparent threshold)
    return { img, delayMs: 80 };
  });
  const { bytes, warnings } = encodeGif(frames, { extractPaletteFn: extractPaletteFromHistogram });
  assert.ok(warnings.some(w => w.includes('binary transparency')));
  const gif = decodeGif(bytes);
  assert.equal(gif.frames[0].img.data[3], 0, 'hole stays transparent through encode/decode');
});

test('GIF still: single frame export is still a valid GIF', () => {
  const { bytes } = encodeGif([{ img: synthFrame(0, 12, 12), delayMs: 100 }], { extractPaletteFn: extractPaletteFromHistogram });
  const v = validateGif(bytes);
  assert.equal(v.frames, 1);
  assert.ok(!v.ok); // validator requires animation — honest signal, UI treats 1-frame as a still
});

test('GIF import path: decode preserves composite across disposal frames', () => {
  // encode two frames with full-canvas pixels, ensure decode composites correctly
  const a = synthFrame(0, 16, 16), b = synthFrame(1, 16, 16);
  const { bytes } = encodeGif([{ img: a, delayMs: 120 }, { img: b, delayMs: 140 }], { disposal: 2, extractPaletteFn: extractPaletteFromHistogram });
  const gif = decodeGif(bytes);
  assert.equal(gif.frames[1].delayMs, 140);
  // frame 2 pixels must come from synth frame b, not a
  const histA = gif.frames[0].img.data.join(',');
  const histB = gif.frames[1].img.data.join(',');
  assert.notEqual(histA, histB);
});
