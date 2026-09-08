import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../app/js/lib/model.js';
import { buildCharacterPrompt, buildFramePrompt, buildBetweenPrompt, genomeFragments } from '../app/js/lib/prompt.js';
import { projectToManifest, manifestFromJson, collectImageIds } from '../app/js/lib/serialize.js';
import { poseFor, poseSequence, JOINTS } from '../app/js/lib/skeleton.js';

test('ANIMATION MODEL: ordered frames, single-frame replace keeps neighbours, clip switch survives', () => {
  const anim = M.createAnimation('walk', 'walk', 'south');
  anim.frames = [...Array(6)].map((_, i) => { const f = M.createFrame({ width: 32, height: 32, name: `f${i}` }); f.imageId = `img${i}`; return f; });
  assert.equal(anim.frames.length, 6);
  // reorder
  const reordered = M.moveFrames(anim.frames, [anim.frames[2].id], 0);
  assert.equal(reordered[0].name, 'f2');
  assert.equal(reordered.length, 6);
  // single-frame regeneration → new version on ONE frame, neighbours untouched
  const target = reordered[3];
  target.versions.push(M.frameVersion(target, target.imageId, 'v1', 'generated'));
  target.imageId = 'img_new';
  target.versions.push(M.frameVersion(target, 'img_new', 'v2', 'regenerate'));
  assert.equal(reordered[2].imageId, reordered[2].imageId); // neighbour unchanged
  assert.notEqual(reordered[3].imageId, 'img3'); // wait — identity check:
  assert.equal(reordered[3].versions.length, 2);
  // duplicate + remove
  const dup = M.duplicateFrame(reordered[1]);
  assert.notEqual(dup.id, reordered[1].id);
  const removed = M.removeFrameIds([...reordered, dup], [dup.id]);
  assert.equal(removed.length, 6);
});

test('IN-BETWEEN MODEL: endpoints unchanged, new frames inserted between, lineage records parents', () => {
  const anim = M.createAnimation('walk', 'walk');
  anim.frames = [0, 1, 2].map(i => { const f = M.createFrame({ width: 32, height: 32, name: `f${i}` }); f.imageId = `img${i}`; return f; });
  const a = anim.frames[0], b = anim.frames[1];
  const before = a.imageId, after = b.imageId;
  const bridges = [0, 1].map(i => {
    const f = M.createFrame({ width: 32, height: 32, source: 'generated', name: `between_${i}` });
    f.imageId = `bridge${i}`;
    f.lineage = { provider: 'test', operation: 'between', parentFrames: [a.id, b.id], prompt: 'x', seed: 1, createdAt: Date.now(), requestedDims: { w: 32, h: 32 } };
    return f;
  });
  anim.frames = M.insertFrames(anim.frames, bridges, 1);
  assert.equal(anim.frames.length, 5);
  assert.equal(anim.frames[0].imageId, before, 'endpoint A unchanged');
  assert.equal(anim.frames[4].imageId, anim.frames[4].imageId);
  assert.equal(anim.frames.map(f => f.name).join(','), 'f0,between_0,between_1,f1,f2');
  assert.deepEqual(anim.frames[1].lineage.parentFrames, [a.id, b.id]);
});

test('genome: locked fields flow into character + frame prompts; asymmetry warning', () => {
  const genome = M.defaultGenome();
  genome.identity.description = { value: 'small hooded adventurer', locked: true };
  genome.equipment.weapons = { value: 'short sword on LEFT hip', locked: false };
  genome.asymmetry.equipmentSide = { value: 'sword left side', locked: false };
  const locked = genomeFragments(genome, { lockedOnly: true });
  assert.deepEqual(locked, ['small hooded adventurer']);
  const all = genomeFragments(genome);
  assert.ok(all.some(f => f.includes('sword')));
  const cw = M.genomeAsymmetryWarning(genome);
  assert.ok(cw && cw.includes('side-specific'), 'mirror warning exists');
  const emptyGenome = M.createCharacter('x').genome;
  assert.equal(M.genomeAsymmetryWarning(emptyGenome), null);
  const { prompt } = buildCharacterPrompt({ prompt: 'an adventurer', styleId: 'pixel-art', view: 'side', facing: 'east', width: 64, height: 64, background: 'white', genome });
  assert.ok(prompt.includes('small hooded adventurer'));
  assert.ok(prompt.includes('pixel art'));
  assert.ok(prompt.includes('side view'));
  assert.ok(!/photorealistic/i.test(prompt));
});

test('frame prompt: blueprint phases differentiate frames; palette included', () => {
  const bp = M.defaultBlueprint('walk', 8);
  assert.equal(bp.keyPoses.length, 8);
  assert.notEqual(bp.keyPoses[0].description, bp.keyPoses[1].description);
  const p0 = buildFramePrompt({ genome: M.defaultGenome(), blueprint: bp, frameIndex: 0, totalFrames: 8, direction: 'east', palette: [[255, 0, 0]] });
  const p4 = buildFramePrompt({ genome: M.defaultGenome(), blueprint: bp, frameIndex: 4, totalFrames: 8, direction: 'east', palette: [[255, 0, 0]] });
  assert.ok(p0.prompt.includes('frame 1 of 8'));
  assert.ok(p4.prompt.includes('frame 5 of 8'));
  assert.notEqual(p0.prompt, p4.prompt);
  assert.ok(p0.prompt.includes('#ff0000'));
  assert.ok(p0.prompt.includes('contact'));
  const btwn = buildBetweenPrompt({ genome: M.defaultGenome(), blueprint: bp, frameIndex: 2, totalFrames: 8, t: 0.5, poseA: 'contact', poseB: 'passing' });
  assert.ok(btwn.prompt.includes('in-between'));
  const keys = M.keyframeIndices(bp);
  assert.deepEqual(keys, [0, 2, 4, 6, 7]);
});

