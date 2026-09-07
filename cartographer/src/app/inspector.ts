/**
 * Inspector panel.
 *
 * Sections: IDENTITY · ORBIT · VISUAL · TIMELINE · CANON.
 * Every control writes through `store.commit`, so each edit is undoable and
 * autosaved. Sections that do not apply to the selected entity are omitted rather
 * than shown disabled — an archive lists what a record actually contains.
 */

import {
  entityById,
  pathOf,
  TYPE_GLYPHS,
} from '../core/project';
import { CANON_STATUSES, CANON_STATUS_LABELS, ENTITY_TYPES, type Entity } from '../core/types';
import type { ProjectStore } from '../core/store';
import { el, field, nextFieldId, type Child } from './dom';
import type { ShellRefs } from './shell';

export interface InspectorHooks {
  /** Rendered by later phases: orbit, visual, timeline, provenance extras. */
  renderOrbit?: (entity: Entity) => HTMLElement | null;
  renderVisual?: (entity: Entity) => HTMLElement | null;
  renderTimeline?: (entity: Entity) => HTMLElement | null;
  renderHistorical?: (entity: Entity) => HTMLElement | null;
  onSelectEntity?: (entityId: string) => void;
}

export function section(title: string, body: Child[], extra?: Child): HTMLElement {
  return el('section', { class: 'sktc-section' }, [
    el('h3', {}, [el('span', { text: title }), extra ?? null]),
    el('div', { class: 'sktc-section-body' }, body),
  ]);
}

export function textInput(
  value: string,
  onCommit: (value: string) => void,
  options: { placeholder?: string; ariaLabel?: string; type?: string } = {},
): HTMLInputElement {
  const input = el('input', {
    class: 'sktc-input',
    type: options.type ?? 'text',
    value,
    placeholder: options.placeholder ?? '',
    ariaLabel: options.ariaLabel ?? '',
  }) as HTMLInputElement;
  input.addEventListener('change', () => onCommit(input.value));
  return input;
}

export function numberInput(
  value: number,
  onCommit: (value: number) => void,
  options: { step?: number; min?: number; max?: number; ariaLabel?: string } = {},
): HTMLInputElement {
  const input = el('input', {
    class: 'sktc-input',
    type: 'number',
    value: String(value),
    step: String(options.step ?? 'any'),
    min: options.min === undefined ? undefined : String(options.min),
    max: options.max === undefined ? undefined : String(options.max),
    ariaLabel: options.ariaLabel ?? '',
  }) as HTMLInputElement;
  input.addEventListener('change', () => {
    const parsed = Number.parseFloat(input.value);
    if (Number.isFinite(parsed)) onCommit(parsed);
    else input.value = String(value);
  });
  return input;
}

export function selectInput<T extends string>(
  value: T,
  choices: readonly T[],
  labels: Record<T, string>,
  onCommit: (value: T) => void,
  ariaLabel?: string,
): HTMLSelectElement {
  const select = el('select', { class: 'sktc-select', ariaLabel: ariaLabel ?? '' }) as HTMLSelectElement;
  for (const choice of choices) {
    const option = el('option', { value: choice, text: labels[choice] }) as HTMLOptionElement;
    option.selected = choice === value;
    select.append(option);
  }
  select.addEventListener('change', () => onCommit(select.value as T));
  return select;
}

export function checkboxInput(
  checked: boolean,
  label: string,
  onCommit: (checked: boolean) => void,
): HTMLElement {
  const id = nextFieldId('chk');
  const input = el('input', { type: 'checkbox', id, checked }) as HTMLInputElement;
  input.addEventListener('change', () => onCommit(input.checked));
  return el('label', { class: 'sktc-flex', htmlFor: id, style: 'cursor:pointer' }, [
    input,
    el('span', { class: 'sktc-field-label', text: label }),
  ]);
}

export function canonBadge(status: Entity['meta']['canonStatus']): HTMLElement {
  return el('span', {
    class: `sktc-canon sktc-canon--${status}`,
    text: CANON_STATUS_LABELS[status],
  });
}

