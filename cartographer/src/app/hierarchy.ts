/**
 * Hierarchy panel: searchable, keyboard-navigable entity tree.
 *
 * Selection is owned by the store, so 3D picking and this tree can never drift:
 * both write `store.selectionId` and both re-render from the same event.
 */

import { childrenOf, entityById, rootEntity, TYPE_GLYPHS } from '../core/project';
import type { Entity, StarMapProject } from '../core/types';
import type { ProjectStore } from '../core/store';
import { el } from './dom';
import type { ShellRefs } from './shell';

export interface HierarchyDecorations {
  /** Historically absent at the resolved era (still listed, visibly struck out). */
  isAbsent?: (id: string) => boolean;
  /** Small right-hand tag, e.g. INHERITED / OVERRIDE / the resolved era. */
  tag?: (entity: Entity) => { text: string; tone: 'override' | 'inherit' | 'absent' } | null;
}

export interface HierarchyCallbacks {
  onActivate?: (entityId: string) => void;
}

interface RowInfo {
  element: HTMLElement;
  entityId: string;
  depth: number;
  hasChildren: boolean;
  parentId: string | null;
}

export class HierarchyPanel {
  private rows: RowInfo[] = [];
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly refs: ShellRefs,
    private readonly store: ProjectStore,
    private decorations: HierarchyDecorations = {},
    private callbacks: HierarchyCallbacks = {},
  ) {}

  mount(): void {
    this.refs.hierarchySearch.addEventListener('input', () => {
      this.store.setUi({ hierarchyQuery: this.refs.hierarchySearch.value });
      this.render();
    });
    this.refs.hierarchyBody.addEventListener('keydown', (event) => this.onKeyDown(event));
    this.unsubscribe = this.store.subscribe((change) => {
      if (change === 'project' || change === 'selection' || change === 'ui') this.render();
    });
    this.render();
  }

  setDecorations(decorations: HierarchyDecorations): void {
    this.decorations = decorations;
    this.render();
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  render(): void {
    const project = this.store.project;
    const body = this.refs.hierarchyBody;
    body.textContent = '';
    this.rows = [];
    const root = rootEntity(project);
    if (!root) {
      body.append(el('p', { class: 'sktc-empty', text: 'NO ROOT ENTITY' }));
      return;
    }
    const query = this.store.ui.hierarchyQuery.trim().toLowerCase();
    const tree = this.buildList(project, [root], 0, query);
    body.append(tree);
    this.syncAriaSelection();
  }

  private matches(entity: Entity, query: string): boolean {
    if (!query) return true;
    const haystack = [entity.name, entity.type, ...(entity.meta.tags ?? [])]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  }

  private subtreeMatches(project: StarMapProject, entity: Entity, query: string): boolean {
    if (this.matches(entity, query)) return true;
    return childrenOf(project, entity.id).some((child) => this.subtreeMatches(project, child, query));
  }

  private buildList(
    project: StarMapProject,
    entities: Entity[],
    depth: number,
    query: string,
  ): HTMLElement {
    const list = el('ul', { class: 'sktc-tree', role: depth === 0 ? undefined : 'group' });
    for (const entity of entities) {
      if (query && !this.subtreeMatches(project, entity, query)) continue;
      const kids = childrenOf(project, entity.id);
      const expanded = query ? true : this.store.ui.expandedIds.includes(entity.id);
      const item = el('li', { role: 'none' });

      const tags: HTMLElement[] = [];
      const decoration = this.decorations.tag?.(entity);
      if (decoration) {
        tags.push(
          el('span', {
            class: `sktc-node-tag sktc-node-tag--${decoration.tone}`,
            text: decoration.text,
          }),
        );
      }
      const absent = this.decorations.isAbsent?.(entity.id) ?? false;
      if (absent) {
        tags.push(el('span', { class: 'sktc-node-tag sktc-node-tag--absent', text: 'ABSENT' }));
      }

      const row = el('div', {
        class: 'sktc-node-row',
        role: 'treeitem',
        tabindex: '-1',
        ariaLevel: String(depth + 1),
        ariaSelected: this.store.selectionId === entity.id ? 'true' : 'false',
        ariaExpanded: kids.length > 0 ? String(expanded) : undefined,
        dataset: { id: entity.id },
      }, [
        el('span', {
          class: 'sktc-node-caret',
          text: kids.length > 0 ? (expanded ? '▾' : '▸') : '',
          ariaHidden: 'true',
        }),
        el('span', {
          class: 'sktc-node-glyph',
          text: TYPE_GLYPHS[entity.type] ?? '·',
          ariaHidden: 'true',
        }),
        el('span', { class: 'sktc-node-name', text: entity.name }),
        ...tags,
      ]);

      row.addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        if (target.classList.contains('sktc-node-caret') && kids.length > 0) {
          this.store.toggleExpanded(entity.id);
          return;
        }
        this.store.select(entity.id);
        this.callbacks.onActivate?.(entity.id);
        row.focus();
      });
      row.addEventListener('dblclick', () => {
        if (kids.length > 0) this.store.toggleExpanded(entity.id);
      });

      item.append(row);
      this.rows.push({
        element: row,
        entityId: entity.id,
        depth,
        hasChildren: kids.length > 0,
        parentId: entity.parentId,
      });

      if (expanded && kids.length > 0) {
        item.append(this.buildList(project, kids, depth + 1, query));
      }
      list.append(item);
    }
    return list;
  }

  private syncAriaSelection(): void {
    for (const row of this.rows) {
      row.element.setAttribute(
        'aria-selected',
        row.entityId === this.store.selectionId ? 'true' : 'false',
      );
      row.element.parentElement?.classList.toggle(
        'sktc-node--absent',
        this.decorations.isAbsent?.(row.entityId) ?? false,
      );
    }
    // Keep the selected row scrolled into view after a 3D pick.
    const selected = this.rows.find((row) => row.entityId === this.store.selectionId);
    selected?.element.scrollIntoView({ block: 'nearest' });
  }

  private onKeyDown(event: KeyboardEvent): void {
    const rows = this.rows;
    if (rows.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const index = rows.findIndex((row) => row.element === active);
    const current = index >= 0 ? rows[index]! : rows[0]!;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        const next = rows[Math.min(index + 1, rows.length - 1)] ?? rows[rows.length - 1]!;
        next.element.focus();
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        const prev = rows[Math.max(index - 1, 0)]!;
        prev.element.focus();
        break;
      }
      case 'ArrowRight': {
        event.preventDefault();
        if (current.hasChildren && !this.store.ui.expandedIds.includes(current.entityId)) {
          this.store.toggleExpanded(current.entityId, true);
        } else if (current.hasChildren) {
          this.rows[index + 1]?.element.focus();
        }
        break;
      }
      case 'ArrowLeft': {
        event.preventDefault();
        if (current.hasChildren && this.store.ui.expandedIds.includes(current.entityId)) {
          this.store.toggleExpanded(current.entityId, false);
        } else if (current.parentId) {
          const parent = this.rows.find((row) => row.entityId === current.parentId);
          parent?.element.focus();
        }
        break;
      }
      case 'Home': {
        event.preventDefault();
        rows[0]!.element.focus();
        break;
      }
      case 'End': {
        event.preventDefault();
        rows[rows.length - 1]!.element.focus();
        break;
      }
      case 'Enter':
      case ' ': {
        event.preventDefault();
        this.store.select(current.entityId);
        this.callbacks.onActivate?.(current.entityId);
        break;
      }
      default:
        break;
    }
  }
}

/** Breadcrumb path (galaxy → sector → system) for the viewport header. */
export function breadcrumbEntries(project: StarMapProject, entityId: string | null): Entity[] {
  if (!entityId) return [];
  const entity = entityById(project, entityId);
  if (!entity) return [];
  const chain: Entity[] = [];
  let cursor: Entity | undefined = entity;
  const guard = new Set<string>();
  while (cursor && !guard.has(cursor.id)) {
    guard.add(cursor.id);
    chain.unshift(cursor);
    cursor = cursor.parentId ? entityById(project, cursor.parentId) : undefined;
  }
  return chain;
}
