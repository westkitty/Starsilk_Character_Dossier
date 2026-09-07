/**
 * SYSTEM VIEW.
 *
 * Detailed bodies for one solar system: faceted worlds, orbit tracks, restrained
 * trails, Blood Rings, and collapsed stars. Everything here is derived from authored
 * data each build; nothing authored is mutated.
 */

import * as THREE from 'three';
import type { DerivedBody } from './derive';
import { positionAtDay, spinAngleDeg, hashSeed } from './orbit';
import {
  createAtmosphere,
  createBlackHole,
  createBloodRing,
  createBodyGeometry,
  createBodyMaterial,
  createOrbitLine,
  createSelectionRing,
  createStarMaterial,
  createTrailLine,
  disposeObject3D,
  dotTextureCached,
} from './materials';

const DEG2RAD = Math.PI / 180;

export interface SystemViewOptions {
  showOrbitPaths: boolean;
  showTrails: boolean;
  trailSamples: number;
}

interface BodyNode {
  body: DerivedBody;
  object: THREE.Object3D;
  anchor: THREE.Object3D;
  spin?: THREE.Object3D;
  orbitLine?: THREE.LineLoop;
  trail?: {
    line: THREE.Line;
    points: THREE.Vector3[];
    /** Allocated vertex budget — the trail can never write past it. */
    capacity: number;
  };
}

export class SystemView {
  readonly group = new THREE.Group();
  readonly pickables: THREE.Object3D[] = [];

  private nodes = new Map<string, BodyNode>();
  private selectionRing: THREE.LineLoop | null = null;
  private starLight: THREE.PointLight | null = null;
  private maxRadius = 20;

  build(bodies: DerivedBody[], options: SystemViewOptions): void {
    this.disposeChildren();

    let maxRadius = 12;
    for (const body of bodies) {
      if (body.orbitRadius > 0) maxRadius = Math.max(maxRadius, body.orbitRadius + body.radius);
    }
    this.maxRadius = maxRadius;

    // Parents must exist before children attach to them.
    const pending = [...bodies];
    let guard = 0;
    while (pending.length > 0 && guard < 20) {
      guard += 1;
      for (let i = pending.length - 1; i >= 0; i -= 1) {
        const body = pending[i]!;
        const anchor =
          body.parentId && this.nodes.has(body.parentId)
            ? this.nodes.get(body.parentId)!.object
            : body.parentId && !bodies.some((b) => b.entityId === body.parentId)
              ? this.group
              : this.nodes.has(body.entityId)
                ? this.group
                : null;
        if (anchor === null && body.parentId && pending.some((b) => b.entityId === body.parentId)) {
          continue;
        }
        this.buildBody(body, anchor ?? this.group, options);
        pending.splice(i, 1);
      }
    }
    // Anything left (malformed parent chains) is attached to the root.
    for (const body of pending) this.buildBody(body, this.group, options);
  }

  private buildBody(body: DerivedBody, anchor: THREE.Object3D, options: SystemViewOptions): void {
    if (!body.present) return;

    const object = new THREE.Object3D();
    object.userData = { entityId: body.entityId, pickKind: body.kind, name: body.name };
    anchor.add(object);

    const node: BodyNode = { body, object, anchor };

    const seed = hashSeed(body.entityId);

    switch (body.kind) {
      case 'star': {
        const mesh = new THREE.Mesh(
          createBodyGeometry(body.radius, {
            color: body.color,
            facets: body.facets,
            banding: body.banding,
            roughness: body.roughness,
            metalness: body.metalness,
            seed,
          }),
          createStarMaterial(body.color),
        );
        object.add(mesh);
        node.spin = mesh;

        const glow = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: dotTextureCached(),
            color: new THREE.Color(body.color),
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        glow.scale.setScalar(body.radius * 5.5);
        object.add(glow);

        this.starLight = new THREE.PointLight(new THREE.Color(body.color), 2.4, 0, 1.1);
        object.add(this.starLight);
        break;
      }
      case 'blackHole': {
        object.add(createBlackHole(body.radius));
        break;
      }
      case 'bloodRing': {
        if (body.ring) {
          const ring = createBloodRing(
            body.ring.innerRadius,
            body.ring.outerRadius,
            body.ring.thickness,
            body.ring.color,
            body.ring.striations,
          );
          ring.rotation.x = Math.PI / 2 + body.ring.inclination * DEG2RAD;
          object.add(ring);
        }
        break;
      }
      default: {
        const mesh = new THREE.Mesh(
          createBodyGeometry(body.radius, {
            color: body.color,
            facets: body.facets,
            banding: body.banding,
            roughness: body.roughness,
            metalness: body.metalness,
            seed,
          }),
          createBodyMaterial({
            color: body.color,
            facets: body.facets,
            banding: body.banding,
            roughness: body.roughness,
            metalness: body.metalness,
            seed,
          }),
        );
        object.add(mesh);
        node.spin = mesh;

        if (body.atmosphere) {
          object.add(createAtmosphere(body.radius, body.atmosphere.color, body.atmosphere.intensity));
        }
        if (body.ring) {
          const ring = createBloodRing(
            body.ring.innerRadius,
            body.ring.outerRadius,
            body.ring.thickness,
            body.ring.color,
            body.ring.striations,
          );
          ring.rotation.x = Math.PI / 2 + body.ring.inclination * DEG2RAD;
          object.add(ring);
        }
        break;
      }
    }

    // Orbit track lives on the anchor so it stays centred on the parent.
    if (options.showOrbitPaths && body.orbit && body.orbitRadius > 0 && body.kind !== 'bloodRing') {
      const points = this.orbitPoints(body);
      const line = createOrbitLine(
        points,
        body.kind === 'moon' ? '#3f6b86' : '#55dfff',
        body.kind === 'moon' ? 0.16 : 0.24,
      );
      anchor.add(line);
      node.orbitLine = line;
    }

    if (options.showTrails && body.orbit && body.orbitRadius > 0 && (body.kind === 'planet' || body.kind === 'moon')) {
      const capacity = Math.max(options.trailSamples, 8);
      const line = createTrailLine(body.color, capacity);
      this.group.add(line);
      node.trail = { line, points: [], capacity };
    }

    this.nodes.set(body.entityId, node);
    this.pickables.push(object);
  }

