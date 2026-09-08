// model.js — project model factories + pure frame-list operations.
// No DOM, no canvas here: everything is serializable data + pure functions.

let uidCounter = 0;
export function uid(prefix = 'id') {
  uidCounter = (uidCounter + 1) % 1679615;
  return `${prefix}_${Date.now().toString(36)}_${uidCounter.toString(36)}`;
}

export const ANIMATION_TYPES = [
  'idle', 'walk', 'run', 'sprint', 'crouch', 'jump', 'fall', 'land',
  'attack', 'heavy-attack', 'block', 'dodge', 'cast', 'interact', 'hurt', 'death', 'custom',
];

export const DIRECTIONS_8 = ['south', 'southwest', 'west', 'northwest', 'north', 'northeast', 'east', 'southeast'];
export const DIRECTIONS_4 = ['south', 'west', 'north', 'east'];
export const MIRROR_PAIRS = { west: 'east', east: 'west', southwest: 'southeast', southeast: 'southwest', northwest: 'northeast', northeast: 'northwest' };

export const STYLE_PRESETS = [
  { id: 'pixel-art', label: 'Pixel Art', prompt: 'clean pixel art, crisp single pixels, limited palette, no anti-aliasing' },
  { id: '8-bit', label: '8-bit', prompt: 'retro 8-bit console style pixel art, chunky pixels, 4-color ramp feel (visual style only, not hardware emulation)' },
  { id: '16-bit', label: '16-bit', prompt: 'retro 16-bit era pixel art, richer shading, small dithered gradients (visual style only)' },
  { id: 'snes', label: 'SNES-era', prompt: '1990s 16-bit console RPG sprite look, soft shading, modest palette (visual starting point, not hardware-accurate)' },
  { id: 'gba', label: 'GBA-era', prompt: 'handheld 2000s pixel-art look, bright saturated palettes, compact sprites (visual starting point)' },
  { id: '32-bit', label: '32-bit pixel', prompt: 'late-90s high-color pixel art with detailed shading (visual style only)' },
  { id: 'clean-2d', label: 'Clean 2D game sprite', prompt: 'clean modern 2D game sprite, smooth vector-like shading, readable silhouette' },
  { id: 'cel', label: 'Cel-shaded', prompt: 'cel-shaded 2D illustration, flat color regions with hard shadow shapes' },
  { id: 'illustrated', label: 'Illustrated 2D', prompt: 'hand-painted 2D character illustration, soft brushes' },
  { id: 'custom', label: 'Custom', prompt: '' },
];

// ---------------------------------------------------------------- genome

export function defaultGenome() {
  const f = (value = '', locked = false) => ({ value, locked });
  return {
    identity: { description: f(), bodyType: f(), proportions: f(), apparentAge: f(), silhouette: f() },
    face: { headShape: f(), eyes: f(), hair: f(), ears: f(), facialFeatures: f() },
    body: { torso: f(), limbs: f(), handsFeet: f(), anatomyRules: f() },
    clothing: { garments: f(), colors: f(), materials: f() },
    equipment: { weapons: f(), props: f(), accessories: f() },
    visual: { palette: f(), outlineStyle: f(), lighting: f(), renderingStyle: f(), camera: f(), scale: f() },
    asymmetry: { scars: f(''), patches: f(''), equipmentSide: f(''), handedness: f(''), markings: f(''), textLogos: f('') },
    forbidden: { neverChange: f('') },
  };
}

