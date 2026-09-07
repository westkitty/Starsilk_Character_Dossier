export function createId(prefix = "ent"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  const rand = Math.random().toString(16).slice(2);
  const time = Date.now().toString(16);
  return `${prefix}-${time}-${rand}`;
}

export function createEventId(): string {
  return createId("evt");
}

export function createProjectId(): string {
  return createId("proj");
}