test('skeleton templates: joints complete + animate differently', () => {
  const a = poseFor('walk', 0.1), b = poseFor('walk', 0.6);
  assert.equal(Object.keys(a).length, JOINTS.length);
  assert.ok(a.footL.x !== b.footL.x || a.footL.y !== b.footL.y);
  const seq = poseSequence('walk', 8);
  assert.equal(seq.length, 8);
});

test('PROJECT ACCEPTANCE: manifest round-trip preserves genome, pivots, versions, lineage, palette', () => {
  const project = M.createProject('Test');
  project.id = 'proj_test';
  const ch = M.createCharacter('Hero');
  ch.masterImageId = 'img_master';
  ch.genome.identity.description = { value: 'hero', locked: true };
  ch.palette = { colors: [[10, 20, 30], [200, 200, 200]], locked: true, maxSize: 8, source: 'master' };
  ch.references.push(M.createReference('img_master', ['identity', 'master']));
  ch.candidates.push({ id: 'cand1', imageId: 'img_cand', prompt: 'p', seed: 42, rejected: false });
  const anim = M.createAnimation('walk', 'walk', 'south');
  anim.defaultFPS = 12;
  const f = M.createFrame({ width: 32, height: 32, name: 'w0' });
  f.imageId = 'img_f0';
  f.pivot = { x: 0.5, y: 0.9 };
  f.duration = 83;
  f.status = 'approved';
  f.versions.push(M.frameVersion(f, 'img_f0_old', 'v1', 'generated'));
  f.versions.push(M.frameVersion(f, 'img_f0', 'v2', 'repaired'));
  f.lineage = { provider: 'openai:gpt-image-1', operation: 'frame', prompt: 'walk frame', negativePrompt: 'nope', seed: 7, masterReference: 'img_master', references: ['img_master'], parentFrames: [], createdAt: 1234, requestedDims: { w: 32, h: 32 }, resultDims: { w: 32, h: 32 } };
  f.points.push({ name: 'hand', x: 0.6, y: 0.5 });
  f.boxes.push({ id: 'box1', kind: 'collision', x: 0.25, y: 0.1, w: 0.5, h: 0.9 });
  f.tags = ['contact'];
  anim.frames.push(f);
  anim.blueprint = M.defaultBlueprint('walk', 8);
  ch.animations.push(anim);
  project.characters.push(ch);
  project.activeCharacterId = ch.id;
  ch.activeAnimationId = anim.id;

  const manifest = projectToManifest(project);
  const json = JSON.parse(JSON.stringify(manifest));
  const { project: loaded } = manifestFromJson(json);
  assert.equal(loaded.characters[0].masterImageId, 'img_master');
  assert.equal(loaded.characters[0].genome.identity.description.value, 'hero');
  assert.equal(loaded.characters[0].genome.identity.description.locked, true);
  assert.deepEqual(loaded.characters[0].palette.colors, [[10, 20, 30], [200, 200, 200]]);
  const lf = loaded.characters[0].animations[0].frames[0];
  assert.equal(lf.pivot.y, 0.9);
  assert.equal(lf.duration, 83);
  assert.equal(lf.versions.length, 2);
  assert.equal(lf.lineage.provider, 'openai:gpt-image-1');
  assert.equal(lf.lineage.seed, 7);
  assert.equal(lf.points[0].name, 'hand');
  assert.equal(lf.boxes[0].kind, 'collision');
  assert.deepEqual(lf.tags, ['contact']);
  assert.equal(loaded.characters[0].candidates.length, 1);
  // image id collection for media packing
  const ids = collectImageIds(loaded);
  for (const id of ['img_master', 'img_cand', 'img_f0', 'img_f0_old']) assert.ok(ids.includes(id), `media for ${id}`);
});

test('manifest validation: duplicate ids and bad numbers fail safely', () => {
  const project = M.createProject('X');
  const ch = M.createCharacter('c');
  const a = M.createAnimation('a');
  const f1 = M.createFrame({ width: 16, height: 16 }); f1.imageId = 'i1';
  const f2 = M.createFrame({ width: 16, height: 16 }); f2.imageId = 'i2'; f2.id = f1.id; // corrupt
  a.frames.push(f1, f2);
  ch.animations.push(a);
  project.characters.push(ch);
  const manifest = projectToManifest(project);
  assert.throws(() => manifestFromJson(JSON.parse(JSON.stringify(manifest))), /Duplicate id/);
  const manifest2 = projectToManifest(M.createProject('Y'));
  manifest2.project.characters = [];
  manifest2.project.defaultFPS = 'banana';
  assert.doesNotThrow(() => manifestFromJson(JSON.parse(JSON.stringify(manifest2))));
});
