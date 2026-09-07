/**
 * Procedural geometry + materials.
 *
 * No external art: everything is generated at runtime so the tool works offline
 * and stays small. The look is deliberately stylized — lightly faceted worlds,
 * restrained toon-ish shading, thin cartographic lines — translated into STARSiLK's
 * own identity rather than copying any existing game's presentation.
 */

import * as THREE from 'three';
import { mulberry32 } from './orbit';

export interface BodyAppearance {
  color: string;
  facets: number;
  banding: number;
  roughness: number;
  metalness: number;
  emissive?: string;
  emissiveIntensity?: number;
  seed: number;
}

/** Faceted sphere with deterministic per-vertex mottling (the "compact world" read). */
export function createBodyGeometry(
  radius: number,
  appearance: BodyAppearance,
): THREE.IcosahedronGeometry {
  const detail = Math.max(0, Math.min(Math.round(appearance.facets), 5));
  const geometry = new THREE.IcosahedronGeometry(Math.max(radius, 0.05), detail);
  geometry.computeVertexNormals();

  const base = new THREE.Color(appearance.color);
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const random = mulberry32(appearance.seed);
  const position = geometry.attributes.position;
  const shade = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const y = position.getY(i);
    // Cheap deterministic banding along the polar axis plus per-vertex noise.
    const band = Math.sin((y / Math.max(radius, 0.05)) * 3.1 + random() * 0.35);
    const noise = (random() - 0.5) * 0.5;
    const amount = appearance.banding * (band * 0.5 + noise);
    shade.copy(base);
    shade.offsetHSL(0, amount * 0.06, amount * 0.16);
    colors[i * 3] = shade.r;
    colors[i * 3 + 1] = shade.g;
    colors[i * 3 + 2] = shade.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

export function createBodyMaterial(appearance: BodyAppearance): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(appearance.color),
    vertexColors: true,
    roughness: appearance.roughness,
    metalness: appearance.metalness,
    flatShading: true,
    emissive: new THREE.Color(appearance.emissive ?? '#000000'),
    emissiveIntensity: appearance.emissiveIntensity ?? 0,
  });
}

/** Stars are unlit: they are the light source, not a lit surface. */
export function createStarMaterial(color: string): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    toneMapped: false,
  });
}

/** Soft additive halo used for stars and atmospheres. */
export function createAtmosphere(
  radius: number,
  color: string,
  intensity: number,
): THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> {
  const geometry = new THREE.SphereGeometry(radius * 1.16, 24, 16);
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: Math.min(Math.max(intensity, 0), 1) * 0.4,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });
  return new THREE.Mesh(geometry, material);
}

let dotTexture: THREE.Texture | null = null;
export function dotTextureCached(): THREE.Texture {
  if (dotTexture) return dotTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.72)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  dotTexture = new THREE.CanvasTexture(canvas);
  dotTexture.needsUpdate = true;
  return dotTexture;
}

/**
 * BLOOD RING.
 *
 * Not an asteroid belt, not Saturn-style dust, not decorative: a huge solid orbital
 * band built from the processed remains of a murdered world. The shader layers
 * vitrified crimson-black material with spin striations and ash inclusions so that
 * at distance it reads as dark stained glass, and up close as scarred composite.
 */
export function createBloodRing(innerRadius: number, outerRadius: number, thickness: number, color: string, striations: number): THREE.Mesh {
  const radius = (innerRadius + outerRadius) / 2;
  const tube = Math.max((outerRadius - innerRadius) / 2, thickness / 2, 0.04);
  const geometry = new THREE.TorusGeometry(radius, tube, 7, 128);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uBase: { value: new THREE.Color(color) },
      uStriations: { value: striations },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase;
      uniform float uStriations;
      varying vec2 vUv;
      varying vec3 vNormal;

      float hash(float n) { return fract(sin(n) * 43758.5453123); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i.x + i.y * 57.0);
        float b = hash(i.x + 1.0 + i.y * 57.0);
        float c = hash(i.x + (i.y + 1.0) * 57.0);
        float d = hash(i.x + 1.0 + (i.y + 1.0) * 57.0);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }

      void main() {
        float around = vUv.x;            // spin direction around the band
        float across = vUv.y;            // across the vitrified cross-section
        float spin = sin(around * uStriations * 6.28318 + noise(vec2(around * 60.0, across * 5.0)) * 4.0);
        float striation = 0.5 + 0.5 * spin;

        vec3 ash = vec3(0.30, 0.24, 0.22);
        vec3 vitrified = uBase;
        vec3 deep = vec3(0.035, 0.012, 0.018);

        vec3 col = mix(deep, vitrified, 0.30 + 0.55 * striation);
        col = mix(col, ash, 0.22 * noise(vec2(around * 140.0, across * 9.0)));
        col += vitrified * 0.55 * pow(max(spin, 0.0), 8.0);

        float cross_shade = 0.55 + 0.45 * smoothstep(0.0, 1.0, across);
        float light = 0.35 + 0.65 * max(dot(normalize(vNormal), normalize(vec3(0.4, 0.8, 0.5))), 0.0);
        gl_FragColor = vec4(col * cross_shade * light, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

/**
 * BLACK HOLE.
 *
 * A subdued void treatment: an absence sphere, a thin cartographic photon ring, and
 * a faint lensing halo. Deliberately no orange accretion-disk spectacle — the canon
 * event is a wound, not a fireworks display.
 */
export function createBlackHole(radius: number): THREE.Group {
  const group = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#000000'), toneMapped: false }),
  );
  group.add(shadow);

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.5, 24, 16),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#0a1a28'),
      transparent: true,
      opacity: 0.55,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  group.add(halo);

  const photonRing = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.42, radius * 0.045, 6, 96),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#55dfff'),
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  photonRing.rotation.x = Math.PI / 2.35;
  group.add(photonRing);

  return group;
}

/** Orbit track line. Thin, dim, cartographic. */
export function createOrbitLine(points: THREE.Vector3[], color: string, opacity: number): THREE.LineLoop {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity,
    depthWrite: false,
  });
  return new THREE.LineLoop(geometry, material);
}

export function createTrailLine(color: string, samples: number): THREE.Line {
  const positions = new Float32Array(Math.max(samples, 2) * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setDrawRange(0, 0);
  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
  return new THREE.Line(geometry, material);
}

/** Selection indicator: a thin bracket ring, never colour alone. */
export function createSelectionRing(radius: number): THREE.LineLoop {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < 48; i += 1) {
    const a = (i / 48) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color('#55dfff'),
    transparent: true,
    opacity: 0.85,
    depthTest: false,
    depthWrite: false,
  });
  const ring = new THREE.LineLoop(geometry, material);
  ring.renderOrder = 999;
  return ring;
}

/** Dispose every geometry/material/texture under `root`. */
export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = (mesh as unknown as { material?: THREE.Material | THREE.Material[] }).material;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else if (material) material.dispose();
  });
}