export const GENOME_SECTIONS = {
  identity: { label: 'Identity', fields: { description: 'Character description', bodyType: 'Body type', proportions: 'Proportions', apparentAge: 'Apparent age', silhouette: 'Silhouette' } },
  face: { label: 'Face / Head', fields: { headShape: 'Head shape', eyes: 'Eyes', hair: 'Hair / fur', ears: 'Ears', facialFeatures: 'Facial features' } },
  body: { label: 'Body', fields: { torso: 'Torso', limbs: 'Limbs', handsFeet: 'Hands / feet', anatomyRules: 'Anatomy rules' } },
  clothing: { label: 'Clothing', fields: { garments: 'Garments', colors: 'Colors', materials: 'Materials' } },
  equipment: { label: 'Equipment', fields: { weapons: 'Weapons', props: 'Props', accessories: 'Accessories' } },
  visual: { label: 'Visual locks', fields: { palette: 'Palette', outlineStyle: 'Outline style', lighting: 'Lighting', renderingStyle: 'Rendering style', camera: 'Camera', scale: 'Scale' } },
  asymmetry: { label: 'Asymmetry', fields: { scars: 'Scars', patches: 'Patches', equipmentSide: 'Equipment side', handedness: 'Handedness', markings: 'Markings', textLogos: 'Text / logos' } },
  forbidden: { label: 'Forbidden drift', fields: { neverChange: 'Features that must never change' } },
};

/** Does the genome describe side-specific features that make mirroring risky? */
export function genomeAsymmetryWarning(genome) {
  const a = genome?.asymmetry || {};
  const parts = Object.entries(a).filter(([, v]) => (v?.value || '').trim().length > 0).map(([k]) => k);
  if (!parts.length) return null;
  return `This character has side-specific features (${parts.join(', ')}). Mirroring directions may produce incorrect equipment/markings/text. Review mirrored frames before approving.`;
}

// ---------------------------------------------------------------- project

export function createProject(name = 'Untitled Project') {
  return {
    schemaVersion: 1,
    id: uid('proj'),
    name,
    createdAt: Date.now(),
    characters: [],
    activeCharacterId: null,
    settings: {
      previewBg: 'checkerboard',
      customBg: '#8866aa',
      pixelArtMode: true,
    },
  };
}

export function createCharacter(name) {
  return {
    id: uid('char'),
    name: name || `Character ${Math.floor(Math.random() * 1000)}`,
    masterImageId: null,
    masterSource: null,
    genome: defaultGenome(),
    palette: { colors: [], locked: false, maxSize: 16, source: 'none' },
    references: [],
    animations: [],
    activeAnimationId: null,
    candidates: [],
    sprites: { pendingFrameCount: 0 },
  };
}

export function createAnimation(name, type = 'custom', direction = 'south') {
  return {
    id: uid('anim'),
    name: name || type,
    type,
    direction,
    loopMode: 'loop', // loop | once | pingpong
    defaultFPS: 8,
    frames: [],
    tags: [],
    blueprint: null,
    groundY: null, // normalized 0..1 of canvas height
    createdAt: Date.now(),
  };
}

export function createFrame({ width, height, source = 'generated', duration = 125, name = '' }) {
  return {
    id: uid('frame'),
    name,
    imageId: null,          // current version's image (set by image store)
    source,                 // generated | imported | sliced | uploaded | mirrored | derived
    sourceDims: { w: width, h: height },
    canvasDims: { w: width, h: height },
    duration,
    pivot: { x: 0.5, y: 1.0 }, // normalized to canvas, bottom-center default
    offset: { x: 0, y: 0 },    // stabilization offset (non-destructive, px)
    flipX: false,
    status: 'draft',           // draft | approved | rejected
    tags: [],
    versions: [],              // [{ id, imageId, label, createdAt, op }]
    lineage: null,             // set by generation pipeline
    boxes: [],                 // [{ id, kind: collision|hurt|attack|interact, x,y,w,h }] (normalized)
    points: [],                // [{ name, x, y }] normalized
  };
}

export function frameVersion(frame, imageId, label, op) {
  return { id: uid('ver'), imageId, label, createdAt: Date.now(), op };
}

export function createReference(imageId, roles = ['identity'], name = '') {
  return { id: uid('ref'), imageId, roles, name, createdAt: Date.now() };
}

// ---------------------------------------------------------------- motion blueprint

export const BLUEPRINT_DEFAULTS = {
  description: '', frameCount: 8, loop: true,
  keyPoses: [],           // [{ index, description }]
  contactPoints: '',      // e.g. "frames 1 and 5 are foot contacts"
  emphasis: '',
  startPose: '', endPose: '',
  anticipation: false, followThrough: false,
};

