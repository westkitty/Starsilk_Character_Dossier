import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { childrenOf, getEntity, type Entity, type StarMapProject } from "./core.js";
import { displayOrbitRadius, displayPosition, orbitalPosition } from "./orbit.js";
import { resolveEntityHistoricalState } from "./timeline.js";

export type ViewScale = "galaxy" | "sector" | "system";
export interface RendererCallbacks {
  onSelect?: (id: string) => void;
  onActivate?: (id: string) => void;
}

const interactiveTypes = new Set(["starfield", "system", "star", "planet", "moon", "bloodRing", "orbitalStructure"]);

export class CartographerRenderer {
  private host: HTMLElement;
  private canvasHost: HTMLElement;
  private labelsHost: HTMLElement;
  private scene: any;
  private camera: any;
  private renderer: any;
  private controls: OrbitControls;
  private raycaster: any;
  private pointer: any;
  private resizeObserver: ResizeObserver;
  private animationFrame = 0;
  private lastFrame = performance.now();
  private simulationTime = 0;
  private objectToEntity = new Map<any, string>();
  private entityObjects = new Map<string, any>();
  private orbiting = new Map<string, { object: any; parentObject: any | null; entity: Entity; trail?: any }>();
  private labelNodes = new Map<string, HTMLElement>();
  private project: StarMapProject;
  private callbacks: RendererCallbacks;
  private selectedId: string | null = null;
  private viewScale: ViewScale = "galaxy";
  private viewId: string | null = null;
  private focusTarget: { position: any; target: any } | null = null;
  private reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  constructor(host: HTMLElement, project: StarMapProject, callbacks: RendererCallbacks = {}) {
    this.host = host;
    this.project = project;
    this.callbacks = callbacks;
    host.innerHTML = "";
    host.classList.add("space-host");
    this.canvasHost = document.createElement("div");
    this.canvasHost.className = "canvas-host";
    this.labelsHost = document.createElement("div");
    this.labelsHost.className = "space-labels";
    this.labelsHost.setAttribute("aria-hidden", "true");
    host.append(this.canvasHost, this.labelsHost);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#05070d");
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.05, 4000);
    this.camera.position.set(0, 32, 54);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvasHost.append(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.reducedMotion;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 900;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.renderer.domElement.addEventListener("pointerup", this.handlePointer);
    this.renderer.domElement.addEventListener("dblclick", this.handleDoubleClick);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.rebuild();
    this.tick(performance.now());
  }

  setProject(project: StarMapProject): void { this.project = project; this.rebuild(); }
  setSelection(id: string | null): void { this.selectedId = id; this.refreshSelection(); }
  setView(scale: ViewScale, id: string | null): void { this.viewScale = scale; this.viewId = id; this.simulationTime = 0; this.rebuild(); this.resetCamera(); }
  getView(): { scale: ViewScale; id: string | null } { return { scale: this.viewScale, id: this.viewId }; }

  focusSelected(): void {
    if (!this.selectedId) return;
    const object = this.entityObjects.get(this.selectedId);
    if (!object) return;
    const target = new THREE.Vector3();
    object.getWorldPosition(target);
    const offset = this.camera.position.clone().sub(this.controls.target).normalize().multiplyScalar(Math.max(8, object.scale?.x ? object.scale.x * 12 : 12));
    const position = target.clone().add(offset);
    if (this.reducedMotion) { this.controls.target.copy(target); this.camera.position.copy(position); return; }
    this.focusTarget = { target, position };
  }