  private orbitPoints(body: DerivedBody): THREE.Vector3[] {
    const elements = body.orbit!;
    const scale = body.orbitRadius / Math.max(elements.semiMajorAxis, 1e-4);
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < 128; i += 1) {
      const state = positionAtDay(
        { ...elements, epoch: 0, meanAnomalyAtEpoch: (360 * i) / 128 },
        0,
      );
      points.push(new THREE.Vector3(state.x * scale, state.y * scale, state.z * scale));
    }
    return points;
  }

  /** Advance motion. `days` is authored-day simulation time. */
  update(days: number, options: SystemViewOptions): void {
    const world = new THREE.Vector3();
    for (const node of this.nodes.values()) {
      const { body, object } = node;
      if (body.orbit && body.orbitRadius > 0 && body.kind !== 'bloodRing') {
        const scale = body.orbitRadius / Math.max(body.orbit.semiMajorAxis, 1e-4);
        const state = positionAtDay(body.orbit, days);
        object.position.set(state.x * scale, state.y * scale, state.z * scale);
      }
      if (node.spin) {
        node.spin.rotation.y = spinAngleDeg(body.spinPeriodDays, days) * DEG2RAD;
      }
      if (node.orbitLine) node.orbitLine.visible = options.showOrbitPaths;

      if (node.trail) {
        node.trail.line.visible = options.showTrails;
        if (options.showTrails) {
          object.getWorldPosition(world);
          const points = node.trail.points;
          const last = points[points.length - 1];
          if (!last || last.distanceToSquared(world) > 0.0004) {
            points.push(world.clone());
            // Never exceed the allocated buffer, even if the setting grew since build.
            const budget = Math.min(Math.max(options.trailSamples, 8), node.trail.capacity);
            while (points.length > budget) points.shift();
            const attribute = node.trail.line.geometry.getAttribute('position') as THREE.BufferAttribute;
            const array = attribute.array as Float32Array;
            for (let i = 0; i < points.length; i += 1) {
              array[i * 3] = points[i]!.x;
              array[i * 3 + 1] = points[i]!.y;
              array[i * 3 + 2] = points[i]!.z;
            }
            attribute.needsUpdate = true;
            node.trail.line.geometry.setDrawRange(0, points.length);
            node.trail.line.geometry.computeBoundingSphere();
          }
        }
      }
    }
  }

  /** Clear trails (used when the era changes or trails are toggled back on). */
  clearTrails(): void {
    for (const node of this.nodes.values()) {
      if (!node.trail) continue;
      node.trail.points = [];
      node.trail.line.geometry.setDrawRange(0, 0);
    }
  }

  setSelection(entityId: string | null): void {
    if (this.selectionRing) {
      this.selectionRing.removeFromParent();
      disposeObject3D(this.selectionRing);
      this.selectionRing = null;
    }
    if (!entityId) return;
    const node = this.nodes.get(entityId);
    if (!node) return;
    const radius = Math.max(node.body.radius * 1.9, node.body.orbitRadius * 0 + 1.2);
    const ring = createSelectionRing(radius);
    node.object.add(ring);
    this.selectionRing = ring;
  }

  /** Local positions of every rendered body, for labels and camera framing. */
  positions(): Map<string, THREE.Vector3> {
    const map = new Map<string, THREE.Vector3>();
    for (const [id, node] of this.nodes) {
      map.set(id, node.object.position.clone());
    }
    return map;
  }

  worldPositions(): Map<string, THREE.Vector3> {
    const map = new Map<string, THREE.Vector3>();
    for (const [id, node] of this.nodes) {
      map.set(id, node.object.getWorldPosition(new THREE.Vector3()));
    }
    return map;
  }

  has(entityId: string): boolean {
    return this.nodes.has(entityId);
  }

  get framingRadius(): number {
    return this.maxRadius;
  }

  private disposeChildren(): void {
    for (const child of [...this.group.children]) {
      disposeObject3D(child);
      this.group.remove(child);
    }
    this.nodes.clear();
    this.pickables.length = 0;
    this.selectionRing = null;
    this.starLight = null;
  }

  dispose(): void {
    this.disposeChildren();
  }
}