export function defaultBlueprint(type, frameCount = 8) {
  const bp = { ...BLUEPRINT_DEFAULTS, frameCount, description: '', keyPoses: [] };
  const count = frameCount;
  const poseNames = {
    walk: ['contact (lead foot forward)', 'recoil (weight settles)', 'passing (legs cross)', 'high-point (push-off)', 'contact (opposite foot)', 'recoil', 'passing', 'high-point'],
    run: ['contact', 'push-off (airborne)', 'passing', 'contact opposite', 'push-off', 'passing'],
    idle: ['neutral', 'weight shift', 'neutral', 'breath up', 'neutral', 'breath down'],
    jump: ['anticipation crouch', 'extend launch', 'rise', 'apex'],
    attack: ['wind up', 'strike', 'follow through', 'recover'],
    sprint: ['extreme lean contact', 'push-off', 'passing', 'contact', 'push-off', 'passing'],
    crouch: ['stand', 'lower', 'crouched', 'lower', 'stand', 'lower'],
    fall: ['leave ground', 'falling', 'falling', 'brace'],
    land: ['touch down', 'absorb', 'recover'],
    block: ['guard up', 'hold', 'hold', 'release'],
    dodge: ['anticipate', 'dash out', 'settle'],
    cast: ['focus', 'charge', 'release', 'recover'],
    interact: ['reach', 'hold', 'return'],
    hurt: ['impact', 'recoil', 'stagger'],
    death: ['impact', 'collapse', 'fallen', 'settle'],
  };
  const names = poseNames[type];
  bp.keyPoses = [...Array(count)].map((_, i) => ({
    index: i,
    description: names ? names[i % names.length] : `pose ${i + 1} of the motion`,
  }));
  if (type === 'walk' || type === 'run' || type === 'sprint') {
    bp.contactPoints = 'foot contact poses at the cycle extremes; legs pass at the cycle midpoint';
    bp.description = names ? `${type} cycle — frames are stages of one repeating cycle, not unrelated poses` : '';
  }
  return bp;
}

/** Which frame indices are "keyframes" worth generating first. */
export function keyframeIndices(blueprint) {
  const n = blueprint.frameCount;
  if (n <= 0) return [];
  if (n <= 4) return [...Array(n).keys()];
  const set = new Set([0, n - 1, Math.floor(n / 2)]);
  if (n >= 8) { set.add(Math.floor(n / 4)); set.add(Math.floor((3 * n) / 4)); }
  return [...set].sort((a, b) => a - b);
}

/** Fraction 0..1 of cycle progress for frame i of n. */
export function cyclePhase(i, n) { return n <= 1 ? 0 : i / n; }

// ---------------------------------------------------------------- frame list ops (pure)

export function insertFrames(frames, newFrames, index) {
  const at = Math.max(0, Math.min(index ?? frames.length, frames.length));
  return [...frames.slice(0, at), ...newFrames, ...frames.slice(at)];
}

export function removeFrameIds(frames, ids) {
  const set = new Set(ids);
  return frames.filter(f => !set.has(f.id));
}

export function moveFrames(frames, ids, targetIndex) {
  const set = new Set(ids);
  const moving = frames.filter(f => set.has(f.id));
  const remaining = frames.filter(f => !set.has(f.id));
  const at = Math.max(0, Math.min(targetIndex, remaining.length));
  return [...remaining.slice(0, at), ...moving, ...remaining.slice(at)];
}

export function duplicateFrame(frame) {
  const copy = JSON.parse(JSON.stringify(frame));
  copy.id = uid('frame');
  copy.name = frame.name ? `${frame.name} copy` : '';
  copy.source = 'derived';
  copy.status = 'draft';
  copy.points = frame.points.map(p => ({ ...p }));
  copy.boxes = frame.boxes.map(b => ({ ...b, id: uid('box') }));
  return copy;
}

export function frameMetaForQa(frame) {
  return { id: frame.id, name: frame.name, meta: { w: frame.canvasDims.w, h: frame.canvasDims.h }, duration: frame.duration, pivot: frame.pivot };
}
