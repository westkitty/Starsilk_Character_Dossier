/**
 * Renderer orchestrator.
 *
 * Owns the WebGL context, the render loop, the two view builders (galaxy / system),
 * picking, labels, and camera framing. It reads the store but never writes authored
 * data; selection is the one thing it writes back, which keeps 3D picking and the
 * hierarchy tree synchronised by construction.
 */

import * as THREE from 'three';
import type { ProjectStore } from '../core/store';
import type { Entity, StarMapProject } from '../core/types';
import { entityById, pathOf, TYPE_GLYPHS } from '../core/project';
import { ALWAYS_PRESENT, deriveGalaxy, deriveSystemBodies, type DerivationContext } from './derive';
import { framingDistance } from './scale';
import { CameraRig } from './camera';
import { LabelLayer, type LabelRequest } from './labels';
import { GalaxyView, type WallRegion } from './galaxy';
import { SystemView } from './system';

export interface RendererOptions {
  canvasHost: HTMLElement;
  overlayHost: HTMLElement;
  fallbackHost: HTMLElement;
  store: ProjectStore;
  reducedMotion: boolean;
  /** Simulation days provider — the renderer never owns the clock. */
  getDays: () => boolean | number;
  /** Per-frame hook so the owner can advance its own clock. */
  onFrame?: (deltaSeconds: number) => void;
  onStatus?: (message: string) => void;
}

type ViewKind = 'galaxy' | 'sector' | 'system';

export class StarMapRenderer {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private rig: CameraRig | null = null;
  private labels: LabelLayer;
  private galaxy = new GalaxyView();
  private system = new SystemView();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private resizeObserver: ResizeObserver | null = null;
  private loopId: number | null = null;
  private lastFrame = 0;
  private unsubscribe: (() => void) | null = null;
  private context: DerivationContext = ALWAYS_PRESENT;
  private reducedMotion: boolean;
  private disposed = false;
  private builtSignature = '';
  private pointerDown: { x: number; y: number; time: number } | null = null;
  private width = 1;
  private height = 1;
  private wallRegions: WallRegion[] = [];
  private galaxyRadius = 120;
  private grid: THREE.PolarGridHelper | null = null;

  constructor(private readonly options: RendererOptions) {
    this.reducedMotion = options.reducedMotion;
    this.labels = new LabelLayer(options.overlayHost);
    this.scene.background = new THREE.Color('#05070d');
    this.scene.add(new THREE.AmbientLight(new THREE.Color('#2b4055'), 1.5));
    const rim = new THREE.DirectionalLight(new THREE.Color('#a6efff'), 0.5);
    rim.position.set(-1, 0.7, -0.6);
    this.scene.add(rim);
    // Cartographic reference plane (toggleable).
    const grid = new THREE.PolarGridHelper(120, 8, 6, 96, 0x27374b, 0x16202e);
    const gridMaterial = grid.material as THREE.Material;
    gridMaterial.transparent = true;
    gridMaterial.opacity = 0.4;
    gridMaterial.depthWrite = false;
    this.grid = grid;
    this.scene.add(grid);
    this.scene.add(this.galaxy.group);
    this.scene.add(this.system.group);
  }

  /* ------------------------------------------------------------- lifecycle */

  start(): boolean {
    if (this.renderer) return true;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      this.showFallback('WEBGL UNAVAILABLE — HISTORICAL AND AUTHORING CONTROLS REMAIN ACTIVE');
      return false;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(new THREE.Color('#05070d'), 1);
    this.options.canvasHost.append(renderer.domElement);
    this.renderer = renderer;

    this.rig = new CameraRig(renderer.domElement, { reducedMotion: this.reducedMotion });
    this.attachPointerEvents(renderer.domElement);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.options.canvasHost);
    this.resize();

