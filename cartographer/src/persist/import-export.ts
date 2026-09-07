import { SCHEMA_VERSION, type StarMapProject } from "../model/types.ts";
import { SchemaError, cloneProject, validateProject } from "../model/validate.ts";

export function serializeProject(project: StarMapProject): string {
  const copy = cloneProject(project);
  copy.schemaVersion = SCHEMA_VERSION;
  return `${JSON.stringify(copy, null, 2)}\n`;
}

export function parseProjectJson(text: string): StarMapProject {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SchemaError([{ path: "$", message: "File is not valid JSON." }]);
  }
  return validateProject(raw);
}

export function downloadJson(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export { SchemaError };
