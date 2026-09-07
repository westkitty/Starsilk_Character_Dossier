/**
 * Cheap DOM label layer.
 *
 * Labels are HTML, not sprites: they stay crisp at any zoom, cost nothing when the
 * count is low, and can be hidden wholesale for performance. Only entities the
 * current label mode asks for are projected each frame.
 */

import * as THREE from 'three';

export interface LabelRequest {
  id: string;
  text: string;
  glyph?: string;
  position: THREE.Vector3;
  selected?: boolean;
  /** Historically absent entities are shown struck through when they are shown at all. */
  absent?: boolean;
}

interface LabelNode {
  element: HTMLElement;
  text: string;
}

export class LabelLayer {
  private nodes = new Map<string, LabelNode>();
  private scratch = new THREE.Vector3();

  constructor(private readonly host: HTMLElement) {}

  sync(requests: LabelRequest[], camera: THREE.Camera, width: number, height: number): void {
    const seen = new Set<string>();
    for (const request of requests) {
      seen.add(request.id);
      let node = this.nodes.get(request.id);
      if (!node) {
        const element = document.createElement('div');
        element.className = 'sktc-label';
        node = { element, text: '' };
        this.nodes.set(request.id, node);
        this.host.appendChild(element);
      }
      this.scratch.copy(request.position).project(camera);
      const behind = this.scratch.z > 1;
      if (behind) {
        node.element.style.display = 'none';
        continue;
      }
      const x = (this.scratch.x * 0.5 + 0.5) * width;
      const y = (-this.scratch.y * 0.5 + 0.5) * height;
      if (x < -120 || y < -60 || x > width + 120 || y > height + 60) {
        node.element.style.display = 'none';
        continue;
      }
      const text = request.glyph ? `${request.glyph} ${request.text}` : request.text;
      if (node.text !== text) {
        node.element.textContent = text;
        node.text = text;
      }
      node.element.style.display = '';
      node.element.style.left = `${x.toFixed(1)}px`;
      node.element.style.top = `${y.toFixed(1)}px`;
      node.element.style.zIndex = String(Math.round((1 - this.scratch.z) * 1000));
      const className = `sktc-label${request.selected ? ' sktc-label--selected' : ''}${
        request.absent ? ' sktc-label--absent' : ''
      }`;
      if (node.element.className !== className) node.element.className = className;
    }
    for (const [id, node] of [...this.nodes]) {
      if (!seen.has(id)) {
        node.element.remove();
        this.nodes.delete(id);
      }
    }
  }

  clear(): void {
    for (const node of this.nodes.values()) node.element.remove();
    this.nodes.clear();
  }

  dispose(): void {
    this.clear();
  }
}
