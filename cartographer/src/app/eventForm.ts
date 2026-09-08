/**
 * Historical event form, shared by the time rail and the inspector timeline.
 *
 * One accessible dialog, one code path: adding and editing an event behave the
 * same everywhere in the tool.
 */

import { addTimelineEvent, entityById, updateTimelineEvent, removeTimelineEvent } from '../core/project';
import { describeTime } from '../core/time';
import {
  CANON_STATUSES,
  CANON_STATUS_LABELS,
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  type CanonStatus,
  type HistoricalEventType,
  type TimelineEvent,
  type TimeValue,
} from '../core/types';
import type { ProjectStore } from '../core/store';
import { el } from './dom';
import { numberInput, selectInput, textInput } from './inspector';
import { confirmDialog, infoDialog, type ShellRefs } from './shell';

function parseTimeValue(raw: string, fallback: TimeValue): TimeValue {
  const trimmed = raw.trim();
  if (trimmed === '') return fallback;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number.parseFloat(trimmed);
  return trimmed;
}

export interface EventFormOptions {
  refs: ShellRefs;
  store: ProjectStore;
  entityId: string;
  /** Omit to create a new event. */
  event?: TimelineEvent;
  defaultTime?: TimeValue;
}

export async function openEventForm(options: EventFormOptions): Promise<void> {
  const { refs, store, entityId, event } = options;
  const entity = entityById(store.project, entityId);
  if (!entity) return;

  const defaultTime = event?.time ?? options.defaultTime ?? 0;
  const labelInput = textInput(event?.label ?? '', () => {}, {
    placeholder: 'What happened?',
    ariaLabel: 'Event label',
  });
  const timeInput = textInput(String(defaultTime), () => {}, {
    placeholder: 'war year or era id',
    ariaLabel: 'Event time',
  });
  const typeSelect = selectInput<HistoricalEventType>(
    event?.eventType ?? 'annotation',
    EVENT_TYPES,
    EVENT_TYPE_LABELS,
    () => {},
    'Event type',
  );
  const statusSelect = selectInput<CanonStatus>(
    event?.canonStatus ?? store.project.settings.defaultCanonStatus,
    CANON_STATUSES,
    CANON_STATUS_LABELS,
    () => {},
    'Event canon status',
  );
  const noteInput = textInput(event?.sourceNote ?? '', () => {}, {
    placeholder: 'Source note / provenance',
    ariaLabel: 'Event source note',
  });
  const hrefInput = textInput(event?.sourceHref ?? '', () => {}, {
    placeholder: 'https://…',
    ariaLabel: 'Event source URL',
  });
  const patchInput = el('textarea', {
    class: 'sktc-textarea',
    text: event?.statePatch ? JSON.stringify(event.statePatch, null, 2) : '',
    ariaLabel: 'State patch (JSON)',
  }) as HTMLTextAreaElement;

  const form = el('div', { class: 'sktc-stack' }, [
    el('div', { class: 'sktc-field' }, [el('span', { class: 'sktc-field-label', text: 'LABEL' }), labelInput]),
    el('div', { class: 'sktc-row' }, [
      el('div', { class: 'sktc-field' }, [el('span', { class: 'sktc-field-label', text: 'TIME' }), timeInput]),
      el('div', { class: 'sktc-field' }, [el('span', { class: 'sktc-field-label', text: 'TYPE' }), typeSelect]),
    ]),
    el('div', { class: 'sktc-field' }, [
      el('span', { class: 'sktc-field-label', text: 'CANON STATUS' }),
      statusSelect,
    ]),
    el('div', { class: 'sktc-field' }, [
      el('span', { class: 'sktc-field-label', text: 'SOURCE NOTE' }),
      noteInput,
    ]),
    el('div', { class: 'sktc-field' }, [
      el('span', { class: 'sktc-field-label', text: 'SOURCE URL' }),
      hrefInput,
    ]),
    el('div', { class: 'sktc-field' }, [
      el('span', { class: 'sktc-field-label', text: 'STATE PATCH (JSON)' }),
      patchInput,
      el('p', {
        class: 'sktc-hint',
        text: 'Discrete properties applied from this event onwards, e.g. { "type": "blackHole" } or { "name": "NEW NAME" }. Leave empty for a pure annotation.',
      }),
    ]),
  ]);

  await infoDialog(refs, event ? `EDIT EVENT — ${entity.name}` : `ADD EVENT — ${entity.name}`, [
    form,
    el('p', {
      class: 'sktc-note',
      text: 'CREATED / DESTROYED / BLOOD RING / STARSiLK EXTRACTION COLLAPSE events change what exists at an era. RENAMED and VISUAL CHANGE patch discrete properties. Nothing is interpolated.',
    }),
  ]);

  const label = labelInput.value.trim();
  if (!label) return;
  const time = parseTimeValue(timeInput.value, defaultTime);

  let statePatch: Record<string, unknown> | undefined;
  const patchText = patchInput.value.trim();
  if (patchText) {
    try {
      const parsed = JSON.parse(patchText) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        statePatch = parsed as Record<string, unknown>;
      } else {
        store.setStatus('STATE PATCH must be a JSON object — event not saved.', 'danger');
        return;
      }
    } catch (error) {
      store.setStatus(`STATE PATCH is not valid JSON: ${(error as Error).message}`, 'danger');
      return;
    }
  }

  const payload: Omit<TimelineEvent, 'id'> = {
    time,
    label,
    eventType: typeSelect.value as HistoricalEventType,
    canonStatus: statusSelect.value as CanonStatus,
    sourceNote: noteInput.value.trim() || undefined,
    sourceHref: hrefInput.value.trim() || undefined,
    statePatch,
  };

  if (event) {
    store.commit(`Edit event “${label}”`, (draft) => {
      const next = updateTimelineEvent(draft, entityId, event.id, (target) => {
        Object.assign(target, payload);
        if (!payload.statePatch) delete target.statePatch;
      });
      draft.entities = next.entities;
    });
    store.setStatus(`Event updated at ${describeTime(time, store.project.eraPresets)}.`, 'neutral');
  } else {
    store.commit(`Add event “${label}”`, (draft) => {
      const result = addTimelineEvent(draft, entityId, payload);
      draft.entities = result.project.entities;
    });
    store.setStatus(`Event added at ${describeTime(time, store.project.eraPresets)}.`, 'neutral');
  }
}

export async function confirmDeleteEvent(
  refs: ShellRefs,
  store: ProjectStore,
  entityId: string,
  event: TimelineEvent,
): Promise<void> {
  const entity = entityById(store.project, entityId);
  const ok = await confirmDialog(refs, {
    title: 'DELETE EVENT',
    message: `Delete “${event.label}” from ${entity?.name ?? entityId}? Anything it changed will no longer happen at that era. Undoable with Ctrl+Z.`,
    confirmLabel: 'DELETE EVENT',
    tone: 'danger',
  });
  if (!ok) return;
  store.commit(`Delete event “${event.label}”`, (draft) => {
    const next = removeTimelineEvent(draft, entityId, event.id);
    draft.entities = next.entities;
  });
  store.setStatus('Event deleted.', 'neutral');
}

export { numberInput };