  resetCamera(): void {
    const presets: Record<ViewScale, [number, number, number]> = { galaxy: [0, 55, 92], sector: [0, 32, 56], system: [0, 24, 40] };
    const [x, y, z] = presets[this.viewScale];
    this.camera.position.set(x, y, z);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  destroy(): void {
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener("pointerup", this.handlePointer);
    this.renderer.domElement.removeEventListener("dblclick", this.handleDoubleClick);
    this.controls.dispose();
    this.disposeScene();
    this.renderer.dispose();
    this.host.innerHTML = "";
  }

  private resize(): void {
    const width = Math.max(this.host.clientWidth, 1);
    const height = Math.max(this.host.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private tick = (now: number): void => {
    const delta = Math.min((now - this.lastFrame) / 1000, 0.1);
    this.lastFrame = now;
    if (this.project.settings.simulation.running) this.simulationTime += delta * this.project.settings.simulation.speed;
    if (this.viewScale === "system") this.updateOrbits();
    if (this.focusTarget) {
      this.controls.target.lerp(this.focusTarget.target, 0.14);
      this.camera.position.lerp(this.focusTarget.position, 0.12);
      if (this.camera.position.distanceTo(this.focusTarget.position) < 0.05) this.focusTarget = null;
    }
    this.controls.update();
    this.updateLabels();
    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(this.tick);
  };

  private rebuild(): void {
    this.disposeScene();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#05070d");
    this.scene.add(new THREE.AmbientLight(0x9dcadd, 0.52));
    const key = new THREE.DirectionalLight(0xc9eaff, 1.2);
    key.position.set(12, 25, 18);
    this.scene.add(key);
    if (this.project.settings.view.referenceGrid) {
      const grid = new THREE.GridHelper(100, 20, 0x27374b, 0x162235);
      grid.position.y = -0.05;
      this.scene.add(grid);
    }
    if (this.viewScale === "system") this.buildSystem(); else this.buildMap();
    this.refreshSelection();
  }

  private disposeScene(): void {
    if (!this.scene) return;
    this.scene.traverse((object: any) => {
      if (object.geometry) object.geometry.dispose?.();
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.dispose?.();
      }
    });
    this.objectToEntity.clear();
    this.entityObjects.clear();
    this.orbiting.clear();
    for (const node of this.labelNodes.values()) node.remove();
    this.labelNodes.clear();
  }

  private buildMap(): void {
    const wall = this.project.entities.find((entity) => entity.id === "siege-wall" || (entity.type === "largeScaleStructure" && entity.name === "SIEGE WALL"));
    const wallActive = wall ? resolveEntityHistoricalState(this.project, wall.id).visible : false;
    this.addSyntheticStarfield(10_000, wallActive);
    if (wallActive && this.project.settings.view.analystOverlay) this.addAnalystOverlay();
    const scope = this.viewScale === "galaxy"
      ? this.project.entities.filter((entity) => entity.type === "starfield" || entity.type === "system")
      : this.project.entities.filter((entity) => entity.type === "system" && entity.parentId === this.viewId);
    for (const entity of scope) {
      const state = resolveEntityHistoricalState(this.project, entity.id);
      if (!state.visible) continue;
      if (this.project.settings.view.canonOnly && entity.meta.canonStatus !== "locked") continue;
      if (!entity.position) continue;
      const display = displayPosition(entity.position);
      const isSector = entity.type === "starfield";
      const geometry = isSector ? new THREE.IcosahedronGeometry(1.5, 1) : new THREE.SphereGeometry(0.9, 12, 8);
      const baseColor = state.destroyed ? "#111927" : (entity.visual?.color ?? (isSector ? "#4ba7db" : "#a6efff"));
      const material = new THREE.MeshStandardMaterial({ color: baseColor, emissive: state.destroyed ? "#05070d" : (entity.visual?.color ?? "#55dfff"), emissiveIntensity: state.destroyed ? 0.05 : (isSector ? 0.18 : 0.45), roughness: 0.65 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(display.x, display.y, display.z);
      this.scene.add(mesh);
      this.registerInteractive(mesh, entity);
      this.addLabel(entity, mesh, state.name + (state.destroyed ? " // HISTORICALLY DESTROYED" : ""));
    }
  }

  private buildSystem(): void {
    const system = getEntity(this.project, this.viewId);
    if (!system || system.type !== "system") return;
    const direct = childrenOf(this.project, system.id);
    const stars = direct.filter((entity) => entity.type === "star" || entity.type === "blackHole");
    const planets = direct.filter((entity) => entity.type === "planet");
    for (const star of stars) this.addBody(star, null);
    for (const planet of planets) {
      const planetObject = this.addBody(planet, null);
      if (!planetObject) continue;
      for (const child of childrenOf(this.project, planet.id).filter((entity) => entity.type === "moon" || entity.type === "bloodRing" || entity.type === "orbitalStructure")) this.addBody(child, planetObject);
    }
  }

  private addBody(entity: Entity, parentObject: any | null): any | null {
    const state = resolveEntityHistoricalState(this.project, entity.id);
    if (!state.visible) return null;
    if (state.effectiveType === "bloodRing" || entity.type === "bloodRing") {
      const radius = Number(entity.visual?.displayRadius ?? 1.7);
      const geometry = new THREE.RingGeometry(radius * 0.78, radius, 64, 3);
      geometry.rotateX(Math.PI / 2);
      const material = new THREE.MeshStandardMaterial({ color: entity.visual?.color ?? "#5b101b", roughness: 0.58, metalness: 0.18, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(geometry, material);
      ring.rotation.z = ((entity.orbit?.inclination ?? 0) * Math.PI) / 180;
      if (parentObject) parentObject.add(ring); else this.scene.add(ring);
      this.registerInteractive(ring, entity);
      this.addLabel(entity, ring, state.name);
      return ring;
    }
    const isBlackHole = state.effectiveType === "blackHole";
    const radius = Number(entity.visual?.displayRadius ?? (entity.type === "star" ? 2.8 : entity.type === "planet" ? 1.1 : 0.35));
    const geometry = (entity.type === "star" || isBlackHole)
      ? new THREE.IcosahedronGeometry(radius, 2)
      : new THREE.SphereGeometry(radius, entity.type === "moon" ? 16 : 24, entity.type === "moon" ? 10 : 16);
    const color = isBlackHole ? "#010205" : (entity.visual?.color ?? (entity.type === "star" ? "#e4bd46" : "#8fa8b8"));
    const material = (entity.type === "star" || isBlackHole)
      ? new THREE.MeshStandardMaterial({ color, emissive: isBlackHole ? "#000000" : color, emissiveIntensity: isBlackHole ? 0 : Number(entity.visual?.emissive ?? 0.8), roughness: isBlackHole ? 1 : 0.7 })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.02, flatShading: true });
    const mesh = new THREE.Mesh(geometry, material);
    if (parentObject) parentObject.add(mesh); else this.scene.add(mesh);
    this.registerInteractive(mesh, entity);
    this.addLabel(entity, mesh, state.name + (isBlackHole ? " // BLACK HOLE" : ""));
    if (isBlackHole) {
      const lens = new THREE.Mesh(new THREE.RingGeometry(radius * 1.3, radius * 1.42, 48), new THREE.MeshBasicMaterial({ color: "#27374b", transparent: true, opacity: 0.42, side: THREE.DoubleSide }));
      lens.rotation.x = Math.PI / 2;
      mesh.add(lens);
    }
    if (entity.orbit) {
      this.addOrbitPath(entity, parentObject);
      const trail = this.addTrail(entity, parentObject);
      this.orbiting.set(entity.id, { object: mesh, parentObject, entity, trail });
    }
    return mesh;
  }

  private addOrbitPath(entity: Entity, parentObject: any | null): void {
    if (!entity.orbit || !this.project.settings.view.orbitPaths) return;
    const radius = displayOrbitRadius(entity.orbit.semiMajorAxis);
    const points: any[] = [];
    for (let i = 0; i <= 96; i += 1) {
      const angle = (i / 96) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x27374b, transparent: true, opacity: 0.65 });
    const line = new THREE.Line(geometry, material);
    if (parentObject) parentObject.add(line); else this.scene.add(line);
  }

  private addTrail(entity: Entity, parentObject: any | null): any | undefined {
    if (!entity.orbit || !this.project.settings.view.trails) return undefined;
    const geometry = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 24 }, () => new THREE.Vector3()));
    const material = new THREE.LineBasicMaterial({ color: entity.visual?.color ?? "#55dfff", transparent: true, opacity: 0.28 });
    const line = new THREE.Line(geometry, material);
    if (parentObject) parentObject.add(line); else this.scene.add(line);
    return line;
  }

