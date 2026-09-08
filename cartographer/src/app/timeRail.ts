/**
 * HISTORICAL TIME RAIL.
 *
 * The strongest control surface in the tool, because hierarchical historical time
 * is the point of the application. It shows, for the entity currently in scope:
 *
 *   • the resolved historical value and its label
 *   • INHERITED versus OVERRIDE, and which ancestor supplies the value
 *   • RETURN TO PARENT TIME
 *   • the era presets (editable), a scrubber over them, and an exact/custom input
 *   • event markers: applied events versus events still in the future
 *   • previous / next event jumps
 *
 * Changing the GALAXY value moves every inheriting descendant. Overriding a sector
 * moves only that branch and leaves siblings alone. Overriding a system or a single
 * body is likewise local. All of it is authored state (`entity.time`), never a
 * visual-only affordance.
 */

import {
  entityById,
  pathOf,
  returnToParentTime,
  setTimeOverride,
} from '../core/project';
import {
  atOrBefore,
  describeTime,
  orderedPresets,
  railStops,
  sortEvents,
} from '../core/time';
import {
  EVENT_TYPE_LABELS,
  type EraPreset,
  type TimeValue,
} from '../core/types';
import type { ResolvedEntity } from '../core/resolve';
import type { ProjectStore } from '../core/store';
import { button, el } from './dom';
import { numberInput, textInput } from './inspector';
import { openEventForm } from './eventForm';
import { infoDialog, type ShellRefs } from './shell';

export interface TimeRailOptions {
  refs: ShellRefs;
  store: ProjectStore;
  getResolution: () => Map<string, ResolvedEntity>;
}

export class TimeRail {
  private unsubscribe: (() => void) | null = null;
  private customInput: HTMLInputElement;
  private slider: HTMLInputElement;
  private scopeSelect: HTMLSelectElement;
  private railValue: HTMLElement;
  private railStatus: HTMLElement;
  private markers: HTMLElement;
  private eventsRow: HTMLElement;
  private controls: HTMLElement;
  private returnBtn: HTMLButtonElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private addEventBtn: HTMLButtonElement;
  private editPresetsBtn: HTMLButtonElement;

