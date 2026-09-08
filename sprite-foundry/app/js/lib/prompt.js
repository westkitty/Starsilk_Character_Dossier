// prompt.js — prompt construction from genome, palette, blueprint, references.
// Pure + deterministic so genome conditioning is testable. The prompts are
// text reinforcements: honest continuity aids, not promises of model behavior.
import { STYLE_PRESETS, cyclePhase } from './model.js';

const DIR_WORDS = {
  south: 'facing towards the viewer (front view)', north: 'facing away from the viewer (back view)',
  east: 'side view facing right', west: 'side view facing left',
  southeast: 'three-quarter view facing front-right', southwest: 'three-quarter view facing front-left',
  northeast: 'three-quarter view facing back-right', northwest: 'three-quarter view facing back-left',
};

/** Flatten genome into prompt fragments, honoring locked fields first. */
export function genomeFragments(genome, { lockedOnly = false } = {}) {
  if (!genome) return [];
  const fragments = [];
  const sections = Object.values(genome);
  for (const section of sections) {
    for (const field of Object.values(section)) {
      if (!field || typeof field.value !== 'string') continue;
      const v = field.value.trim();
      if (!v) continue;
      if (lockedOnly && !field.locked) continue;
      fragments.push(v);
    }
  }
  return fragments;
}

export function stylePrompt(styleId, customPrompt = '') {
  const preset = STYLE_PRESETS.find(s => s.id === styleId);
  return preset && preset.id !== 'custom' ? preset.prompt : customPrompt;
}

/**
 * Build the character-generation prompt.
 * spec: { prompt, negative, styleId, customStylePrompt, view, facing,
 *         width, height, background: 'transparent-request'|'white'|'solid',
 *         genome }
 * Returns { prompt, negative }
 */
export function buildCharacterPrompt(spec) {
  const parts = [];
  const style = stylePrompt(spec.styleId ?? 'pixel-art', spec.customStylePrompt);
  if (style) parts.push(style);
  parts.push('single video game character sprite, full body, centered');
  if (spec.view === 'side') parts.push('side view');
  else if (spec.view === 'front') parts.push('front view');
  else if (spec.view === 'three-quarter') parts.push('three-quarter view');
  if (spec.facing && spec.view === 'side') parts.push(DIR_WORDS[spec.facing] || spec.facing);
  if (spec.prompt) parts.push(spec.prompt.trim());
  const genomeBits = genomeFragments(spec.genome);
  if (genomeBits.length) parts.push(`Character details: ${genomeBits.join('; ')}`);
  if (spec.background === 'white') parts.push('on a plain solid white background, no shadow, no floor');
  else if (spec.background === 'solid') parts.push('on a plain single-color background, no floor, no environment');
  else parts.push('isolated on a plain solid pure white background, no shadow (background will be keyed out)');
  parts.push('no ground, no scenery, no UI, no text, no watermark');
  const negative = [
    spec.negative,
    'blurry, anti-aliased edges, multiple characters, partial body, cropped at edges, jpeg artifacts, photo, 3d render, frame border, background scenery, text, watermark, signature',
  ].filter(Boolean).join(', ');
  return { prompt: parts.filter(Boolean).join(', '), negative };
}

/**
 * Build a per-frame prompt for animation generation.
 * Frame N is explicitly described as a *stage of the clip*, informed by the
 * motion blueprint (pose phases, contacts, emphasis) + genome + palette.
 */
export function buildFramePrompt({ characterDesc, genome, blueprint, frameIndex, totalFrames, direction = 'south', styleId, customStylePrompt, palette = null, background, previousPoseTip = null }) {
  const style = stylePrompt(styleId ?? 'pixel-art', customStylePrompt);
  const phase = cyclePhase(frameIndex, totalFrames);
  const parts = [];
  if (style) parts.push(style);
  parts.push('single video game character sprite, full body, centered, animated pose');
  parts.push(DIR_WORDS[direction] || `facing ${direction}`);
  const pose = blueprint?.keyPoses?.[frameIndex]?.description;
  if (pose) parts.push(`pose: ${pose}`);
  if (blueprint?.description) parts.push(`animation: ${blueprint.description}`);
  parts.push(`this is frame ${frameIndex + 1} of ${totalFrames} in a ${blueprint?.loop ? 'looping' : 'one-shot'} animation cycle (phase ${(phase * 100).toFixed(0)}%); body position must match that exact stage of the cycle`);
  if (blueprint?.contactPoints) parts.push(`contacts: ${blueprint.contactPoints}`);
  if (blueprint?.emphasis) parts.push(`motion emphasis: ${blueprint.emphasis}`);
  if (blueprint?.anticipation && frameIndex === 0) parts.push('this frame includes anticipation (slight counter-movement before the main action)');
  if (blueprint?.followThrough && frameIndex === totalFrames - 1) parts.push('this frame includes follow-through (motion settling after the main action)');
  if (previousPoseTip) parts.push(`continue naturally from the previous frame pose (${previousPoseTip})`);
  if (blueprint?.startPose && frameIndex === 0) parts.push(`starting pose: ${blueprint.startPose}`);
  if (blueprint?.endPose && frameIndex === totalFrames - 1) parts.push(`ending pose: ${blueprint.endPose}`);
  const genomeBits = genomeFragments(genome);
  if (characterDesc) parts.push(`same character as the reference: ${characterDesc}`);
  if (genomeBits.length) parts.push(`character identity to preserve EXACTLY: ${genomeBits.join('; ')}`);
  if (palette && palette.length) {
    const hexes = palette.slice(0, 24).map(([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''));
    parts.push(`use only this palette: ${hexes.join(' ')}`);
  }
  if (background === 'white' || !background) parts.push('isolated on a plain solid pure white background, no shadow, no floor');
  parts.push('identical proportions, clothing, colors and outline style as the reference in every frame');
  parts.push('no ground, no scenery, no text, no watermark');
  const negative = 'different character, changed outfit, changed colors, extra limbs, missing limbs, blurry, multiple characters, cropped edges, scenery, background, text, watermark, frame border, 3d render, photo';
  return { prompt: parts.filter(Boolean).join(', '), negative };
}

/** Prompt for an in-between frame between pose A and pose B. */
export function buildBetweenPrompt(opts) {
  const base = buildFramePrompt(opts);
  base.prompt += `, transitional in-between pose between the two provided reference frames (A: "${opts.poseA || 'earlier pose'}", B: "${opts.poseB || 'later pose'}"), roughly ${Math.round((opts.t ?? 0.5) * 100)}% of the way from A to B`;
  return base;
}
