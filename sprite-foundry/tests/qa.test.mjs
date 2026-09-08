import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeClip, inspectClip, loopSeamReport } from '../app/js/lib/qa.js';
import { synthFrame, createImg } from './helpers.mjs';
import { cloneImg, fillRect, resizeNearest } from '../app/js/lib/img.js';

const desc = (img, i) => ({ id: `f${i}`, name: `f${i}`, meta: { w: img.width, h: img.height } });

test('QA: clean sequence produces no scale/bbox warnings', () => {
  const frames = [0, 1, 2, 3].map(i => synthFrame(i, 32, 32));
  const imgs = frames.map((f, i) => ({ ...desc(f, i), duration: 100, pivot: { x: 0.5, y: 1 } }));
  const warnings = analyzeClip(imgs, f => frames[Number(f.id.slice(1))]);
  assert.equal(warnings.filter(w => w.kind === 'scale').length, 0);
  assert.equal(warnings.filter(w => w.kind === 'empty').length, 0);
});

test('QA: detects duplicate, empty, bbox jump, palette drift, dims mismatch', () => {
  const good = synthFrame(0, 32, 32);
  const dup = cloneImg(good);
  const tall = createImg(32, 32); fillRect(tall, 4, 0, 24, 32, [9, 9, 9, 255]);
  const empty = createImg(32, 32);
  const weirdSize = synthFrame(1, 40, 40);
  const frames = [good, dup, tall, empty, weirdSize];
  const imgs = frames.map((f, i) => ({ id: `f${i}`, name: `f${i}`, meta: { w: f.width, h: f.height }, pivot: { x: 0.5, y: 1 } }));
  const palette = [[200, 40, 40]]; // very restrictive → drift expected
  const warnings = analyzeClip(imgs, f => frames[Number(f.id.slice(1))], { palette });
  const kinds = warnings.map(w => w.kind);
  assert.ok(kinds.includes('duplicate'), 'duplicate warning');
  assert.ok(kinds.includes('empty'), 'empty warning');
  assert.ok(kinds.includes('dims'), 'dimension mismatch warning');
  assert.ok(kinds.includes('palette'), 'palette drift warning');
  const bbox = warnings.find(w => w.kind === 'bbox');
  assert.ok(bbox, 'bbox jump warning');
});

test('inspectClip: deterministic production review (no fake AI score)', () => {
  const frames = [0, 1].map(i => synthFrame(i, 32, 32));
  const clip = {
    frames: frames.map((f, i) => ({ id: `f${i}`, name: `f${i}`, canvasDims: { w: 32, h: 32 }, duration: 100, status: i ? 'draft' : 'approved', meta: { w: 32, h: 32 } })),
    loopMode: 'loop', defaultFPS: 10,
  };
  const report = inspectClip(clip, f => frames[Number(f.id.slice(1))]);
  assert.equal(report.frameCount, 2);
  assert.equal(report.durationMs, 200);
  assert.equal(report.loopMs, 200);
  assert.equal(report.drafts, 1);
  assert.ok(report.summary && typeof report.summary === 'object');
  assert.ok(!('score' in report), 'must not invent a quality score');
});

test('loopSeamReport: flags drifted seam, passes consistent seam', () => {
  const ok = [synthFrame(0, 32, 32), synthFrame(0, 32, 32)];
  const clipOk = { frames: ok.map((f, i) => ({ id: `f${i}`, name: `f${i}` })), loopMode: 'loop' };
  const r1 = loopSeamReport(clipOk, f => ok[Number(f.id.slice(1))]);
  assert.ok(r1.ok);
  const badA = synthFrame(0, 48, 48), badB = createImg(48, 48);
  fillRect(badB, 0, 30, 10, 10, [255, 255, 255, 255]);
  const clipBad = { frames: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }] };
  const r2 = loopSeamReport(clipBad, f => (f.id === 'a' ? badA : badB));
  assert.ok(!r2.ok);
  assert.ok(r2.issues.length > 0);
});