  constructor(private readonly options: TimeRailOptions) {
    const { refs } = options;

    this.scopeSelect = el('select', {
      class: 'sktc-select',
      ariaLabel: 'Historical time scope',
    }) as HTMLSelectElement;
    this.scopeSelect.addEventListener('change', () => {
      this.options.store.setUi({ railScopeId: this.scopeSelect.value || null });
    });

    this.railValue = el('div', { class: 'sktc-rail__value', text: '—' });
    this.railStatus = el('div', { class: 'sktc-rail__status' });

    this.eventsRow = el('div', {
      class: 'sktc-rail__events',
      role: 'group',
      ariaLabel: 'Event markers on the historical axis',
    });

    this.markers = refs.railMarkers;
    this.slider = refs.railSlider;

    this.customInput = el('input', {
      class: 'sktc-input',
      type: 'text',
      placeholder: 'YEAR OR ERA ID',
      ariaLabel: 'Exact historical value (war year or era id)',
    }) as HTMLInputElement;
    const applyCustom = button('SET', { title: 'Apply the exact value' });
    applyCustom.addEventListener('click', () => this.applyCustomValue());
    this.customInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.applyCustomValue();
      }
    });

    this.returnBtn = button('RETURN TO PARENT TIME', {
      title: 'Remove this scope’s override and resume inheriting from its parent',
    });
    this.returnBtn.addEventListener('click', () => this.returnToParent());

    this.prevBtn = button('◀ EVENT', { title: 'Jump to the previous event' });
    this.prevBtn.addEventListener('click', () => this.jumpEvent(-1));
    this.nextBtn = button('EVENT ▶', { title: 'Jump to the next event' });
    this.nextBtn.addEventListener('click', () => this.jumpEvent(1));

    this.addEventBtn = button('+ EVENT', { title: 'Add a historical event at the current time' });
    this.addEventBtn.addEventListener('click', () => void this.addEventDialog());

    this.editPresetsBtn = button('EDIT PRESETS', { title: 'Edit the era preset list' });
    this.editPresetsBtn.addEventListener('click', () => void this.presetsDialog());

    this.controls = el('div', { class: 'sktc-rail__controls' }, [
      this.prevBtn,
      this.nextBtn,
      this.returnBtn,
      this.addEventBtn,
      el('div', { class: 'sktc-rail__custom' }, [this.customInput, applyCustom]),
      this.editPresetsBtn,
    ]);

    refs.railScope.textContent = '';
    refs.railScope.append(
      el('div', { class: 'sktc-rail__title', text: 'HISTORICAL TIME · SCOPE' }),
      this.scopeSelect,
      this.railValue,
      this.railStatus,
    );

    refs.rail.textContent = '';
    refs.rail.append(
      refs.railScope,
      el('div', { class: 'sktc-rail__track' }, [this.eventsRow, this.markers, this.slider, this.controls]),
    );

    this.slider.addEventListener('input', () => {
      const stops = railStops(this.options.store.project.eraPresets);
      const index = Number.parseInt(this.slider.value, 10);
      const stop = stops[index];
      if (stop) this.setValue(stop.value);
    });
  }

  mount(): void {
    this.unsubscribe = this.options.store.subscribe(() => this.render());
    this.render();
  }

  destroy(): void {
    this.unsubscribe?.();
  }

  /* ------------------------------------------------------------- scope */

  private currentScopeId(): string {
    const store = this.options.store;
    const root = store.project.entities.find((e) => e.parentId === null);
    return store.ui.railScopeId ?? store.selectionId ?? root?.id ?? '';
  }

  private setValue(value: TimeValue): void {
    const id = this.currentScopeId();
    if (!id) return;
    const entity = entityById(this.options.store.project, id);
    if (!entity) return;
    this.options.store.commit(
      `Set historical time — ${entity.name}`,
      (draft) => {
        const next = setTimeOverride(draft, id, value);
        draft.entities = next.entities;
      },
      // Moving the historical lens is inspection: allowed in viewer mode.
      { kind: 'view' },
    );
    this.options.store.setStatus(
      `${entity.name.toUpperCase()} → ${describeTime(value, this.options.store.project.eraPresets)}${
        entity.parentId === null ? ' (galaxy scope: every inheriting branch follows)' : ' (override: siblings unaffected)'
      }`,
      'neutral',
    );
  }

  private returnToParent(): void {
    const id = this.currentScopeId();
    const entity = entityById(this.options.store.project, id);
    if (!entity || entity.parentId === null) return;
    this.options.store.commit(`Return ${entity.name} to parent time`, (draft) => {
      const next = returnToParentTime(draft, id);
      draft.entities = next.entities;
    });
    this.options.store.setStatus(`${entity.name.toUpperCase()} now inherits its parent’s historical time.`, 'neutral');
  }

  private applyCustomValue(): void {
    const raw = this.customInput.value.trim();
    if (!raw) return;
    const numeric = Number.parseFloat(raw);
    const value: TimeValue = Number.isFinite(numeric) && String(numeric) === raw.replace(/^\+/, '') ? numeric : raw;
    this.setValue(value);
  }

  private jumpEvent(direction: 1 | -1): void {
    const store = this.options.store;
    const id = this.currentScopeId();
    const entity = entityById(store.project, id);
    if (!entity) return;
    const resolution = this.options.getResolution().get(id);
    const now = resolution?.resolution.time ?? 0;
    const events = sortEvents(entity.timeline, store.project.eraPresets);
    if (events.length === 0) {
      store.setStatus('This scope has no authored events. Add one with + EVENT.', 'warn');
      return;
    }
    const target =
      direction === 1
        ? events.find((event) => !atOrBefore(event.time, now, store.project.eraPresets))
        : [...events].reverse().find((event) => !atOrBefore(now, event.time, store.project.eraPresets));
    if (!target) {
      store.setStatus(
        direction === 1 ? 'No later event on this scope.' : 'No earlier event on this scope.',
        'warn',
      );
      return;
    }
    this.setValue(target.time);
    store.select(id);
  }

  /* ------------------------------------------------------------- events */

  private async addEventDialog(): Promise<void> {
    const store = this.options.store;
    const id = this.currentScopeId();
    const entity = entityById(store.project, id);
    if (!entity) return;
    const resolution = this.options.getResolution().get(id);
    const now = resolution?.resolution.time ?? 0;
    await openEventForm({ refs: this.options.refs, store, entityId: id, defaultTime: now });
  }

  /* ------------------------------------------------------------- presets */

  private async presetsDialog(): Promise<void> {
    const store = this.options.store;
    const presets = orderedPresets(store.project.eraPresets);
    const rows: Array<{ preset: EraPreset; label: HTMLInputElement; order: HTMLInputElement; time: HTMLInputElement }> = [];

    const list = el('div', { class: 'sktc-stack' });
    for (const preset of presets) {
      const label = textInput(preset.label, () => {});
      const order = numberInput(preset.order, () => {}, { step: 1, ariaLabel: `${preset.id} order` });
      const time = textInput(
        typeof preset.time === 'number' ? String(preset.time) : '',
        () => {},
        { placeholder: preset.time === undefined ? 'undated' : 'year', ariaLabel: `${preset.id} war year` },
      );
      rows.push({ preset, label, order, time });
      list.append(
        el('div', { class: 'sktc-row sktc-row--3' }, [
          el('div', { class: 'sktc-field' }, [el('span', { class: 'sktc-field-label', text: preset.id }), label]),
          el('div', { class: 'sktc-field' }, [el('span', { class: 'sktc-field-label', text: 'ORDER' }), order]),
          el('div', { class: 'sktc-field' }, [el('span', { class: 'sktc-field-label', text: 'YEAR' }), time]),
        ]),
      );
    }

    const newId = textInput('', () => {}, { placeholder: 'new-preset-id', ariaLabel: 'New preset id' });
    const newLabel = textInput('', () => {}, { placeholder: 'NEW PRESET LABEL', ariaLabel: 'New preset label' });

    await infoDialog(this.options.refs, 'EDIT ERA PRESETS', [
      list,
      el('p', {
        class: 'sktc-note',
        text: 'This list is a working set of anchors, not an exhaustive history. Leaving YEAR empty keeps an anchor deliberately undated — as the main narrative must stay.',
      }),
      el('div', { class: 'sktc-row' }, [
        el('div', { class: 'sktc-field' }, [el('span', { class: 'sktc-field-label', text: 'ADD ID' }), newId]),
        el('div', { class: 'sktc-field' }, [el('span', { class: 'sktc-field-label', text: 'ADD LABEL' }), newLabel]),
      ]),
    ]);

    store.commit('Edit era presets', (draft) => {
      for (const row of rows) {
        const target = draft.eraPresets.find((p) => p.id === row.preset.id);
        if (!target) continue;
        target.label = row.label.value.trim() || target.label;
        const orderValue = Number.parseFloat(row.order.value);
        if (Number.isFinite(orderValue)) target.order = orderValue;
        const timeValue = row.time.value.trim();
        if (timeValue === '') delete target.time;
        else {
          const parsed = Number.parseFloat(timeValue);
          if (Number.isFinite(parsed)) target.time = parsed;
        }
      }
      const id = newId.value.trim();
      const label = newLabel.value.trim();
      if (id && label && !draft.eraPresets.some((p) => p.id === id)) {
        const maxOrder = draft.eraPresets.reduce((max, p) => Math.max(max, p.order), 0);
        draft.eraPresets.push({
          id,
          label,
          order: maxOrder + 5,
          canonStatus: 'provisional',
          description: 'Author-added era anchor.',
        });
      }
    });
    store.setStatus('Era presets updated.', 'neutral');
  }

  /* ------------------------------------------------------------- render */

  render(): void {
    const store = this.options.store;
    const project = store.project;
    const scopeId = this.currentScopeId();
    const scopeEntity = entityById(project, scopeId);
    const resolution = this.options.getResolution().get(scopeId);

    /* scope picker ---------------------------------------------------- */
    const chain = scopeEntity ? pathOf(project, scopeEntity.id) : [];
    const scopeChoices = chain.length > 0 ? chain : project.entities.slice(0, 1);
    const current = scopeEntity?.id ?? scopeChoices[0]?.id ?? '';
    this.scopeSelect.textContent = '';
    for (const entry of scopeChoices) {
      const option = el('option', {
        value: entry.id,
        text: `${entry.type.toUpperCase()} · ${entry.name}`,
      }) as HTMLOptionElement;
      option.selected = entry.id === current;
      this.scopeSelect.append(option);
    }
    const root = project.entities.find((e) => e.parentId === null);
    if (root && !scopeChoices.some((e) => e.id === root.id)) {
      const option = el('option', {
        value: root.id,
        text: `GALAXY · ${root.name}`,
      }) as HTMLOptionElement;
      this.scopeSelect.prepend(option);
    }
    this.scopeSelect.disabled = !store.authoringEnabled;

    /* value + status --------------------------------------------------- */
    const time = resolution?.resolution.time ?? 'main-narrative';
    const mode = resolution?.resolution.mode ?? 'inherit';
    this.railValue.textContent = describeTime(time, project.eraPresets);

    this.railStatus.textContent = '';
    const sourceId = resolution?.resolution.fromEntityId ?? null;
    const sourceName = sourceId ? (entityById(project, sourceId)?.name ?? sourceId) : 'PROJECT DEFAULT';
    this.railStatus.append(
      el('span', {
        class: `sktc-badge ${mode === 'override' ? 'sktc-badge--warn' : 'sktc-badge--thread'}`,
        text: mode === 'override' ? 'OVERRIDE' : 'INHERITED',
      }),
      el('span', {
        class: 'sktc-badge',
        text: mode === 'override' ? `SET ON ${sourceName.toUpperCase()}` : `FROM ${sourceName.toUpperCase()}`,
      }),
    );
    if (resolution && !resolution.present) {
      this.railStatus.append(
        el('span', {
          class: 'sktc-badge sktc-badge--danger',
          text: `ABSENT AT THIS ERA${resolution.absenceReason ? ` · ${resolution.absenceReason.toUpperCase()}` : ''}`,
        }),
      );
    }
    if (resolution?.systemDestroyed) {
      this.railStatus.append(
        el('span', { class: 'sktc-badge sktc-badge--danger', text: 'SYSTEM HISTORICALLY DESTROYED' }),
      );
    }
    if (resolution?.starCollapsed) {
      this.railStatus.append(el('span', { class: 'sktc-badge sktc-badge--danger', text: 'STELLAR COLLAPSE' }));
    }

    // Era navigation stays enabled for viewers; only authoring is gated.
    this.returnBtn.disabled = mode !== 'override' || scopeEntity?.parentId === null;
    this.prevBtn.disabled = false;
    this.nextBtn.disabled = false;
    this.addEventBtn.disabled = !store.authoringEnabled || !scopeEntity;
    this.editPresetsBtn.disabled = !store.authoringEnabled;

    /* preset markers + slider ------------------------------------------ */
    const stops = railStops(project.eraPresets);
    this.markers.textContent = '';
    for (const stop of stops) {
      const active = stop.value === time;
      const marker = el('button', {
        class: `sktc-marker${active ? ' sktc-marker--active' : ''}`,
        type: 'button',
        ariaPressed: String(active),
        title: describeTime(stop.value, project.eraPresets),
        onClick: () => this.setValue(stop.value),
      }, [
        el('span', { class: 'sktc-marker__dot', ariaHidden: 'true' }),
        el('span', { class: 'sktc-marker__text', text: stop.label }),
      ]);

      this.markers.append(marker);
    }

    const activeIndex = Math.max(
      0,
      stops.findIndex((stop) => stop.value === time),
    );
    this.slider.min = '0';
    this.slider.max = String(Math.max(stops.length - 1, 0));
    this.slider.step = '1';
    this.slider.value = String(activeIndex);
    this.slider.setAttribute(
      'aria-valuetext',
      describeTime(time, project.eraPresets),
    );
    this.slider.disabled = stops.length < 2;

    /* event markers ----------------------------------------------------- */
    this.eventsRow.textContent = '';
    const scopeEvents = scopeEntity ? sortEvents(scopeEntity.timeline, project.eraPresets) : [];
    if (scopeEvents.length === 0) {
      this.eventsRow.append(
        el('span', { class: 'sktc-hint', text: 'NO AUTHORED EVENTS ON THIS SCOPE' }),
      );
    }
    for (const event of scopeEvents) {
      const applied = atOrBefore(event.time, time, project.eraPresets);
      const destructive =
        event.eventType === 'destroyed' ||
        event.eventType === 'bloodRingDestroyed' ||
        event.eventType === 'starsilkExtractionCollapse';
      const marker = el('button', {
        class: `sktc-marker${applied ? ' sktc-marker--active' : ''}${destructive ? ' sktc-marker--destructive' : ''}`,
        type: 'button',
        title: `${describeTime(event.time, project.eraPresets)} — ${event.label} (${EVENT_TYPE_LABELS[event.eventType]})`,
        onClick: () => {
          this.setValue(event.time);
          store.select(scopeEntity!.id);
        },
      }, [
        el('span', { class: 'sktc-marker__dot', ariaHidden: 'true' }),
        el('span', { class: 'sktc-marker__text', text: `${describeTime(event.time, project.eraPresets)} · ${event.label}` }),
      ]);
      this.eventsRow.append(marker);
    }

    if (document.activeElement !== this.customInput) {
      this.customInput.value = String(time);
    }
  }
}
