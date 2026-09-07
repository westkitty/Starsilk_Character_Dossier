import { deepClone, validateProject, type StarMapProject } from "./core.js";

export const AUTOSAVE_DB = "starsilk-temporal-cartographer";
export const AUTOSAVE_STORE = "projects";
export const AUTOSAVE_KEY = "active-project";

export function serializeProject(project: StarMapProject): string {
  const validation = validateProject(project);
  if (!validation.ok) throw new Error(`Cannot export invalid project: ${validation.errors.join(" ")}`);
  return JSON.stringify(project, null, 2);
}

export function parseProjectJson(text: string): StarMapProject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  const validation = validateProject(parsed);
  if (!validation.ok || !validation.project) throw new Error(`Invalid STARSiLK map project: ${validation.errors.join(" ")}`);
  return deepClone(validation.project);
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(AUTOSAVE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AUTOSAVE_STORE)) db.createObjectStore(AUTOSAVE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open autosave database."));
  });
}

export async function saveAutosave(project: StarMapProject): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(AUTOSAVE_STORE, "readwrite");
      tx.objectStore(AUTOSAVE_STORE).put(deepClone(project), AUTOSAVE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Autosave failed."));
      tx.onabort = () => reject(tx.error ?? new Error("Autosave aborted."));
    });
  } finally {
    db.close();
  }
}

export async function loadAutosave(): Promise<StarMapProject | null> {
  const db = await openDatabase();
  try {
    const value = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(AUTOSAVE_STORE, "readonly");
      const request = tx.objectStore(AUTOSAVE_STORE).get(AUTOSAVE_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Autosave read failed."));
    });
    if (value === undefined) return null;
    const validation = validateProject(value);
    if (!validation.ok || !validation.project) throw new Error(`Autosave is invalid: ${validation.errors.join(" ")}`);
    return deepClone(validation.project);
  } finally {
    db.close();
  }
}

export function downloadProject(project: StarMapProject, filename = "starsilk-map.json"): void {
  const blob = new Blob([serializeProject(project)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
