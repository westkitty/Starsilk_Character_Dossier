// skeleton.js — a small humanoid stick-figure pose model.
// Joints are normalized-ish coordinates centered on the hips; unit `u` is
// roughly one head-height in canvas pixels, scaled per character height.
// Positive x = character's forward (right for south-facing edit view),
// positive y = down.
export const JOINTS = ['head', 'neck', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'handL', 'handR', 'hips', 'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR'];

export const BONES = [
  ['head', 'neck'], ['neck', 'shoulderL'], ['neck', 'shoulderR'],
  ['shoulderL', 'elbowL'], ['elbowL', 'handL'],
  ['shoulderR', 'elbowR'], ['elbowR', 'handR'],
  ['neck', 'hips'], ['hips', 'hipL'], ['hips', 'hipR'],
  ['hipL', 'kneeL'], ['kneeL', 'footL'], ['hipR', 'kneeR'], ['kneeR', 'footR'],
];

/** Neutral standing pose in unit space (head up at y=-2). */
export function neutralPose() {
  return {
    head: { x: 0, y: -2.0 }, neck: { x: 0, y: -1.55 },
    shoulderL: { x: -0.45, y: -1.5 }, shoulderR: { x: 0.45, y: -1.5 },
    elbowL: { x: -0.55, y: -0.95 }, elbowR: { x: 0.55, y: -0.95 },
    handL: { x: -0.5, y: -0.45 }, handR: { x: 0.5, y: -0.45 },
    hips: { x: 0, y: -0.85 },
    hipL: { x: -0.22, y: -0.8 }, hipR: { x: 0.22, y: -0.8 },
    kneeL: { x: -0.24, y: -0.4 }, kneeR: { x: 0.24, y: -0.4 },
    footL: { x: -0.26, y: 0 }, footR: { x: 0.26, y: 0 },
  };
}

const lerp = (a, b, t) => a + (b - a) * t;
function lerpPose(a, b, t) {
  const out = {};
  for (const j of JOINTS) out[j] = { x: lerp(a[j].x, b[j].x, t), y: lerp(a[j].y, b[j].y, t) };
  return out;
}

/**
 * Pose for animation `type` at cycle phase t (0..1).
 * Deterministic templates for the built-in animation types; custom motions
 * start from neutral and are edited by hand. Returned as unit-space joints.
 */
export function poseFor(type, t) {
  const base = neutralPose();
  const swing = Math.sin(t * Math.PI * 2);
  const swingOpp = Math.sin(t * Math.PI * 2 + Math.PI);
  switch (type) {
    case 'walk': case 'run': case 'sprint': {
      const amp = type === 'walk' ? 0.38 : type === 'run' ? 0.55 : 0.7;
      const bob = type === 'walk' ? 0.05 : 0.1;
      const airborne = type !== 'walk' && Math.abs(swing) < 0.35 ? -0.08 : 0;
      const p = lerpPose(base, base, 0);
      p.footL = { x: -0.26 + swing * amp, y: -Math.max(0, swing) * 0.25 };
      p.footR = { x: 0.26 + swingOpp * amp, y: -Math.max(0, swingOpp) * 0.25 };
      p.kneeL = { x: -0.24 + swing * amp * 0.5, y: -0.4 - Math.max(0, swing) * 0.12 };
      p.kneeR = { x: 0.24 + swingOpp * amp * 0.5, y: -0.4 - Math.max(0, swingOpp) * 0.12 };
      p.handL = { x: -0.5 - swingOpp * amp * 0.45, y: -0.45 };
      p.handR = { x: 0.5 - swing * amp * 0.45, y: -0.45 };
      p.elbowL = { x: -0.55 - swingOpp * amp * 0.2, y: -0.95 };
      p.elbowR = { x: 0.55 - swing * amp * 0.2, y: -0.95 };
      const dy = -Math.abs(swing) * bob + airborne;
      for (const j of ['head', 'neck', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'handL', 'handR', 'hips', 'hipL', 'hipR']) p[j].y += dy;
      return p;
    }
    case 'idle': {
      const breath = Math.sin(t * Math.PI * 2) * 0.03;
      const p = lerpPose(base, base, 0);
      p.neck.y += breath; p.head.y += breath * 1.5;
      p.shoulderL.y += breath; p.shoulderR.y += breath;
      return p;
    }
    case 'jump': {
      const p = lerpPose(base, base, 0);
      if (t < 0.25) { // anticipation crouch
        const k = t / 0.25;
        p.hips.y += 0.3 * k; p.head.y += 0.25 * k; p.neck.y += 0.28 * k;
        p.kneeL.y -= 0.2 * k; p.kneeR.y -= 0.2 * k;
      } else if (t < 0.6) { // rise
        const k = (t - 0.25) / 0.35;
        p.footL.y = -0.4 * k; p.footR.y = -0.35 * k;
        p.kneeL.y -= 0.25 * k; p.kneeR.y -= 0.2 * k;
        p.handL.y -= 0.5 * k; p.handR.y -= 0.5 * k;
      } else { // apex
        p.footL.y = -0.35; p.footR.y = -0.3;
        p.handL.y -= 0.5; p.handR.y -= 0.5;
      }
      return p;
    }
    case 'attack': case 'heavy-attack': {
      const p = lerpPose(base, base, 0);
      const big = type === 'heavy-attack';
      if (t < 0.33) { // wind up
        const k = t / 0.33;
        p.handR.x -= 0.5 * k * (big ? 1.4 : 1); p.handR.y -= 0.5 * k;
        p.elbowR.x -= 0.3 * k; p.elbowR.y -= 0.3 * k;
      } else if (t < 0.55) { // strike
        const k = (t - 0.33) / 0.22;
        p.handR.x = base.handR.x - (big ? 0.7 : 0.5) + 1.5 * k; p.handR.y = base.handR.y - 0.5 + 0.4 * k;
        p.elbowR.x = base.elbowR.x - 0.3 + 0.9 * k; p.elbowR.y = base.elbowR.y - 0.3 + 0.25 * k;
      } else { // recover
        const k = (t - 0.55) / 0.45;
        p.handR.x = base.handR.x + (big ? 0.8 : 1) - (big ? 0.8 : 1) * k; p.handR.y = base.handR.y - 0.1 + 0.1 * k;
        p.elbowR.x = base.elbowR.x + 0.6 - 0.6 * k; p.elbowR.y = base.elbowR.y;
      }
      return p;
    }
    default: return base;
  }
}

/** Generate a full pose sequence: one pose per frame index. */
export function poseSequence(type, frameCount) {
  return [...Array(frameCount)].map((_, i) => poseFor(type, frameCount <= 1 ? 0 : i / frameCount));
}

/**
 * Convert a unit-space pose to canvas pixel coordinates for a character of
 * approximately `unitPx` pixels per unit, standing with feet at (cx, groundY).
 */
export function poseToPixels(pose, { unitPx = 16, cx = 0, groundY = 0 }) {
  const out = {};
  for (const j of JOINTS) out[j] = { x: cx + pose[j].x * unitPx, y: groundY + pose[j].y * unitPx };
  return out;
}
