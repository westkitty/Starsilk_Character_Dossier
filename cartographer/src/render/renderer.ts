import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { EditorStore } from "../store/editor-store.ts";
import type { Entity, StarMapProject, ViewScale } from "../model/types.ts";
import { childrenOf, entityMap } from "../model/validate.ts";
import { resolveHistoricalTime } from "../model/resolve-time.ts";
import { isEntityVisible, resolveHistoricalView } from "../model/resolve-state.ts";
import { displayBodyRadius, displayOrbitRadius, keplerPosition, sampleOrbitPath } from "../model/orbit.ts";
import { atmosphereMaterial, bodyMaterial, makeBlackHoleMaterial, makeBloodRingMaterial } from "./materials.ts";
import { mulberry32 } from "./seeded.ts";

const MAX_TRAIL = 90;
const GALAXY_R = 48;

interface BodyHandle {
  id: string;
  mesh: THREE.Object3D;
  orbitLine?: THREE.Line;
  trail?: THREE.Line;
  trailPts: THREE.Vector3[];
}

export class MapRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly canvas: HTMLCanvasElement;
  private store: EditorStore;
  private labelHost: HTMLElement;
  private raf: number | null = null;
  private last = 0;
  private disposed = false;
  private pick = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private bodies = new Map<string, BodyHandle>();
  private labelEls = new Map<string, HTMLElement>();
  private background: THREE.Points | null = null;
  private wallBand: THREE.Mesh | null = null;
  private analyst: THREE.LineSegments | null = null;
  private viewKey = "";
  private focusTween: { from: THREE.Vector3; to: THREE.Vector3; t: number } | null = null;
  private reduced: boolean;
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private onClick: (ev: PointerEvent) => void;
  private onResize: () => void;
  private host: HTMLElement;

  constructor(host: HTMLElement, labelHost: HTMLElement, store: EditorStore) {
    this.host = host;
    this.store = store;
    this.labelHost = labelHost;
    this.reduced = store.state.reducedMotion;
    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute("role", "img");
    this.canvas.setAttribute("aria-label", "STARSiLK star map viewport");
    host.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x05070d, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 400);
    this.camera.position.set(0, 18, 42);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = !this.reduced;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.6;
    this.controls.maxDistance = 160;
    this.controls.listenToKeyEvents(window);

    this.scene.fog = new THREE.FogExp2(0x05070d, 0.012);
    this.scene.add(new THREE.AmbientLight(0x6a8aa0, 0.35));
    const hemi = new THREE.HemisphereLight(0x9ad4e8, 0x0a121c, 0.55);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xe8f4ff, 0.9);
    key.position.set(6, 10, 4);
    this.scene.add(key);

    this.onClick = (ev) => this.handleClick(ev);
    this.onResize = () => this.resize();
    this.canvas.addEventListener("pointerdown", this.onClick);
    window.addEventListener("resize", this.onResize);
    this.resize();
    this.rebuild();
    this.renderer.setAnimationLoop((t) => this.loop(t));
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.canvas.removeEventListener("pointerdown", this.onClick);
    window.removeEventListener("resize", this.onResize);
    this.controls.dispose();
    this.clearView();
    this.renderer.dispose();
    this.canvas.remove();
    this.labelHost.replaceChildren();
  }

  focusEntity(id: string) {
    const handle = this.bodies.get(id);
    const target = handle
      ? handle.mesh.getWorldPosition(this.tmp.clone())
      : this.entityWorldPos(id);
    if (!target) return;
    if (this.reduced) {
      this.controls.target.copy(target);
      const offset = this.camera.position.clone().sub(this.controls.target);
      if (offset.length() < 0.2) offset.set(0, 2, 6);
      this.camera.position.copy(target).add(offset);
      return;
    }
    this.focusTween = {
      from: this.controls.target.clone(),
      to: target.clone(),
      t: 0,
    };
  }

  private entityWorldPos(id: string): THREE.Vector3 | null {
    const e = this.store.state.project.entities.find((x) => x.id === id);
    if (!e) return null;
    if (e.position) return new THREE.Vector3(e.position.x, e.position.y, e.position.z);
    return null;
  }

  private resize() {
    const w = Math.max(this.host.clientWidth, 32);
    const h = Math.max(this.host.clientHeight, 32);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private loop(timeMs: number) {
    if (this.disposed) return;
    const t = timeMs * 0.001;
    const dt = Math.min(t - (this.last || t), 0.1);
    this.last = t;
    this.store.tick(dt);

    const key = this.viewSignature();
    if (key !== this.viewKey) this.rebuild();

    this.updateBodies();
    this.updateLabels();

    if (this.focusTween) {
      this.focusTween.t += dt / 0.55;
      const k = 1 - Math.pow(1 - Math.min(this.focusTween.t, 1), 3);
      this.controls.target.lerpVectors(this.focusTween.from, this.focusTween.to, k);
      if (this.focusTween.t >= 1) this.focusTween = null;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private viewSignature(): string {
    const s = this.store.state;
    const hist = s.project.entities
      .map((e) => `${e.id}:${resolveHistoricalTime(s.project, e.id).value}`)
      .join("|");
    return [
      s.viewScale,
      s.focusId,
      s.project.settings.labels,
      s.project.settings.orbitPaths,
      s.project.settings.trails,
      s.project.settings.analystOverlay,
      s.project.settings.canonOnly,
      s.project.settings.galaxyHistoricalTime,
      s.project.entities.length,
      hist,
    ].join("/");
  }

  private rebuild() {
    this.viewKey = this.viewSignature();
    this.clearView();
    const scale = this.store.state.viewScale;
    this.canvas.dataset.view = scale;
    try {
      if (scale === "system") this.buildSystem();
      else this.buildGalaxy(scale);
      this.canvas.dataset.error = "";
    } catch (err) {
      this.canvas.dataset.error = err instanceof Error ? err.message : String(err);
      console.error("[cartographer] rebuild failed", err);
    }
  }

  private clearView() {
    for (const h of this.bodies.values()) {
      this.disposeObject(h.mesh);
      if (h.orbitLine) this.disposeObject(h.orbitLine);
      if (h.trail) this.disposeObject(h.trail);
    }
    this.bodies.clear();
    this.background = null;
    this.wallBand = null;
    this.analyst = null;
    const keep = new Set(["AmbientLight", "HemisphereLight", "DirectionalLight"]);
    for (const child of [...this.scene.children]) {
      if (keep.has(child.type)) continue;
      this.disposeObject(child);
    }
    this.labelHost.replaceChildren();
    this.labelEls.clear();
    this.focusTween = null;
  }

  private resetCamera(position: THREE.Vector3, target: THREE.Vector3, min: number, max: number) {
    this.controls.minDistance = min;
    this.controls.maxDistance = max;
    this.controls.target.copy(target);
    this.camera.position.copy(position);
    this.camera.lookAt(target);
    this.controls.update();
  }

  private disposeObject(obj: THREE.Object3D) {
    obj.removeFromParent();
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    });
  }

  private buildGalaxy(scale: ViewScale) {
    const project = this.store.state.project;
    this.resetCamera(new THREE.Vector3(0, 22, 54), new THREE.Vector3(0, 0, 0), 8, 160);

    this.background = this.makeBackgroundStars(project);
    this.scene.add(this.background);

    const wall = project.entities.find((e) => e.type === "largeScaleStructure" && /siege wall/i.test(e.name));
    const wallView = wall ? resolveHistoricalView(project, wall) : null;
    const wallPresent = !!wallView?.present;
    if (wallPresent) this.applyWallAbsence();

    const rootId =
      scale === "sector"
        ? this.store.state.focusId
        : project.entities.find((e) => e.type === "galaxy")?.id ?? null;

    const show = project.entities.filter((e) => {
      if (!isEntityVisible(project, e)) return false;
      if (scale === "galaxy") {
        if (e.type === "starfield" || e.type === "largeScaleStructure") return true;
        if (e.type === "system") return true;
        if (e.type === "blackHole") {
          const p = entityMap(project).get(e.parentId ?? "");
          return p?.type === "largeScaleStructure";
        }
        return false;
      }
      if (!rootId) return e.type === "system";
      if (e.id === rootId) return true;
      if (e.parentId === rootId) return true;
      const parent = entityMap(project).get(e.parentId ?? "");
      return parent?.parentId === rootId && e.type === "system";
    });

    for (const e of show) {
      this.addGalaxyMarker(e, wallPresent);
    }

    if (wallPresent && this.store.state.project.settings.analystOverlay && wall) {
      this.addAnalystOverlay(wall);
    }
  }

  private makeBackgroundStars(project: StarMapProject): THREE.Points {
    const n = project.settings.backgroundStarCount;
    const rng = mulberry32(project.settings.backgroundStarSeed);
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const r = GALAXY_R * Math.pow(rng(), 0.55);
      const theta = rng() * Math.PI * 2;
      const y = (rng() - 0.5) * 10 * (1 - r / GALAXY_R);
      positions[i * 3] = Math.cos(theta) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(theta) * r;
      const cool = rng() > 0.2;
      col.set(cool ? 0xb7e7f4 : 0xffe1b0);
      col.multiplyScalar(0.35 + rng() * 0.65);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      sizeAttenuation: true,
      depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.userData.kind = "background";
    return pts;
  }

  private applyWallAbsence() {
    if (!this.background) return;
    const pos = this.background.geometry.getAttribute("position") as THREE.BufferAttribute;
    const col = this.background.geometry.getAttribute("color") as THREE.BufferAttribute;
    const domain = this.store.state.project.entities.find((e) => e.id === "sec-drakken");
    const cx = domain?.position?.x ?? 4;
    const cy = domain?.position?.y ?? 16;
    const cz = domain?.position?.z ?? 4;
    const axis = new THREE.Vector3(cx, cy, cz).normalize();
    for (let i = 0; i < pos.count; i++) {
      this.tmp.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
      const along = this.tmp.dot(axis);
      if (along > 0.42 && along < 0.92) {
        col.setXYZ(i, 0.01, 0.012, 0.016);
      }
    }
    col.needsUpdate = true;

    const band = new THREE.Mesh(
      new THREE.SphereGeometry(GALAXY_R * 0.92, 48, 24, 0, Math.PI * 2, 0.55, 0.55),
      new THREE.MeshBasicMaterial({
        color: 0x03050a,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    band.lookAt(axis);
    band.userData.kind = "wall-absence";
    this.wallBand = band;
    this.scene.add(band);
  }

  private addAnalystOverlay(wall: Entity) {
    const locks = childrenOf(this.store.state.project, wall.id).filter((c) => c.type === "blackHole");
    if (locks.length < 2) return;
    const pts: number[] = [];
    for (let i = 0; i < locks.length; i++) {
      const a = locks[i].position;
      const b = locks[(i + 1) % locks.length].position;
      if (!a || !b) continue;
      pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0x55dfff,
      transparent: true,
      opacity: 0.28,
    });
    this.analyst = new THREE.LineSegments(geo, mat);
    this.analyst.userData.kind = "analyst";
    this.scene.add(this.analyst);
  }

  private addGalaxyMarker(e: Entity, wallPresent: boolean) {
    const view = resolveHistoricalView(this.store.state.project, e);
    const pos = e.position ?? { x: 0, y: 0, z: 0 };
    let mesh: THREE.Object3D;
    if (e.type === "blackHole" || view.type === "blackHole") {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), makeBlackHoleMaterial());
      mesh = m;
    } else if (e.type === "starfield") {
      const g = new THREE.Group();
      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.55, 0),
        bodyMaterial(e.visual?.color ?? "#4ba7db", 0.25),
      );
      g.add(core);
      mesh = g;
    } else if (e.type === "largeScaleStructure") {
      if (!wallPresent) return;
      mesh = new THREE.Group();
    } else {
      mesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.28, 0),
        bodyMaterial(e.visual?.color ?? "#e4bd46", 0.4),
      );
    }
    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.userData.entityId = e.id;
    this.scene.add(mesh);
    this.bodies.set(e.id, { id: e.id, mesh, trailPts: [] });
    if (e.type === "starfield" || e.type === "largeScaleStructure" || e.type === "system") {
      this.makeLabel(e, view.name);
    }
  }

  private buildSystem() {
    const project = this.store.state.project;
    const sysId = this.store.state.focusId;
    const sys = project.entities.find((e) => e.id === sysId);
    if (!sys) return;
    this.resetCamera(new THREE.Vector3(0, 3.2, 8), new THREE.Vector3(0, 0, 0), 0.8, 48);

    const grid = new THREE.PolarGridHelper(14, 16, 8, 64, 0x1a2736, 0x121b28);
    grid.userData.helper = true;
    if (project.settings.referenceGrid) this.scene.add(grid);

    const sysView = resolveHistoricalView(project, sys);
    this.addSystemTree(sys, new THREE.Group(), sysView.collapsed);
  }

  private addSystemTree(entity: Entity, parent: THREE.Object3D, systemDestroyed: boolean) {
    const project = this.store.state.project;
    const view = resolveHistoricalView(project, entity);
    if (!view.present && entity.type !== "system") return;

    const group = new THREE.Group();
    group.userData.entityId = entity.id;

    if (entity.type === "system") {
      this.scene.add(group);
    } else {
      parent.add(group);
      const mesh = this.makeBodyMesh(entity, view);
      mesh.userData.entityId = entity.id;
      group.add(mesh);
      let orbitLine: THREE.Line | undefined;
      if (entity.orbit && this.store.state.project.settings.orbitPaths && view.orbit) {
        orbitLine = this.makeOrbitLine(view.orbit, entity.type === "bloodRing");
        parent.add(orbitLine);
      }
      const handle: BodyHandle = { id: entity.id, mesh: group, orbitLine, trailPts: [] };
      if (this.store.state.project.settings.trails && entity.orbit) {
        const trailGeo = new THREE.BufferGeometry();
        trailGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(MAX_TRAIL * 3), 3));
        const trail = new THREE.Line(
          trailGeo,
          new THREE.LineBasicMaterial({ color: 0x55dfff, transparent: true, opacity: 0.35 }),
        );
        trail.frustumCulled = false;
        parent.add(trail);
        handle.trail = trail;
      }
      this.bodies.set(entity.id, handle);
      this.makeLabel(entity, view.name);
    }

    for (const child of childrenOf(project, entity.id)) {
      if (systemDestroyed && child.type !== "blackHole" && child.type !== "star") {
        const cv = resolveHistoricalView(project, child);
        if (!cv.present) continue;
        if (cv.type !== "blackHole") continue;
      }
      this.addSystemTree(child, entity.type === "system" ? this.scene : group, systemDestroyed);
    }
  }

  private makeBodyMesh(entity: Entity, view: ReturnType<typeof resolveHistoricalView>): THREE.Object3D {
    const type = view.type;
    const radius = displayBodyRadius(view.visual?.displayRadius ?? entity.visual?.displayRadius ?? 0.4, type);
    const color = view.visual?.color ?? entity.visual?.color ?? "#c9d5df";
    if (type === "bloodRing") {
      const inner = entity.visual?.ringInner ?? 1.05;
      const outer = entity.visual?.ringOuter ?? 1.55;
      const thick = entity.visual?.ringThickness ?? 0.08;
      const torus = new THREE.TorusGeometry((inner + outer) * 0.22, thick, 12, 96);
      torus.rotateX(Math.PI / 2);
      const mesh = new THREE.Mesh(torus, makeBloodRingMaterial());
      mesh.scale.set(1, 1, 1.02);
      return mesh;
    }
    if (type === "blackHole") {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.SphereGeometry(radius * 0.7, 24, 18), makeBlackHoleMaterial()));
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 1.05, 0.015, 8, 48),
        new THREE.MeshBasicMaterial({ color: 0x1a2a36, transparent: true, opacity: 0.7 }),
      );
      halo.rotation.x = Math.PI / 2;
      g.add(halo);
      return g;
    }
    const geo = new THREE.IcosahedronGeometry(radius, type === "star" ? 2 : 1);
    const mat = bodyMaterial(color, view.visual?.emissive ?? (type === "star" ? 1.1 : 0.04));
    if (type === "star") {
      mat.emissiveIntensity = 1.2;
      mat.roughness = 0.35;
    }
    const mesh = new THREE.Mesh(geo, mat);
    if (entity.visual?.atmosphere) {
      const atmo = new THREE.Mesh(
        new THREE.IcosahedronGeometry(radius * 1.18, 1),
        atmosphereMaterial(entity.visual.atmosphereColor ?? color),
      );
      mesh.add(atmo);
    }
    return mesh;
  }

  private makeOrbitLine(orbit: NonNullable<Entity["orbit"]>, blood: boolean): THREE.Line {
    const samples = sampleOrbitPath(orbit, 160).map((p) => {
      const r = displayOrbitRadius(orbit.semiMajorAxis);
      const mag = Math.hypot(p.x, p.y, p.z) || 1;
      const s = r / (orbit.semiMajorAxis || 1);
      return new THREE.Vector3(p.x * s, p.z * s, p.y * s);
    });
    const geo = new THREE.BufferGeometry().setFromPoints(samples);
    const mat = new THREE.LineBasicMaterial({
      color: blood ? 0x6a1018 : 0x2a4a5e,
      transparent: true,
      opacity: blood ? 0.55 : 0.4,
    });
    const line = new THREE.Line(geo, mat);
    line.userData.helper = true;
    return line;
  }

  private updateBodies() {
    const project = this.store.state.project;
    const sim = this.store.state.simTime;
    const map = entityMap(project);
    for (const h of this.bodies.values()) {
      const e = map.get(h.id);
      if (!e?.orbit) continue;
      const view = resolveHistoricalView(project, e);
      if (!view.orbit) continue;
      const p = keplerPosition(view.orbit, sim);
      const r = displayOrbitRadius(view.orbit.semiMajorAxis);
      const s = r / (view.orbit.semiMajorAxis || 1);
      h.mesh.position.set(p.x * s, p.z * s, p.y * s);
      if (e.rotationPeriod) {
        h.mesh.rotation.y = (sim / e.rotationPeriod) * Math.PI * 2;
      }
      if (e.type === "bloodRing") {
        h.mesh.rotation.z = (e.orbit.inclination ?? 0.18);
      }
      if (h.trail) {
        h.trailPts.push(h.mesh.position.clone());
        if (h.trailPts.length > MAX_TRAIL) h.trailPts.shift();
        const arr = h.trail.geometry.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < MAX_TRAIL; i++) {
          const src = h.trailPts[Math.min(i, h.trailPts.length - 1)] ?? h.mesh.position;
          arr.setXYZ(i, src.x, src.y, src.z);
        }
        arr.needsUpdate = true;
        h.trail.geometry.setDrawRange(0, h.trailPts.length);
      }
    }
    const selected = this.store.state.selectionId;
    for (const h of this.bodies.values()) {
      h.mesh.traverse((c) => {
        const m = c as THREE.Mesh;
        if (!m.material || Array.isArray(m.material)) return;
        const mat = m.material as THREE.MeshStandardMaterial;
        if ("emissiveIntensity" in mat && h.id === selected && mat.userData._baseEmissive == null) {
          mat.userData._baseEmissive = mat.emissiveIntensity;
        }
      });
    }
  }

  private makeLabel(entity: Entity, name: string) {
    const el = document.createElement("div");
    el.className = "body-label";
    el.textContent = name;
    el.dataset.id = entity.id;
    this.labelHost.appendChild(el);
    this.labelEls.set(entity.id, el);
  }

  private updateLabels() {
    const show = this.store.state.project.settings.labels;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    for (const [id, el] of this.labelEls) {
      const handle = this.bodies.get(id);
      if (!handle || !show) {
        el.style.display = "none";
        continue;
      }
      handle.mesh.getWorldPosition(this.tmp);
      this.tmp2.copy(this.tmp).project(this.camera);
      if (this.tmp2.z > 1) {
        el.style.display = "none";
        continue;
      }
      const x = (this.tmp2.x * 0.5 + 0.5) * w;
      const y = (-this.tmp2.y * 0.5 + 0.5) * h;
      el.style.display = "block";
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }
  }

  private handleClick(ev: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    this.pick.setFromCamera(this.pointer, this.camera);
    const meshes: THREE.Object3D[] = [];
    for (const h of this.bodies.values()) meshes.push(h.mesh);
    const hits = this.pick.intersectObjects(meshes, true);
    if (!hits.length) return;
    let obj: THREE.Object3D | null = hits[0].object;
    while (obj && !obj.userData.entityId) obj = obj.parent;
    const id = obj?.userData.entityId as string | undefined;
    if (!id) return;
    this.store.select(id);
    if (ev.detail >= 2) {
      const e = this.store.state.project.entities.find((x) => x.id === id);
      if (e) this.store.drillInto(e);
    }
  }
}
