import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAutosave,
  createIndexedDbStorage,
  createMemoryStorage,
  STORAGE_DB_NAME,
  STORAGE_RECORD_KEY,
  STORAGE_STORE_NAME,
  type ProjectStorage,
} from '../src/core/persistence';
import { ProjectStore } from '../src/core/store';
import { addEntity, createProject } from '../src/core/project';
import { parseProject, serializeProject } from '../src/core/schema';
import type { StarMapProject } from '../src/core/types';

const clearDatabase = async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(STORAGE_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
};

/** Write a raw record straight into the autosave store, bypassing validation. */
const seedRecord = async (value: unknown) => {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(STORAGE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const opened = request.result;
      if (!opened.objectStoreNames.contains(STORAGE_STORE_NAME)) {
        opened.createObjectStore(STORAGE_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORAGE_STORE_NAME, 'readwrite');
    tx.objectStore(STORAGE_STORE_NAME).put(value, STORAGE_RECORD_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
};

const seeded = (): StarMapProject => {
  let project = createProject({ title: 'Persistence Fixture', id: 'prj-persist' });
  const added = addEntity(project, { type: 'starfield', name: 'SECTOR P', parentId: 'galaxy-root' });
  project = added.project;
  const system = addEntity(project, { type: 'system', name: 'SYSTEM P1', parentId: added.entity.id });
  project = system.project;
  const star = addEntity(project, { type: 'star', name: 'STAR P', parentId: system.entity.id });
  return star.project;
};

beforeEach(async () => {
  await clearDatabase();
});

afterEach(async () => {
  vi.useRealTimers();
  await clearDatabase();
});

describe('memory storage', () => {
  it('round-trips a project and reports its kind', async () => {
    const storage = createMemoryStorage();
    expect(storage.kind).toBe('memory');
    expect(await storage.load()).toBeNull();

    const project = seeded();
    const record = await storage.save(project);
    expect(record.key).toBe(STORAGE_RECORD_KEY);
    expect(record.title).toBe('Persistence Fixture');

    const loaded = await storage.load();
    expect(loaded?.project).toEqual(project);
    expect(loaded?.project.entities).toHaveLength(project.entities.length);

    await storage.clear();
    expect(await storage.load()).toBeNull();
  });

  it('hands back copies, not live references', async () => {
    const storage = createMemoryStorage();
    const project = seeded();
    await storage.save(project);
    const loaded = await storage.load();
    loaded!.project.title = 'MUTATED';
    expect((await storage.load())!.project.title).toBe('Persistence Fixture');
  });
});

describe('IndexedDB storage (real code path, fake-indexeddb)', () => {
  it('persists across storage instances', async () => {
    const first = createIndexedDbStorage();
    expect(first.kind).toBe('indexeddb');
    await first.save(seeded());

    // A brand-new instance simulates a page reload.
    const second = createIndexedDbStorage();
    const loaded = await second.load();
    expect(loaded?.title).toBe('Persistence Fixture');
    expect(loaded?.project.entities.map((e) => e.name)).toEqual([
      'UNNAMED GALAXY',
      'SECTOR P',
      'SYSTEM P1',
      'STAR P',
    ]);
  });

  it('returns null when nothing has been saved', async () => {
    expect(await createIndexedDbStorage().load()).toBeNull();
  });

  it('refuses to restore a corrupt autosave record', async () => {
    await seedRecord({
      key: STORAGE_RECORD_KEY,
      savedAt: new Date().toISOString(),
      title: 'CORRUPT',
      project: { schemaVersion: 1, nope: true },
    });
    expect(await createIndexedDbStorage().load()).toBeNull();
  });

  it('overwrites the single active record rather than accumulating', async () => {
    const storage = createIndexedDbStorage();
    await storage.save(seeded());
    const renamed = { ...seeded(), title: 'RENAMED PLATE' };
    await storage.save(renamed);
    const loaded = await storage.load();
    expect(loaded?.title).toBe('RENAMED PLATE');
  });

  it('clears the stored record', async () => {
    const storage = createIndexedDbStorage();
    await storage.save(seeded());
    await storage.clear();
    expect(await storage.load()).toBeNull();
  });

  it('validates and normalises through the schema on the way in', async () => {
    const storage = createIndexedDbStorage();
    await storage.save(seeded());
    const loaded = await storage.load();
    // Whatever comes back must itself survive a serialize/parse cycle.
    expect(parseProject(serializeProject(loaded!.project)).ok).toBe(true);
    expect(loaded!.project.schemaVersion).toBe(1);
  });
});

describe('autosave', () => {
  const withStore = () => {
    const store = new ProjectStore(seeded());
    const storage = createMemoryStorage();
    const statuses: string[] = [];
    const autosave = createAutosave(
      (listener) => store.subscribe(listener),
      () => store.project,
      storage,
      { debounceMs: 25 },
    );
    autosave.onStatus((status) => statuses.push(status));
    autosave.start();
    return { store, storage, autosave, statuses };
  };

  it('starts saved, goes unsaved on a commit, and saves on flush', async () => {
    const { store, storage, autosave, statuses } = withStore();
    expect(autosave.getStatus()).toBe('saved');

    store.commit('rename', (draft) => {
      draft.title = 'AUTOSAVED PLATE';
    });
    expect(autosave.getStatus()).toBe('unsaved');

    await autosave.flush();
    expect(autosave.getStatus()).toBe('saved');
    expect(autosave.getLastSavedAt()).toBeTruthy();
    expect((await storage.load())!.project.title).toBe('AUTOSAVED PLATE');
    expect(statuses).toEqual(['unsaved', 'saving', 'saved']);
  });

  it('writes on the debounce without an explicit flush', async () => {
    const { store, storage, autosave } = withStore();
    store.commit('rename', (draft) => {
      draft.title = 'DEBOUNCED';
    });
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(autosave.getStatus()).toBe('saved');
    expect((await storage.load())!.project.title).toBe('DEBOUNCED');
  });

  it('coalesces a burst of edits into one write', async () => {
    const { store, storage } = withStore();
    for (let i = 0; i < 5; i += 1) {
      store.commit(`edit ${i}`, (draft) => {
        draft.title = `TITLE ${i}`;
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect((await storage.load())!.project.title).toBe('TITLE 4');
  });

  it('stop() prevents further writes', async () => {
    const { store, storage, autosave } = withStore();
    autosave.stop();
    store.commit('after stop', (draft) => {
      draft.title = 'SHOULD NOT SAVE';
    });
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(await storage.load()).toBeNull();
  });

  it('reports an error status when storage rejects', async () => {
    const store = new ProjectStore(seeded());
    const failing: ProjectStorage = {
      kind: 'memory',
      load: async () => null,
      save: async () => {
        throw new Error('quota exceeded');
      },
      clear: async () => {},
    };
    const autosave = createAutosave(
      (listener) => store.subscribe(listener),
      () => store.project,
      failing,
      { debounceMs: 10 },
    );
    const details: string[] = [];
    autosave.onStatus((_status, detail) => {
      if (detail) details.push(detail);
    });
    autosave.start();
    store.commit('edit', (draft) => {
      draft.title = 'X';
    });
    await autosave.flush();
    expect(autosave.getStatus()).toBe('error');
    expect(details.join(' ')).toContain('quota exceeded');
  });

  it('mirrors an entire authoring session that reloads intact', async () => {
    const store = new ProjectStore(seeded());
    const storage = createIndexedDbStorage();
    const autosave = createAutosave(
      (listener) => store.subscribe(listener),
      () => store.project,
      storage,
      { debounceMs: 5 },
    );
    autosave.start();

    store.commit('add moon', (draft) => {
      const star = draft.entities.find((e) => e.name === 'STAR P')!;
      const result = addEntity(draft, { type: 'planet', name: 'PLANET P', parentId: star.parentId! });
      draft.entities = result.project.entities;
    });
    store.commit('era override', (draft) => {
      draft.entities = draft.entities.map((e) =>
        e.id === 'galaxy-root'
          ? { ...e, time: { mode: 'override' as const, overrideValue: 121 } }
          : e,
      );
    });
    await autosave.flush();
    autosave.stop();

    // "Reload": a fresh store reads the autosaved document back from IndexedDB.
    const record = await createIndexedDbStorage().load();
    expect(record).toBeTruthy();
    const reloaded = new ProjectStore(record!.project);
    expect(reloaded.project.entities.map((e) => e.name)).toContain('PLANET P');
    expect(reloaded.project.entities.find((e) => e.id === 'galaxy-root')!.time).toEqual({
      mode: 'override',
      overrideValue: 121,
    });
    // The restored document must still be importable as-is.
    expect(parseProject(serializeProject(reloaded.project)).ok).toBe(true);
  });

  it('never persists UI-only or render state', async () => {
    const { store, storage, autosave } = withStore();
    store.setUi({ view: 'system', viewEntityId: 'x', railScopeId: 'y', drawer: 'hierarchy' });
    await autosave.flush();
    const saved = JSON.stringify((await storage.load())!.project);
    expect(saved).not.toContain('railScopeId');
    expect(saved).not.toContain('Object3D');
    expect(saved).not.toContain('THREE');
    expect(saved).toContain('"schemaVersion":1');
  });
});
