/**
 * GALAXY VIEW.
 *
 * Efficient by construction: the synthetic background starfield is one
 * `THREE.Points` cloud (~10k stars by default) generated from a deterministic seed,
 * while authored sectors, systems, and large-scale structures are a handful of
 * cheap lines and markers. Detailed solar systems are only ever built when you
 * enter one.
 *
 * SIEGE WALL RENDERING — CANON CONSTRAINT
 * ---------------------------------------
 * The Siege Wall is not a wall. It is rendered as *absence*: stars inside the
 * contained region are extinguished, a swath of black covers the sky, and a few
 * procedural lensing nodes mark where collapsed stellar systems sit. No bricks,
 * panels, fencing, force fields, grids, or glowing barriers are ever drawn. The
 * abstract topology connections belong to the optional, off-by-default
 * "ANALYST OVERLAY — NON-DIEGETIC" layer.
 */

import * as THREE from 'three';
import type { DerivedGalaxy, DerivedStructure } from './derive';
import { disposeObject3D, dotTextureCached } from './materials';
import { hashSeed, mulberry32 } from './orbit';

export interface WallRegion {
  center: THREE.Vector3;
  radius: number;
}

export interface GalaxyBuildInput {
  derived: DerivedGalaxy;
  starCount: number;
  seed: string;
  galaxyRadius: number;
  wallRegions: WallRegion[];
  wallActive: boolean;
  showAnalystOverlay: boolean;
}

const WALL_NODE_SPACING = 9;

export function wallNodeCount(radius: number): number {
  return Math.max(4, Math.min(16, Math.round(radius / WALL_NODE_SPACING)));
}

/** Deterministic procedural lensing-node placements for a wall region. */
export function wallNodes(center: THREE.Vector3, radius: number, seed: number): THREE.Vector3[] {
  const count = wallNodeCount(radius);
  const random = mulberry32(seed);
  const nodes: THREE.Vector3[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / count;
    const angle = t * Math.PI * 2 + (random() - 0.5) * 0.35;
    const r = radius * (0.82 + random() * 0.24);
    nodes.push(
      new THREE.Vector3(
        center.x + Math.cos(angle) * r,
        center.y + (random() - 0.5) * radius * 0.06,
        center.z + Math.sin(angle) * r,
      ),
    );
  }
  return nodes;
}

export class GalaxyView {
  readonly group = new THREE.Group();
  readonly pickables: THREE.Object3D[] = [];

  private stars: THREE.Points | null = null;
  private starPositions: Float32Array | null = null;
  private starBaseColors: Float32Array | null = null;
  private starColorAttribute: THREE.BufferAttribute | null = null;
  private wallRegions: WallRegion[] = [];
  private wallActive = false;
  private overlay: THREE.Group | null = null;

  build(input: GalaxyBuildInput): void {
    this.disposeChildren();
    this.wallRegions = input.wallRegions;
    this.wallActive = input.wallActive;

    this.buildStarfield(input);
    this.buildSectors(input.derived);
    this.buildStructures(input.derived, input);
    this.buildSystems(input.derived);
    if (input.showAnalystOverlay) this.buildAnalystOverlay(input);
  }

  /* ------------------------------------------------------------ starfield */

