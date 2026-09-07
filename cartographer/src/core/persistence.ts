/**
 * Browser-local persistence.
 *
 * Autosave uses IndexedDB (with an in-memory fallback for environments without
 * it, including unit tests). Explicit import/export uses portable JSON files.
 * There is no backend, no account, and no network call anywhere in this module.
 */

import { validateProject } from './schema';
import type { StarMapProject } from './types';

export const STORAGE_DB_NAME = 'starsilk-cartographer';
export const STORAGE_STORE_NAME = 'projects';
export const STORAGE_RECORD_KEY = 'active-project';

export interface StoredProjectRecord {
  key: string;
  project: StarMapProject;
  savedAt: string;
  /** Title snapshot for the "restore previous session" affordance. */
  title: string;
}

export interface ProjectStorage {
  readonly kind: 'indexeddb' | 'memory';
  load(): Promise<StoredProjectRecord | null>;
  save(project: StarMapProject): Promise<StoredProjectRecord>;
  clear(): Promise<void>;
}

export function createMemoryStorage(): ProjectStorage {
  let record: StoredProjectRecord | null = null;
  return {
    kind: 'memory',
    async load() {
      return record ? structuredCloneSafe(record) : null;
    },
    async save(project) {
      record = {
        key: STORAGE_RECORD_KEY,
        project: structuredCloneSafe(project),
        savedAt: new Date().toISOString(),
        title: project.title,
      };
      return structuredCloneSafe(record);
    },
    async clear() {
      record = null;
    },
  };
}

function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function openDatabase(dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this environment.'));
      return;
    }
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed.'));
    request.onblocked = () => reject(new Error('IndexedDB open blocked by another tab.'));
  });
}

/** IndexedDB-backed autosave storage with automatic in-memory degradation. */
export function createIndexedDbStorage(
  dbName = STORAGE_DB_NAME,
  storeName = STORAGE_STORE_NAME,
): ProjectStorage {
  let fallback: ProjectStorage | null = null;
  const memory = () => (fallback ??= createMemoryStorage());

  const run = async <T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> => {
    const db = await openDatabase(dbName, storeName);
    try {
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const request = fn(tx.objectStore(storeName));
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error('IndexedDB transaction failed.'));
        };
      });
    } catch (error) {
      db.close();
      throw error;
    }
  };

  return {
    kind: 'indexeddb',
    async load() {
      try {
        const record = await run<StoredProjectRecord | undefined>('readonly', (store) =>
          store.get(STORAGE_RECORD_KEY),
        );
        if (!record) return null;
        // Never restore a corrupt autosave: validate before handing it back.
        const result = validateProject(record.project);
        if (!result.ok || !result.project) return null;
        return { ...record, project: result.project };
      } catch {
        return memory().load();
      }
    },
    async save(project) {
      const record: StoredProjectRecord = {
        key: STORAGE_RECORD_KEY,
        project: structuredCloneSafe(project),
        savedAt: new Date().toISOString(),
        title: project.title,
      };
      try {
        await run('readwrite', (store) => store.put(record, STORAGE_RECORD_KEY));
        return record;
      } catch {
        return memory().save(project);
      }
    },
    async clear() {
      try {
        await run('readwrite', (store) => store.delete(STORAGE_RECORD_KEY));
      } catch {
        await memory().clear();
      }
    },
  };
}

/* ------------------------------------------------------------------ *
 * Autosave
 * ------------------------------------------------------------------ */

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export interface AutosaveHandle {
  start(): void;
  stop(): void;
  flush(): Promise<void>;
  getStatus(): SaveStatus;
  onStatus(listener: (status: SaveStatus, detail?: string) => void): () => void;
  readonly storageKind: ProjectStorage['kind'];
  getLastSavedAt(): string | null;
}

export interface AutosaveOptions {
  debounceMs?: number;
}

/**
 * Debounced autosave bound to a store subscription. The controller never owns
 * project data; it only mirrors committed documents into storage.
 */
export function createAutosave(
  subscribe: (listener: (change: string) => void) => () => void,
  getProject: () => StarMapProject,
  storage: ProjectStorage,
  options: AutosaveOptions = {},
): AutosaveHandle {
  const debounceMs = options.debounceMs ?? 900;
  let status: SaveStatus = 'saved';
  let detail: string | undefined;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let unsubscribeStore: (() => void) | null = null;
  const listeners = new Set<(status: SaveStatus, detail?: string) => void>();
  let lastSavedAt: string | null = null;

  const setStatus = (next: SaveStatus, nextDetail?: string) => {
    if (status === next && detail === nextDetail) return;
    status = next;
    detail = nextDetail;
    for (const listener of [...listeners]) listener(status, detail);
  };

  const write = async () => {
    setStatus('saving');
    try {
      const record = await storage.save(getProject());
      lastSavedAt = record.savedAt;
      setStatus('saved');
    } catch (error) {
      setStatus('error', (error as Error).message);
    }
  };

  const schedule = () => {
    setStatus('unsaved');
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void write();
    }, debounceMs);
  };

  return {
    storageKind: storage.kind,
    start() {
      if (unsubscribeStore) return;
      unsubscribeStore = subscribe((change) => {
        if (change === 'project') schedule();
      });
    },
    stop() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      unsubscribeStore?.();
      unsubscribeStore = null;
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      await write();
    },
    getStatus: () => status,
    getLastSavedAt: () => lastSavedAt,
    onStatus(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
