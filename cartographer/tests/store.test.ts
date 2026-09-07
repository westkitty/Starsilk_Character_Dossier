import { describe, expect, it, vi } from 'vitest';
import { ProjectStore } from '../src/core/store';
import { createProject, addEntity, removeEntity, renameEntity } from '../src/core/project';
import { createAutosave, createMemoryStorage } from '../src/core/persistence';

describe('ProjectStore undo/redo', () => {
  it('survives a complete rename → undo → redo cycle', () => {
    const project = createProject({ title: 'Undo Test' });
    const withPlanet = addEntity(project, {
      type: 'starfield',
      name: 'PHAROS NEBULA',
      parentId: 'galaxy-root',
    });
    const store = new ProjectStore(withPlanet.project);
    const sectorId = withPlanet.entity.id;

    store.commit('Rename sector', (draft) => {
      const target = draft.entities.find((e) => e.id === sectorId);
      if (target) target.name = 'RENAMED SECTOR';
    });
    expect(store.project.entities.find((e) => e.id === sectorId)?.name).toBe('RENAMED SECTOR');
    expect(store.undoLabel).toBe('Rename sector');

    expect(store.undo()).toBe(true);
    expect(store.project.entities.find((e) => e.id === sectorId)?.name).toBe('PHAROS NEBULA');

    expect(store.redo()).toBe(true);
    expect(store.project.entities.find((e) => e.id === sectorId)?.name).toBe('RENAMED SECTOR');
    expect(store.canUndo).toBe(true);
    expect(store.canRedo).toBe(false);
  });

  it('restores deleted subtrees on undo', () => {
    const project = createProject();
    const sector = addEntity(project, { type: 'starfield', name: 'SECTOR', parentId: 'galaxy-root' });
    const system = addEntity(sector.project, {
      type: 'system',
      name: 'SYSTEM',
      parentId: sector.entity.id,
    });
    const store = new ProjectStore(system.project);
    store.commit('Delete sector', (draft) => {
      const next = removeEntity(draft, sector.entity.id);
      draft.entities = next.entities;
    });
    expect(store.project.entities).toHaveLength(1);
    store.undo();
    expect(store.project.entities).toHaveLength(3);
    expect(store.project.entities.some((e) => e.name === 'SYSTEM')).toBe(true);
    store.redo();
    expect(store.project.entities).toHaveLength(1);
  });

  it('clears redo history when a new edit lands', () => {
    const store = new ProjectStore(createProject());
    store.commit('A', (draft) => {
      draft.title = 'A';
    });
    store.commit('B', (draft) => {
      draft.title = 'B';
    });
    store.undo();
    expect(store.canRedo).toBe(true);
    store.commit('C', (draft) => {
      draft.title = 'C';
    });
    expect(store.canRedo).toBe(false);
  });

  it('drops a selection that no longer exists after undo', () => {
    const project = createProject();
    const sector = addEntity(project, { type: 'starfield', name: 'SECTOR', parentId: 'galaxy-root' });
    const store = new ProjectStore(sector.project);
    store.select(sector.entity.id);
    store.commit('Delete sector', (draft) => {
      draft.entities = removeEntity(draft, sector.entity.id).entities;
    });
    expect(store.selectionId).toBe(null);
  });

  it('refuses mutations when authoring is disabled', () => {
    const store = new ProjectStore(createProject());
    store.authoringEnabled = false;
    const applied = store.commit('Should not apply', (draft) => {
      draft.title = 'MUTATED';
    });
    expect(applied).toBe(false);
    expect(store.project.title).toBe('Untitled STARSiLK Star Map');
  });

  it('notifies subscribers with the change kind', () => {
    const store = new ProjectStore(createProject());
    const listener = vi.fn();
    store.subscribe(listener);
    store.select('galaxy-root');
    store.commit('Edit', (draft) => {
      draft.title = 'Changed';
    });
    expect(listener).toHaveBeenCalledWith('selection');
    expect(listener).toHaveBeenCalledWith('project');
  });
});

describe('autosave', () => {
  it('debounces writes and reports status transitions', async () => {
    vi.useFakeTimers();
    try {
      const storage = createMemoryStorage();
      const store = new ProjectStore(createProject({ title: 'Autosave Test' }));
      const autosave = createAutosave(
        (listener) => store.subscribe(listener),
        () => store.project,
        storage,
        { debounceMs: 500 },
      );
      const statuses: string[] = [];
      autosave.onStatus((status) => statuses.push(status));
      autosave.start();

      store.commit('Edit title', (draft) => {
        draft.title = 'Edited';
      });
      expect(autosave.getStatus()).toBe('unsaved');

      await vi.advanceTimersByTimeAsync(600);
      expect(autosave.getStatus()).toBe('saved');

      const stored = await storage.load();
      expect(stored?.project.title).toBe('Edited');
      expect(statuses).toEqual(['unsaved', 'saving', 'saved']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('flush() writes immediately', async () => {
    const storage = createMemoryStorage();
    const store = new ProjectStore(createProject({ title: 'Flush' }));
    const autosave = createAutosave(
      (listener) => store.subscribe(listener),
      () => store.project,
      storage,
    );
    autosave.start();
    store.commit('Edit', (draft) => {
      draft.title = 'Flushed';
    });
    await autosave.flush();
    expect((await storage.load())?.project.title).toBe('Flushed');
  });
});

describe('renameEntity helper', () => {
  it('returns a new project object', () => {
    const project = createProject();
    const next = renameEntity(project, 'galaxy-root', 'NEW NAME');
    expect(next).not.toBe(project);
    expect(next.entities[0]!.name).toBe('NEW NAME');
    expect(project.entities[0]!.name).toBe('UNNAMED GALAXY');
  });
});
