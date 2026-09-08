/**
 * Regenerates `data/starsilk-map.json` from `src/core/demo.ts`.
 *
 * The committed JSON is a portable export produced by the application's own
 * serializer — it is never hand-edited. `tests/demo.test.ts` fails if the
 * committed copy drifts from the source of truth, so the file on disk is always
 * something this app would accept on import.
 *
 *   npm run export:demo
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDemoProject } from '../src/core/demo';
import { parseProject, serializeProject } from '../src/core/schema';
import { projectFilename } from '../src/app/transfer';

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, '../data/starsilk-map.json');

const project = createDemoProject();
const json = serializeProject(project);

// Never write a document the application would refuse to import.
const check = parseProject(json);
if (!check.ok) {
  console.error('REFUSED TO WRITE — the demo project does not validate:');
  for (const issue of check.errors) console.error(`  ${issue.path}: ${issue.message}`);
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${json}\n`, 'utf8');

const counts = project.entities.reduce<Record<string, number>>((acc, entity) => {
  acc[entity.type] = (acc[entity.type] ?? 0) + 1;
  return acc;
}, {});
const events = project.entities.reduce((sum, entity) => sum + entity.timeline.length, 0);

console.log(`wrote ${target}`);
console.log(`  export filename convention : ${projectFilename(project)}`);
console.log(`  schemaVersion              : ${project.schemaVersion}`);
console.log(`  entities                   : ${project.entities.length}`);
console.log(`  historical events          : ${events}`);
console.log(`  types                      : ${JSON.stringify(counts)}`);
console.log(`  starfieldDensity           : ${project.settings.render.starfieldDensity}`);
console.log(`  era presets                : ${project.eraPresets.length}`);