  private buildStarfield(input: GalaxyBuildInput): void {
    const count = Math.max(0, Math.round(input.starCount));
    if (count === 0) return;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const base = new Float32Array(count * 3);
    const random = mulberry32(hashSeed(input.seed || 'starsilk'));
    const radius = Math.max(input.galaxyRadius, 1);
    const color = new THREE.Color();

    for (let i = 0; i < count; i += 1) {
      const bulge = random() < 0.14;
      const r = bulge
        ? radius * 0.18 * Math.pow(random(), 0.6)
        : radius * Math.sqrt(random());
      const arm = Math.floor(random() * 2);
      const theta =
        (r / radius) * 3.6 + arm * Math.PI + (random() - 0.5) * 0.6;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const y = (random() - 0.5) * radius * 0.05 * (1 - (r / radius) * 0.55);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const roll = random();
      if (roll < 0.68) color.setHSL(0.55 + random() * 0.05, 0.35, 0.72 + random() * 0.2);
      else if (roll < 0.86) color.setHSL(0.12 + random() * 0.05, 0.55, 0.66 + random() * 0.16);
      else if (roll < 0.95) color.setHSL(0.02, 0.5, 0.55 + random() * 0.15);
      else color.setHSL(0.52, 0.75, 0.75 + random() * 0.15);

      const dim = 0.55 + random() * 0.45;
      base[i * 3] = color.r * dim;
      base[i * 3 + 1] = color.g * dim;
      base[i * 3 + 2] = color.b * dim;
      colors[i * 3] = base[i * 3];
      colors[i * 3 + 1] = base[i * 3 + 1];
      colors[i * 3 + 2] = base[i * 3 + 2];
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const colorAttribute = new THREE.BufferAttribute(colors, 3);
    geometry.setAttribute('color', colorAttribute);

    const material = new THREE.PointsMaterial({
      size: Math.max(radius / 260, 0.35),
      sizeAttenuation: true,
      map: dotTextureCached(),
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.stars = new THREE.Points(geometry, material);
    this.stars.frustumCulled = true;
    this.starPositions = positions;
    this.starBaseColors = base;
    this.starColorAttribute = colorAttribute;
    this.group.add(this.stars);
    this.applyWallMask();
  }

  /** Extinguish stars inside the contained region: missing light, not a barrier. */
  private applyWallMask(): void {
    if (!this.starPositions || !this.starBaseColors || !this.starColorAttribute) return;
    const colors = this.starColorAttribute.array as Float32Array;
    const positions = this.starPositions;
    const base = this.starBaseColors;
    const active = this.wallActive && this.wallRegions.length > 0;
    for (let i = 0; i < positions.length; i += 3) {
      if (!active) {
        colors[i] = base[i];
        colors[i + 1] = base[i + 1];
        colors[i + 2] = base[i + 2];
        continue;
      }
      let extinguished = false;
      for (const region of this.wallRegions) {
        const dx = positions[i] - region.center.x;
        const dz = positions[i + 2] - region.center.z;
        if (dx * dx + dz * dz < region.radius * region.radius) {
          extinguished = true;
          break;
        }
      }
      const factor = extinguished ? 0.015 : 1;
      colors[i] = base[i] * factor;
      colors[i + 1] = base[i + 1] * factor;
      colors[i + 2] = base[i + 2] * factor;
    }
    this.starColorAttribute.needsUpdate = true;
  }

  /** Toggle the wall without rebuilding the cloud. */
  setWall(regions: WallRegion[], active: boolean): void {
    this.wallRegions = regions;
    this.wallActive = active;
    this.applyWallMask();
  }

  /* ------------------------------------------------------------ sectors */

  private buildSectors(derived: DerivedGalaxy): void {
    for (const sector of derived.sectors) {
      const group = new THREE.Group();
      group.position.set(sector.center.x, sector.center.y, sector.center.z);
      group.userData = { entityId: sector.entityId, pickKind: 'sector' };

      const outline = this.circleLine(sector.radius, sector.present ? sector.color : '#3a4a5c', sector.present ? 0.42 : 0.2);
      outline.rotation.x = Math.PI / 2;
      group.add(outline);

      // Cartographic corner ticks: an archive marks its plates.
      for (let i = 0; i < 4; i += 1) {
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const tick = this.circleLine(sector.radius * 0.12, sector.color, 0.5);
        tick.rotation.x = Math.PI / 2;
        tick.position.set(Math.cos(angle) * sector.radius, 0, Math.sin(angle) * sector.radius);
        group.add(tick);
      }

      this.group.add(group);
      this.pickables.push(group);
    }
  }

  private circleLine(radius: number, color: string, opacity: number, segments = 96): THREE.LineLoop {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < segments; i += 1) {
      const a = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity,
      depthWrite: false,
    });
    return new THREE.LineLoop(geometry, material);
  }

  /* ------------------------------------------------------------ structures */

  private buildStructures(derived: DerivedGalaxy, input: GalaxyBuildInput): void {
    for (const structure of derived.structures) {
      if (!structure.present) continue;
      if (structure.kind === 'siegeWall') this.buildSiegeWall(structure, input);
      else this.buildRegion(structure);
    }
  }

  /** A contained region: an outlined domain, deliberately not a fence. */
  private buildRegion(structure: DerivedStructure): void {
    const group = new THREE.Group();
    group.position.set(structure.center.x, structure.center.y, structure.center.z);
    group.userData = { entityId: structure.entityId, pickKind: 'structure' };
    const outline = this.circleLine(structure.radius, structure.color, 0.3, 128);
    outline.rotation.x = Math.PI / 2;
    group.add(outline);
    const inner = this.circleLine(structure.radius * 0.55, structure.color, 0.14, 96);
    inner.rotation.x = Math.PI / 2;
    group.add(inner);
    this.group.add(group);
    this.pickables.push(group);
  }

  /**
   * The Siege Wall: black absence across the sky.
   * The lensing nodes below are procedural render placeholders — there is no canon
   * node count and none is implied by this number.
   */
  private buildSiegeWall(structure: DerivedStructure, input: GalaxyBuildInput): void {
    const center = new THREE.Vector3(structure.center.x, structure.center.y, structure.center.z);
    const radius = structure.radius;
    const group = new THREE.Group();
    group.userData = { entityId: structure.entityId, pickKind: 'structure' };

    // The swath of absence.
    const voidDisc = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 96),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#01020a'),
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    voidDisc.rotation.x = -Math.PI / 2;
    voidDisc.position.set(center.x, center.y - 0.2, center.z);
    group.add(voidDisc);

    // Soft falloff so the wound has an edge rather than a stencil.
    const falloff = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: dotTextureCached(),
        color: new THREE.Color('#02030c'),
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.NormalBlending,
      }),
    );
    falloff.scale.setScalar(radius * 3.1);
    falloff.position.copy(center);
    group.add(falloff);

    // Procedural lensing nodes where collapsed stellar systems sit.
    const nodes = wallNodes(center, radius, hashSeed(structure.entityId));
    for (const node of nodes) {
      const lens = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 0.028, radius * 0.0035, 5, 40),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color('#55dfff'),
          transparent: true,
          opacity: 0.22,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      lens.position.copy(node);
      lens.rotation.x = Math.PI / 2;
      group.add(lens);

      const core = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 0.016, 12, 8),
        new THREE.MeshBasicMaterial({ color: new THREE.Color('#000000') }),
      );
      core.position.copy(node);
      group.add(core);
    }

    this.group.add(group);
    this.pickables.push(group);

    if (input.showAnalystOverlay) {
      this.overlayNodes = nodes;
      this.overlayCenter = center;
    }
  }

  private overlayNodes: THREE.Vector3[] = [];
  private overlayCenter: THREE.Vector3 | null = null;

  /* ------------------------------------------------------------ systems */

  private buildSystems(derived: DerivedGalaxy): void {
    for (const system of derived.systems) {
      const group = new THREE.Group();
      group.position.set(system.position.x, system.position.y, system.position.z);
      group.userData = {
        entityId: system.entityId,
        pickKind: 'system',
        name: system.name,
      };

      const collapsed = system.collapsed;
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(collapsed ? 0.55 : 0.85, 10, 8),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(collapsed ? '#000000' : system.color),
          toneMapped: false,
        }),
      );
      group.add(core);

      if (collapsed) {
        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(0.95, 0.045, 5, 32),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color('#55dfff'),
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        rim.rotation.x = Math.PI / 2;
        group.add(rim);
      }

      if (system.hasBloodRing) {
        const scar = new THREE.Mesh(
          new THREE.TorusGeometry(1.7, 0.16, 5, 40),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color('#8d2230'),
            transparent: true,
            opacity: 0.85,
          }),
        );
        scar.rotation.x = Math.PI / 2.2;
        group.add(scar);
      }

      if (!system.present) {
        group.visible = false;
      }

      this.group.add(group);
      this.pickables.push(group);
    }
  }

  /* ------------------------------------------------------------ analyst overlay */

  /**
   * ANALYST OVERLAY — NON-DIEGETIC.
   * Abstract cartographic connections for comprehension only. Off by default and
   * never part of the diegetic representation of the Siege Wall.
   */
  private buildAnalystOverlay(input: GalaxyBuildInput): void {
    if (this.overlay) return;
    const overlay = new THREE.Group();
    overlay.name = 'analyst-overlay';

    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color('#e4bd46'),
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });

    if (this.overlayNodes.length > 1 && this.overlayCenter) {
      for (let i = 0; i < this.overlayNodes.length; i += 1) {
        const a = this.overlayNodes[i]!;
        const b = this.overlayNodes[(i + 1) % this.overlayNodes.length]!;
        const geometry = new THREE.BufferGeometry().setFromPoints([a, b, this.overlayCenter]);
        overlay.add(new THREE.Line(geometry, material));
      }
    }

    for (const structure of input.derived.structures) {
      if (structure.kind === 'siegeWall') {
        const outline = this.circleLine(structure.radius * 1.02, '#e4bd46', 0.28, 64);
        outline.rotation.x = Math.PI / 2;
        outline.position.set(structure.center.x, structure.center.y, structure.center.z);
        overlay.add(outline);
      }
    }

    this.overlay = overlay;
    this.group.add(overlay);
  }

  setAnalystOverlay(visible: boolean): void {
    if (this.overlay) this.overlay.visible = visible;
  }

  /** System marker world positions, for camera framing. */
  markerPosition(entityId: string): THREE.Vector3 | null {
    let found: THREE.Vector3 | null = null;
    this.group.traverse((object) => {
      if (found) return;
      if (object.userData?.entityId === entityId && object.userData?.pickKind === 'system') {
        found = object.getWorldPosition(new THREE.Vector3());
      }
    });
    return found;
  }

  private disposeChildren(): void {
    for (const child of [...this.group.children]) {
      disposeObject3D(child);
      this.group.remove(child);
    }
    this.pickables.length = 0;
    this.stars = null;
    this.starPositions = null;
    this.starBaseColors = null;
    this.starColorAttribute = null;
    this.overlay = null;
    this.overlayNodes = [];
    this.overlayCenter = null;
  }

  dispose(): void {
    this.disposeChildren();
  }
}
