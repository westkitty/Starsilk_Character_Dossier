/**
 * Camera rig: orbit / pan / zoom plus smooth focus transitions.
 *
 * Reduced-motion mode removes the cinematic easing entirely: focus jumps are
 * instant and damping is disabled, so the view never slides.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface CameraRigOptions {
  reducedMotion: boolean;
  minDistance?: number;
  maxDistance?: number;
}

interface Transition {
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  fromPosition: THREE.Vector3;
  toPosition: THREE.Vector3;
  elapsed: number;
  duration: number;
}

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;

  private transition: Transition | null = null;
  private reducedMotion: boolean;

  constructor(
    domElement: HTMLElement,
    options: CameraRigOptions,
  ) {
    this.reducedMotion = options.reducedMotion;
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 20000);
    this.camera.position.set(0, 60, 140);

    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.enableDamping = !this.reducedMotion;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = options.minDistance ?? 1.5;
    this.controls.maxDistance = options.maxDistance ?? 6000;
    this.controls.rotateSpeed = 0.75;
    this.controls.zoomSpeed = 0.9;
    this.controls.panSpeed = 0.8;
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    this.controls.enableDamping = !reduced;
    if (reduced) this.transition = null;
  }

  get isTransitioning(): boolean {
    return this.transition !== null;
  }

  /**
   * Move the camera to frame `target` at `distance`.
   * With reduced motion the move is immediate.
   */
  focusOn(target: THREE.Vector3, distance: number, direction?: THREE.Vector3): void {
    const offset = (direction ?? this.camera.position.clone().sub(this.controls.target)).normalize();
    const toPosition = target.clone().add(offset.multiplyScalar(Math.max(distance, 2)));
    if (this.reducedMotion) {
      this.controls.target.copy(target);
      this.camera.position.copy(toPosition);
      this.controls.update();
      return;
    }
    this.transition = {
      fromTarget: this.controls.target.clone(),
      toTarget: target.clone(),
      fromPosition: this.camera.position.clone(),
      toPosition,
      elapsed: 0,
      duration: Math.min(0.9, 0.35 + distance / 900),
    };
    this.controls.enabled = false;
  }

  reset(target: THREE.Vector3, distance: number): void {
    this.focusOn(target, distance, new THREE.Vector3(0.25, 0.55, 1).normalize());
  }

  update(deltaSeconds: number): void {
    if (this.transition) {
      const t = this.transition;
      t.elapsed += deltaSeconds;
      const raw = Math.min(t.elapsed / t.duration, 1);
      const eased = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
      this.controls.target.lerpVectors(t.fromTarget, t.toTarget, eased);
      this.camera.position.lerpVectors(t.fromPosition, t.toPosition, eased);
      this.camera.lookAt(this.controls.target);
      if (raw >= 1) {
        this.transition = null;
        this.controls.enabled = true;
        this.controls.update();
      }
      return;
    }
    this.controls.update();
  }

  resize(width: number, height: number): void {
    if (height <= 0 || width <= 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.controls.dispose();
  }
}
