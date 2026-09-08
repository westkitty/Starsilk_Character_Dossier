/**
 * Explicit JSON export / import.
 *
 * Export downloads the complete project document; import validates before it
 * replaces anything, and reports precise errors instead of discarding state.
 * No network, no backend, no telemetry.
 */

import { parseProject, serializeProject, formatIssues, type ValidationResult } from '../core/schema';
import type { StarMapProject } from '../core/types';

export function projectFilename(project: StarMapProject): string {
  const slug = project.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'starsilk-map';
  return `${slug}.starsilk-map.json`;
}

export function exportProject(project: StarMapProject): string {
  const json = serializeProject(project);
  const anchor = document.createElement('a');
  anchor.download = projectFilename(project);

  // Object URLs are the normal path; the data-URL fallback keeps export working
  // in restricted environments (some embeds, test harnesses) instead of throwing.
  const canUseObjectUrl =
    typeof Blob === 'function' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
  let objectUrl: string | null = null;
  if (canUseObjectUrl) {
    objectUrl = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    anchor.href = objectUrl;
  } else {
    anchor.href = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
  }

  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  if (objectUrl) {
    const revoke = objectUrl;
    setTimeout(() => URL.revokeObjectURL(revoke), 2000);
  }
  return json;
}

export interface ImportOutcome {
  ok: boolean;
  project?: StarMapProject;
  /** Formatted, human-readable problem report. */
  message?: string;
  result?: ValidationResult;
}

/**
 * Read a file as text. `Blob.text()` is the normal path; `FileReader` is the
 * fallback for hosts that do not implement it (older browsers, some embeds,
 * jsdom), so import never fails for a reason unrelated to the document.
 */
export async function readFileText(file: File | Blob): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'));
    reader.readAsText(file);
  });
}

export async function readProjectFile(file: File): Promise<ImportOutcome> {
  let text: string;
  try {
    text = await readFileText(file);
  } catch (error) {
    return { ok: false, message: `Could not read ${file.name}: ${(error as Error).message}` };
  }
  return parseProjectText(text, file.name);
}

export function parseProjectText(text: string, label = 'clipboard'): ImportOutcome {
  const result = parseProject(text);
  if (!result.ok || !result.project) {
    const lines = [
      `IMPORT REFUSED — ${label} is not a valid STARSiLK map project.`,
      formatIssues(result.errors),
      result.warnings.length > 0 ? `Warnings:\n${formatIssues(result.warnings)}` : '',
    ].filter(Boolean);
    return { ok: false, message: lines.join('\n'), result };
  }
  const notes = [
    result.migrationsApplied.length > 0
      ? `Migrated schema → version ${result.migrationsApplied[result.migrationsApplied.length - 1]}.`
      : '',
    result.warnings.length > 0 ? formatIssues(result.warnings) : '',
  ].filter(Boolean);
  return {
    ok: true,
    project: result.project,
    result,
    message: notes.length > 0 ? `IMPORTED WITH NOTES:\n${notes.join('\n')}` : undefined,
  };
}