export class InspectorPanel {
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly refs: ShellRefs,
    private readonly store: ProjectStore,
    private hooks: InspectorHooks = {},
  ) {}

  setHooks(hooks: InspectorHooks): void {
    this.hooks = hooks;
    this.render();
  }

  mount(): void {
    this.unsubscribe = this.store.subscribe((change) => {
      if (change === 'project' || change === 'selection') this.render();
    });
    this.render();
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  render(): void {
    const body = this.refs.inspectorBody;
    body.textContent = '';
    const entity = entityById(this.store.project, this.store.selectionId);
    if (!entity) {
      body.append(
        el('p', {
          class: 'sktc-empty',
          text: 'NO SELECTION — PICK A BODY IN THE ATLAS OR THE HIERARCHY',
        }),
      );
      return;
    }
    body.append(this.renderIdentity(entity));
    const historical = this.hooks.renderHistorical?.(entity);
    if (historical) body.append(historical);
    const orbit = this.hooks.renderOrbit?.(entity);
    if (orbit) body.append(orbit);
    const visual = this.hooks.renderVisual?.(entity);
    if (visual) body.append(visual);
    const timeline = this.hooks.renderTimeline?.(entity);
    if (timeline) body.append(timeline);
    body.append(this.renderCanon(entity));
  }

  private renderIdentity(entity: Entity): HTMLElement {
    const project = this.store.project;
    const path = pathOf(project, entity.id);
    const nameInput = textInput(entity.name, (value) => {
      this.store.commit('Rename entity', (draft) => {
        const target = entityById(draft, entity.id);
        if (target && value.trim()) target.name = value.trim();
      });
    }, { ariaLabel: 'Entity name' });
    nameInput.disabled = !this.store.authoringEnabled;

    const typeSelect = selectInput(entity.type, ENTITY_TYPES, {
      galaxy: 'GALAXY',
      starfield: 'SECTOR / STARFIELD',
      system: 'SOLAR SYSTEM',
      star: 'STAR',
      blackHole: 'BLACK HOLE',
      planet: 'PLANET',
      moon: 'MOON',
      bloodRing: 'BLOOD RING',
      orbitalStructure: 'ORBITAL STRUCTURE',
      largeScaleStructure: 'LARGE-SCALE STRUCTURE',
      other: 'OBJECT',
    }, (value) => {
      this.store.commit('Change entity type', (draft) => {
        const target = entityById(draft, entity.id);
        if (target) target.type = value;
      });
    }, 'Entity type');
    typeSelect.disabled = !this.store.authoringEnabled;

    const descInput = el('textarea', {
      class: 'sktc-textarea',
      text: entity.meta.description ?? '',
      ariaLabel: 'Description',
    }) as HTMLTextAreaElement;
    descInput.disabled = !this.store.authoringEnabled;
    descInput.addEventListener('change', () => {
      const value = descInput.value;
      this.store.commit('Edit description', (draft) => {
        const target = entityById(draft, entity.id);
        if (target) target.meta.description = value;
      });
    });

    const tagsInput = textInput((entity.meta.tags ?? []).join(', '), (value) => {
      const tags = value
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
      this.store.commit('Edit tags', (draft) => {
        const target = entityById(draft, entity.id);
        if (target) target.meta.tags = tags;
      });
    }, { placeholder: 'TAG, TAG', ariaLabel: 'Tags (comma separated)' });
    tagsInput.disabled = !this.store.authoringEnabled;

    const idName = nextFieldId('name');
    const typeId = nextFieldId('type');

    return section('IDENTITY', [
      el('div', { class: 'sktc-flex' }, [
        el('span', { class: 'sktc-node-glyph', text: TYPE_GLYPHS[entity.type], ariaHidden: 'true' }),
        el('span', { class: 'sktc-prose', text: entity.name }),
      ]),
      field(idName, 'NAME', nameInput),
      field(typeId, 'TYPE', typeSelect),
      el('dl', { class: 'sktc-kv' }, [
        el('dt', { text: 'ID' }),
        el('dd', { text: entity.id }),
        el('dt', { text: 'PARENT' }),
        el('dd', {}, [
          entity.parentId
            ? (el('button', {
                class: 'sktc-link',
                style: 'background:none;border:none;padding:0;font:inherit;color:inherit;cursor:pointer',
                text: entityById(project, entity.parentId)?.name ?? entity.parentId,
                onClick: () => {
                  if (entity.parentId) {
                    this.store.select(entity.parentId);
                    this.hooks.onSelectEntity?.(entity.parentId);
                  }
                },
              }) as HTMLElement)
            : el('span', { text: '— (ROOT)' }),
        ]),
        el('dt', { text: 'PATH' }),
        el('dd', { text: path.map((entry) => entry.name).join(' › ') }),
      ]),
      field(nextFieldId('desc'), 'DESCRIPTION', descInput),
      field(nextFieldId('tags'), 'TAGS', tagsInput, 'Comma separated. Used by search and filters.'),
    ]);
  }

  private renderCanon(entity: Entity): HTMLElement {
    const statusSelect = selectInput(
      entity.meta.canonStatus,
      CANON_STATUSES,
      CANON_STATUS_LABELS,
      (value) => {
        this.store.commit('Change canon status', (draft) => {
          const target = entityById(draft, entity.id);
          if (target) target.meta.canonStatus = value;
        });
      },
      'Canon status',
    );
    statusSelect.disabled = !this.store.authoringEnabled;

    const sourceNote = el('textarea', {
      class: 'sktc-textarea',
      text: entity.meta.sourceNote ?? '',
      ariaLabel: 'Source note',
    }) as HTMLTextAreaElement;
    sourceNote.disabled = !this.store.authoringEnabled;
    sourceNote.addEventListener('change', () => {
      const value = sourceNote.value;
      this.store.commit('Edit source note', (draft) => {
        const target = entityById(draft, entity.id);
        if (target) target.meta.sourceNote = value;
      });
    });

    const sourceHref = textInput(entity.meta.sourceHref ?? '', (value) => {
      this.store.commit('Edit source URL', (draft) => {
        const target = entityById(draft, entity.id);
        if (target) target.meta.sourceHref = value;
      });
    }, { placeholder: 'https://…', ariaLabel: 'Source URL' });
    sourceHref.disabled = !this.store.authoringEnabled;

    const dossierHref = textInput(entity.meta.dossierHref ?? '', (value) => {
      this.store.commit('Edit dossier link', (draft) => {
        const target = entityById(draft, entity.id);
        if (target) target.meta.dossierHref = value;
      });
    }, { placeholder: './entities/fallenstar-prime/', ariaLabel: 'Dossier anchor' });
    dossierHref.disabled = !this.store.authoringEnabled;

    const warnings: Node[] = [];
    if (entity.meta.canonStatus === 'schematic') {
      warnings.push(
        el('p', {
          class: 'sktc-warning',
          text: 'SCHEMATIC / NON-CANON — this record is a cartographic convenience. Coordinates and placement here are not canon and must not be cited as such.',
        }),
      );
    }
    if (entity.meta.canonStatus === 'provisional') {
      warnings.push(
        el('p', {
          class: 'sktc-note',
          text: 'PROVISIONAL — subject to revision; record the source before promoting.',
        }),
      );
    }

    return section('CANON', [
      field(nextFieldId('canon'), 'CANON STATUS', statusSelect),
      el('div', {}, [canonBadge(entity.meta.canonStatus)]),
      field(nextFieldId('srcnote'), 'SOURCE NOTE', sourceNote),
      field(nextFieldId('srchref'), 'SOURCE URL', sourceHref),
      field(nextFieldId('dossier'), 'DOSSIER ANCHOR', dossierHref, 'Relative link into the published Compendium.'),
      entity.meta.dossierHref
        ? el('p', {}, [
            el('a', {
              class: 'sktc-link',
              href: entity.meta.dossierHref,
              target: '_blank',
              rel: 'noreferrer noopener',
              text: 'OPEN DOSSIER ENTRY ↗',
            }) as HTMLElement,
          ])
        : null,
      ...warnings,
    ]);
  }
}