  private updateOrbits(): void {
    for (const { object, entity, trail } of this.orbiting.values()) {
      if (!entity.orbit) continue;
      const authored = orbitalPosition(entity.orbit, this.simulationTime);
      const authoredLength = Math.max(Math.hypot(authored.x, authored.y, authored.z), 1e-9);
      const displayRadius = displayOrbitRadius(authoredLength);
      object.position.set(authored.x / authoredLength * displayRadius, authored.y / authoredLength * displayRadius, authored.z / authoredLength * displayRadius);
      if (trail) {
        const positions = trail.geometry.attributes.position;
        for (let index = 0; index < positions.count; index += 1) {
          const offset = (index / Math.max(positions.count - 1, 1)) * Math.min(entity.orbit.period * 0.08, 6);
          const p = orbitalPosition(entity.orbit, this.simulationTime - offset);
          const length = Math.max(Math.hypot(p.x, p.y, p.z), 1e-9);
          const r = displayOrbitRadius(length);
          positions.setXYZ(index, p.x / length * r, p.y / length * r, p.z / length * r);
        }
        positions.needsUpdate = true;
      }
    }
  }

  private addSyntheticStarfield(count: number, siegeWallActive = false): void {
    const positions: number[] = [];
    let seed = 0x51a7c0de;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0xffffffff; };
    for (let i = 0; i < count; i += 1) {
      const radius = 80 + random() * 620;
      const theta = random() * Math.PI * 2;
      const y = (random() - 0.5) * 190;
      const inWallAbsence = siegeWallActive && theta > Math.PI * 0.12 && theta < Math.PI * 0.42 && Math.abs(y) < 75;
      if (inWallAbsence) continue;
      positions.push(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
    const material = new THREE.PointsMaterial({ color: 0x7897aa, size: 0.5, transparent: true, opacity: 0.55, sizeAttenuation: true });
    this.scene.add(new THREE.Points(geometry, material));
    if (siegeWallActive) {
      const note = document.createElement("div");
      note.className = "void-note";
      note.textContent = "SIEGE WALL // STELLAR ABSENCE";
      this.labelsHost.append(note);
      this.labelNodes.set("__siege-wall-note", note);
    }
  }

  private addAnalystOverlay(): void {
    const points: any[] = [];
    for (let i = 0; i < 96; i += 1) {
      const angle = (i / 96) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * 330, Math.sin(angle * 3) * 28, Math.sin(angle) * 230));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x55dfff, transparent: true, opacity: 0.16 });
    this.scene.add(new THREE.LineLoop(geometry, material));
    const note = document.createElement("div");
    note.className = "analyst-note";
    note.textContent = "ANALYST OVERLAY — NON-DIEGETIC";
    this.labelsHost.append(note);
    this.labelNodes.set("__analyst-note", note);
  }

  private registerInteractive(object: any, entity: Entity): void {
    if (!interactiveTypes.has(entity.type)) return;
    object.userData.entityId = entity.id;
    this.objectToEntity.set(object, entity.id);
    this.entityObjects.set(entity.id, object);
  }

  private addLabel(entity: Entity, object: any, labelText = entity.name): void {
    if (!this.project.settings.view.labels) return;
    const label = document.createElement("div");
    label.className = "space-label";
    label.textContent = labelText;
    label.dataset.entityId = entity.id;
    this.labelsHost.append(label);
    this.labelNodes.set(entity.id, label);
    object.userData.labelEntityId = entity.id;
  }

  private updateLabels(): void {
    if (!this.project.settings.view.labels) return;
    const rect = this.host.getBoundingClientRect();
    const vector = new THREE.Vector3();
    for (const [entityId, label] of this.labelNodes) {
      const object = this.entityObjects.get(entityId);
      if (!object) continue;
      object.getWorldPosition(vector);
      vector.project(this.camera);
      const visible = vector.z > -1 && vector.z < 1;
      label.hidden = !visible;
      if (!visible) continue;
      label.style.transform = `translate(${(vector.x * 0.5 + 0.5) * rect.width}px, ${(-vector.y * 0.5 + 0.5) * rect.height}px)`;
    }
  }

  private refreshSelection(): void {
    for (const [id, object] of this.entityObjects) {
      const material = object.material;
      if (!material) continue;
      if (!("emissiveIntensity" in material)) continue;
      material.emissiveIntensity = id === this.selectedId ? 1.4 : (getEntity(this.project, id)?.type === "star" ? 0.8 : 0.35);
    }
    for (const [id, label] of this.labelNodes) label.classList.toggle("selected", id === this.selectedId);
  }

  private hitTest(event: PointerEvent | MouseEvent): string | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const candidates = Array.from(this.objectToEntity.keys());
    const hit = this.raycaster.intersectObjects(candidates, false)[0];
    return hit ? this.objectToEntity.get(hit.object) ?? null : null;
  }

  private handlePointer = (event: PointerEvent): void => { const id = this.hitTest(event); if (id) this.callbacks.onSelect?.(id); };
  private handleDoubleClick = (event: MouseEvent): void => { const id = this.hitTest(event); if (id) this.callbacks.onActivate?.(id); };
}
