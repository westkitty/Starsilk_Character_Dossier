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
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = projectFilename(project);
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return json;
}

export interface ImportOutcome {
  ok: boolean;
  project?: StarMapProject;
  /** Formatted, human-readable problem report. */
  message?: string;
  result?: ValidationResult;
}

export async function readProjectFile(file: File): Promise<ImportOutcome> {
  let text: string;
  try {
    text = await file.text();
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