    this.unsubscribe = this.options.store.subscribe((change) => {
      if (this.disposed) return;
      if (change === 'project') this.rebuild();
      else if (change === 'selection') this.applySelection();
      else this.applyViewState();
    });

    renderer.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.stopLoop();
      this.showFallback('GRAPHICS CONTEXT LOST — RELOAD THE ARCHIVE PLATE');
    });

    this.rebuild();
    this.startLoop();
    this.hideFallback();
    return true;
  }

  private showFallback(message: string): void {
    this.options.fallbackHost.textContent = '';
    const p = document.createElement('p');
    p.textContent = message;
    this.options.fallbackHost.append(p);
    this.options.fallbackHost.style.display = '';
  }

  private hideFallback(): void {
    this.options.fallbackHost.style.display = 'none';
  }

  setHistoricalContext(context: DerivationContext): void {
    this.context = context;
    this.rebuild();
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    this.rig?.setReducedMotion(reduced);
  }

  /** Force a rebuild on the next frame (used after era changes). */
  invalidate(): void {
    this.builtSignature = '';
    this.rebuild();
  }

  /* ------------------------------------------------------------- building */

  private signature(): string {
    const store = this.options.store;
    const ui = store.ui;
    return [
      store.project.updatedAt ?? '',
      store.project.entities.length,
      ui.view,
      ui.viewEntityId ?? '',
      store.project.settings.render.showOrbitPaths,
      store.project.settings.render.showTrails,
      store.project.settings.render.trailSamples,
      store.project.settings.render.starfieldDensity,
      store.project.settings.render.showAnalystOverlay,
      this.contextSignature(),
    ].join('|');
  }

  /** Era state changes the scene even when the document has not been edited. */
  private contextSignature(): string {
    if (this.context === ALWAYS_PRESENT) return 'present';
    const store = this.options.store;
    return store.project.entities
      .map((e) => `${e.id}:${this.context.present(e.id) ? 1 : 0}:${this.context.effectiveType(e)}`)
      .join(',');
  }

  rebuild(): void {
    if (!this.renderer || this.disposed) return;
    const signature = this.signature();
    if (signature === this.builtSignature) return;
    this.builtSignature = signature;
    this.applyViewState(true);
  }

  private galaxyRadiusFor(project: StarMapProject): number {
    let max = 0;
    for (const entity of project.entities) {
      if (!entity.position) continue;
      const d = Math.hypot(entity.position.x, entity.position.y, entity.position.z);
      if (Number.isFinite(d)) max = Math.max(max, d);
    }
    return Math.max(max * 1.6, 90);
  }

  private applyViewState(force = false): void {
    if (!this.renderer || this.disposed) return;
    const store = this.options.store;
    const ui = store.ui;
    const project = store.project;
    const view: ViewKind = ui.view;

    const derived = deriveGalaxy(project, this.context);
    this.galaxyRadius = this.galaxyRadiusFor(project);

    if (this.grid) {
      this.grid.visible = project.settings.render.showReferenceGrid;
      const base = view === 'system' ? 24 : this.galaxyRadius;
      this.grid.scale.setScalar(Math.max(base / 120, 0.05));
    }

    const wall = derived.structures.find((s) => s.kind === 'siegeWall');
    this.wallRegions =
      wall && wall.present
        ? [
            {
              center: new THREE.Vector3(wall.center.x, wall.center.y, wall.center.z),
              radius: wall.radius,
            },
          ]
        : [];

    if (view === 'system' && ui.viewEntityId && entityById(project, ui.viewEntityId)) {
      this.galaxy.group.visible = false;
      this.system.group.visible = true;
      const bodies = deriveSystemBodies(project, ui.viewEntityId, this.context);
      this.system.build(bodies, {
        showOrbitPaths: project.settings.render.showOrbitPaths,
        showTrails: project.settings.render.showTrails,
        trailSamples: project.settings.render.trailSamples,
      });
      this.system.setSelection(store.selectionId);
      if (force || !this.hasFramed(`system:${ui.viewEntityId}`)) {
        const target = this.focusTargetFor(store.selectionId ?? ui.viewEntityId);
        this.rig?.focusOn(
          target.position,
          framingDistance(this.system.framingRadius),
          new THREE.Vector3(0.2, 0.5, 1).normalize(),
        );
        this.markFramed(`system:${ui.viewEntityId}`);
      }
      this.updateSystemMotion(this.currentDays());
    } else {
      this.system.group.visible = false;
      this.galaxy.group.visible = true;
      this.galaxy.build({
        derived,
        starCount: project.settings.render.starfieldDensity,
        seed: project.id,
        galaxyRadius: this.galaxyRadius,
        wallRegions: this.wallRegions,
        wallActive: this.wallRegions.length > 0,
        showAnalystOverlay: project.settings.render.showAnalystOverlay,
      });

      if (view === 'sector' && ui.viewEntityId) {
        const sector = derived.sectors.find((s) => s.entityId === ui.viewEntityId);
        if (sector && (force || !this.hasFramed(`sector:${sector.entityId}`))) {
          this.rig?.focusOn(
            new THREE.Vector3(sector.center.x, sector.center.y, sector.center.z),
            Math.max(sector.radius * 2.6, 40),
            new THREE.Vector3(0.15, 0.75, 1).normalize(),
          );
          this.markFramed(`sector:${sector.entityId}`);
        }
      } else if (force || !this.hasFramed('galaxy')) {
        this.rig?.focusOn(
          new THREE.Vector3(0, 0, 0),
          this.galaxyRadius * 1.9,
          new THREE.Vector3(0.2, 0.65, 1).normalize(),
        );
        this.markFramed('galaxy');
      }
    }
    this.applySelection();
  }

  private framedKeys = new Set<string>();
  private hasFramed(key: string): boolean {
    return this.framedKeys.has(key);
  }
  private markFramed(key: string): void {
    this.framedKeys.clear();
    this.framedKeys.add(key);
  }

  /* ------------------------------------------------------------- navigation */

  /** Ancestor system of any entity (or the entity itself when it is a system). */
  systemIdFor(entityId: string | null): string | null {
    if (!entityId) return null;
    const project = this.options.store.project;
    const chain = pathOf(project, entityId);
    for (let i = chain.length - 1; i >= 0; i -= 1) {
      if (chain[i]!.type === 'system') return chain[i]!.id;
    }
    return null;
  }

  enterSystem(entityId: string): void {
    const systemId = this.systemIdFor(entityId);
    if (!systemId) return;
    this.options.store.setUi({
      view: 'system',
      viewEntityId: systemId,
      focusEntityId: entityId,
    });
    this.options.store.select(entityId);
  }

  enterSector(entityId: string): void {
    this.options.store.setUi({ view: 'sector', viewEntityId: entityId, focusEntityId: entityId });
  }

  /** Hierarchy-up: system → sector → galaxy. */
  goUp(): void {
    const store = this.options.store;
    const ui = store.ui;
    if (ui.view === 'system' && ui.viewEntityId) {
      const parent = entityById(store.project, ui.viewEntityId)?.parentId;
      if (parent) {
        store.setUi({ view: 'sector', viewEntityId: parent, focusEntityId: parent });
        return;
      }
    }
    store.setUi({ view: 'galaxy', viewEntityId: null, focusEntityId: null });
  }

  focusEntity(entityId: string): void {
    const target = this.focusTargetFor(entityId);
    this.rig?.focusOn(target.position, target.distance);
    this.options.store.setUi({ focusEntityId: entityId });
  }

  private focusTargetFor(entityId: string | null): { position: THREE.Vector3; distance: number } {
    if (this.system.group.visible && entityId && this.system.has(entityId)) {
      const positions = this.system.worldPositions();
      const position = positions.get(entityId) ?? new THREE.Vector3();
      return { position, distance: 16 };
    }
    if (entityId) {
      const marker = this.galaxy.markerPosition(entityId);
      if (marker) return { position: marker, distance: 46 };
      const entity = entityById(this.options.store.project, entityId);
      if (entity?.position) {
        return {
          position: new THREE.Vector3(entity.position.x, entity.position.y, entity.position.z),
          distance: 60,
        };
      }
    }
    return { position: new THREE.Vector3(), distance: this.galaxyRadius * 1.9 };
  }

  resetCamera(): void {
    const store = this.options.store;
    if (store.ui.view === 'system') {
      this.rig?.reset(new THREE.Vector3(), framingDistance(this.system.framingRadius));
      return;
    }
    if (store.ui.view === 'sector' && store.ui.viewEntityId) {
      const entity = entityById(store.project, store.ui.viewEntityId);
      const position = entity?.position
        ? new THREE.Vector3(entity.position.x, entity.position.y, entity.position.z)
        : new THREE.Vector3();
      this.rig?.reset(position, 90);
      return;
    }
    this.rig?.reset(new THREE.Vector3(), this.galaxyRadius * 1.9);
  }

  /* ------------------------------------------------------------- selection */

  private applySelection(): void {
    const selectionId = this.options.store.selectionId;
    if (this.system.group.visible) this.system.setSelection(selectionId);
    this.lastLabelMode = '';
  }

  private lastLabelMode = '';

  /* ------------------------------------------------------------- interaction */

  private attachPointerEvents(dom: HTMLElement): void {
    dom.addEventListener('pointerdown', (event) => {
      this.pointerDown = { x: event.clientX, y: event.clientY, time: performance.now() };
    });
    dom.addEventListener('pointerup', (event) => {
      const down = this.pointerDown;
      this.pointerDown = null;
      if (!down) return;
      const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
      const elapsed = performance.now() - down.time;
      if (moved > 6 || elapsed > 600) return;
      const hit = this.pick(event);
      if (hit) {
        this.options.store.select(hit.entityId);
        if (hit.pickKind === 'system' && this.options.store.ui.view !== 'system') {
          this.focusEntity(hit.entityId);
        }
      } else {
        this.options.store.select(null);
      }
    });
    dom.addEventListener('dblclick', (event) => {
      const hit = this.pick(event);
      if (!hit) return;
      if (this.options.store.ui.view === 'system') {
        this.focusEntity(hit.entityId);
      } else if (hit.pickKind === 'system') {
        this.enterSystem(hit.entityId);
      } else if (hit.pickKind === 'sector') {
        this.enterSector(hit.entityId);
      }
    });
  }

  private pick(event: { clientX: number; clientY: number }): {
    entityId: string;
    pickKind: string;
  } | null {
    if (!this.renderer || !this.rig) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.rig.camera);
    const active = this.system.group.visible ? this.system.pickables : this.galaxy.pickables;
    const hits = this.raycaster.intersectObjects(active, true);
    for (const hit of hits) {
      let object: THREE.Object3D | null = hit.object;
      while (object) {
        const data = object.userData as { entityId?: string; pickKind?: string };
        if (data?.entityId) return { entityId: data.entityId, pickKind: data.pickKind ?? 'body' };
        object = object.parent;
      }
    }
    return null;
  }

  /* ------------------------------------------------------------- loop */

  private currentDays(): number {
    const days = this.options.getDays();
    return typeof days === 'number' ? days : 0;
  }

  private updateSystemMotion(days: number): void {
    const settings = this.options.store.project.settings.render;
    this.system.update(days, {
      showOrbitPaths: settings.showOrbitPaths,
      showTrails: settings.showTrails,
      trailSamples: settings.trailSamples,
    });
  }

  private startLoop(): void {
    if (this.loopId !== null) return;
    this.lastFrame = performance.now();
    const frame = (now: number) => {
      if (this.disposed || !this.renderer || !this.rig) return;
      const delta = Math.min((now - this.lastFrame) / 1000, 0.1);
      this.lastFrame = now;
      this.options.onFrame?.(delta);
      this.rig.update(delta);
      if (this.system.group.visible) this.updateSystemMotion(this.currentDays());
      this.renderLabels();
      this.renderer.render(this.scene, this.rig.camera);
      this.loopId = requestAnimationFrame(frame);
    };
    this.loopId = requestAnimationFrame(frame);
  }

  private stopLoop(): void {
    if (this.loopId !== null) {
      cancelAnimationFrame(this.loopId);
      this.loopId = null;
    }
  }

  /* ------------------------------------------------------------- labels */

  private renderLabels(): void {
    if (!this.rig) return;
    const settings = this.options.store.project.settings.render;
    const mode = settings.labelMode;
    if (mode === 'none') {
      if (this.lastLabelMode !== 'none') {
        this.labels.clear();
        this.lastLabelMode = 'none';
      }
      return;
    }
    const requests: LabelRequest[] = [];
    const selectionId = this.options.store.selectionId;

    if (this.system.group.visible) {
      const positions = this.system.worldPositions();
      const project = this.options.store.project;
      for (const [id, position] of positions) {
        const entity = entityById(project, id);
        if (!entity) continue;
        const major = entity.type === 'star' || entity.type === 'planet' || entity.type === 'blackHole';
        if (mode === 'selected' && id !== selectionId) continue;
        if (mode === 'major' && !major && id !== selectionId) continue;
        requests.push({
          id,
          text: entity.name,
          glyph: TYPE_GLYPHS[entity.type] ?? '·',
          position,
          selected: id === selectionId,
        });
      }
    } else {
      const derived = deriveGalaxy(this.options.store.project, this.context);
      const entries: Array<{ id: string; name: string; type: Entity['type']; position: THREE.Vector3 }> = [];
      for (const sector of derived.sectors) {
        if (!sector.present) continue;
        entries.push({
          id: sector.entityId,
          name: sector.name,
          type: 'starfield',
          position: new THREE.Vector3(sector.center.x, sector.center.y + sector.radius * 0.12, sector.center.z),
        });
      }
      for (const system of derived.systems) {
        if (!system.present) continue;
        entries.push({
          id: system.entityId,
          name: system.name,
          type: 'system',
          position: new THREE.Vector3(system.position.x, system.position.y + 2.4, system.position.z),
        });
      }
      for (const structure of derived.structures) {
        if (!structure.present) continue;
        entries.push({
          id: structure.entityId,
          name: structure.name,
          type: 'largeScaleStructure',
          position: new THREE.Vector3(structure.center.x, structure.center.y + structure.radius * 0.2, structure.center.z),
        });
      }
      for (const entry of entries) {
        const major = entry.type !== 'system';
        if (mode === 'selected' && entry.id !== selectionId) continue;
        if (mode === 'major' && !major && entry.id !== selectionId) continue;
        requests.push({
          id: entry.id,
          text: entry.name,
          glyph: TYPE_GLYPHS[entry.type] ?? '·',
          position: entry.position,
          selected: entry.id === selectionId,
        });
      }
    }
    this.lastLabelMode = mode;
    this.labels.sync(requests, this.rig.camera, this.width, this.height);
  }

  /* ------------------------------------------------------------- sizing */

  private resize(): void {
    if (!this.renderer) return;
    const host = this.options.canvasHost;
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.rig?.resize(width, height);
  }

  /* ------------------------------------------------------------- teardown */

  dispose(): void {
    this.disposed = true;
    this.stopLoop();
    this.unsubscribe?.();
    this.resizeObserver?.disconnect();
    this.labels.dispose();
    this.galaxy.dispose();
    this.system.dispose();
    this.rig?.dispose();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
    this.renderer = null;
  }
}
