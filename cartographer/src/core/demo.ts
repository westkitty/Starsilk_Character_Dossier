/**
 * DEMONSTRATION DATASET.
 *
 * Proves the mechanics on real STARSiLK material:
 *   • several sectors and systems
 *   • planets, a moon, and a first-class Blood Ring
 *   • a Blood Ring that forms at a historical event (absent before, present after)
 *   • a Starsilk extraction collapse (star → black hole, system destroyed)
 *   • the Siege Wall appearing after the Aureal Gate as stellar absence
 *   • time overrides at sector, system, and individual-object scope
 *   • clearly differentiated canon statuses
 *
 * CANON DISCIPLINE
 * ----------------
 * Only supplied anchors are treated as canon: Year 0 hostilities, Year 3 first Blood
 * Rings around Fallenstar Prime, Year 121 Siege of the Ruby Eclipse, Year 170 final
 * collapse at the Aureal Gate, and the post-war Siege Wall. Everything else here —
 * every coordinate, every invented body, every ring that is not specified in canon —
 * is marked `schematic` or `provisional` and labelled SCHEMATIC / NON-CANON in the UI.
 * No exact date is invented for the main narrative, and no Siege Wall node count is
 * asserted anywhere.
 */

import { makeEntity } from './project';
import { defaultEraPresets } from './time';
import { defaultSettings, SCHEMA_VERSION, type Entity, type StarMapProject, type TimelineEvent } from './types';

const SCHEMATIC_NOTE =
  'Demonstration record. Coordinates and placement are invented for cartographic legibility — SCHEMATIC / NON-CANON.';

function event(
  id: string,
  time: TimelineEvent['time'],
  label: string,
  eventType: TimelineEvent['eventType'],
  canonStatus: TimelineEvent['canonStatus'],
  sourceNote: string,
  statePatch?: Record<string, unknown>,
): TimelineEvent {
  const built: TimelineEvent = { id, time, label, eventType, canonStatus, sourceNote };
  if (statePatch) built.statePatch = statePatch;
  return built;
}

/** Catalogue date stamped on the demonstration plate (kept fixed for reproducible exports). */
export const DEMO_CATALOGUE_DATE = '2026-09-07T00:00:00.000Z';

export function createDemoProject(): StarMapProject {
  const entities: Entity[] = [];

  /* ---------------------------------------------------------- galaxy */
  entities.push(
    makeEntity(
      {
        id: 'galaxy-root',
        type: 'galaxy',
        name: 'STARSiLK CARTOGRAPHIC PLATE 01',
        parentId: null,
        position: { x: 0, y: 0, z: 0, unit: 'pc' },
        time: { mode: 'override', overrideValue: 'main-narrative' },
        visual: { color: '#55dfff' },
        timeline: [
          event(
            'galaxy-note-war',
            0,
            'Blood Eclipse War begins',
            'annotation',
            'locked',
            'Year 0 — fringe-colony hostilities begin after Drakken lightning-strike terraformings trigger Administration counter-Macros.',
          ),
          event(
            'galaxy-note-170',
            170,
            'Final collapse at the Aureal Gate',
            'annotation',
            'locked',
            'Year 170 — Drakken use Starsilk against gods for the first time.',
          ),
          event(
            'galaxy-note-wall',
            'post-siege-wall',
            'Siege Wall established by collapsed stars',
            'annotation',
            'working',
            'After the Aureal Gate, Shard-God Tiger collapses huge numbers of stars; those stellar deaths establish the Siege Wall. No exact date is supplied.',
          ),
        ],
        meta: {
          canonStatus: 'schematic',
          description:
            'Authoring plate for the STARSiLK Temporal Cartographer. Starsilk is a literal, programmable cosmological substance — not metaphorical and not sentient; repeatable reality-changing Macros operate through it. Change GALAXY historical time to see every inheriting branch move; override any sector, system, or body to pin that branch to its own era.',
          tags: ['root', 'plate'],
          sourceNote: SCHEMATIC_NOTE,
        },
      },
      'schematic',
    ),
  );

  /* ---------------------------------------------------------- sectors */
  entities.push(
    makeEntity(
      {
        id: 'sector-pharos',
        type: 'starfield',
        name: 'PHAROS NEBULA',
        parentId: 'galaxy-root',
        position: { x: 26, y: 3, z: -18, unit: 'pc' },
        visual: { color: '#55dfff' },
        timeline: [
          event(
            'pharos-siege',
            121,
            'Siege of the Ruby Eclipse',
            'annotation',
            'locked',
            'Year 121 — Administration attacks a Drakken forward node in the Pharos Nebula.',
          ),
        ],
        meta: {
          canonStatus: 'working',
          description:
            'Named canon region. Its position on this plate is invented for layout; treat the coordinates as schematic.',
          tags: ['sector', 'war-theatre'],
          sourceNote:
            'Pharos Nebula is a supplied canon name and the Year 121 siege is a supplied anchor; the coordinate is schematic.',
        },
      },
      'working',
    ),
  );

  entities.push(
    makeEntity(
      {
        id: 'sector-fallenstar',
        type: 'starfield',
        name: 'FALLENSTAR REGION',
        parentId: 'galaxy-root',
        position: { x: -24, y: -2, z: 20, unit: 'pc' },
        visual: { color: '#a6efff' },
        meta: {
          canonStatus: 'working',
          description:
            'Inherits the galaxy era, so scrubbing the galaxy time shows the first Blood Ring form here in Year 3.',
          tags: ['sector'],
          sourceNote: 'Fallenstar is a supplied canon name; this coordinate is schematic.',
        },
      },
      'working',
    ),
  );

  entities.push(
    makeEntity(
      {
        id: 'sector-aureal',
        type: 'starfield',
        name: 'AUREAL REACH',
        parentId: 'galaxy-root',
        position: { x: 52, y: 5, z: 34, unit: 'pc' },
        visual: { color: '#4ba7db' },
        meta: {
          canonStatus: 'working',
          description: 'Approach region to the Aureal Gate.',
          tags: ['sector'],
          sourceNote: 'Aureal Gate is a supplied canon name; this coordinate is schematic.',
        },
      },
      'working',
    ),
  );

  entities.push(
    makeEntity(
      {
        id: 'sector-halven',
        type: 'starfield',
        name: "HAL'VEN CLUSTER",
        parentId: 'galaxy-root',
        position: { x: -46, y: 8, z: -34, unit: 'pc' },
        // SECTOR-SCOPE OVERRIDE: this branch is pinned to Year 121 while its siblings
        // keep inheriting the galaxy era.
        time: { mode: 'override', overrideValue: 121 },
        visual: { color: '#7dbf82' },
        meta: {
          canonStatus: 'working',
          description:
            'Named canon cluster; no canon coordinate is supplied for it. Carries a SECTOR-SCOPE historical override (Year 121) so sibling sectors visibly keep the galaxy era.',
          tags: ['sector', 'override-demo'],
          sourceNote: "Hal'Ven Cluster is a supplied canon name; the position here is schematic.",
        },
      },
      'working',
    ),
  );

  /* --------------------------------------------------- Pharos systems */
  entities.push(
    makeEntity(
      {
        id: 'system-pharos-03',
        type: 'system',
        name: 'PHAROS SYSTEM 03',
        parentId: 'sector-pharos',
        position: { x: 30, y: 3, z: -22, unit: 'pc' },
        meta: {
          canonStatus: 'schematic',
          description: 'Invented demonstration system inside the Pharos Nebula.',
          tags: ['system'],
          sourceNote: SCHEMATIC_NOTE,
        },
      },
      'schematic',
    ),
  );

  entities.push(
    makeEntity(
      {
        id: 'star-pharos-a',
        type: 'star',
        name: 'PHAROS A',
        parentId: 'system-pharos-03',
        visual: { displayRadius: 6.2, color: '#ffe0ae', emissive: '#ffcf7a', emissiveIntensity: 1.2 },
        meta: { canonStatus: 'schematic', tags: ['star'], sourceNote: SCHEMATIC_NOTE },
      },
      'schematic',
    ),
  );

  entities.push(
    makeEntity(
      {
        id: 'planet-pharos-b',
        type: 'planet',
        name: 'PHAROS III-b',
        parentId: 'system-pharos-03',
        orbit: {
          semiMajorAxis: 0.9,
          eccentricity: 0.04,
          inclination: 2,
          ascendingNode: 12,
          argumentOfPeriapsis: 40,
          meanAnomalyAtEpoch: 20,
          epoch: 0,
          period: 210,
        },
        visual: { displayRadius: 2.1, color: '#7fa8c9', banding: 0.3 },
        meta: { canonStatus: 'schematic', tags: ['planet'], sourceNote: SCHEMATIC_NOTE },
      },
      'schematic',
    ),
  );

  entities.push(
    makeEntity(
      {
        id: 'moon-pharos-b1',
        type: 'moon',
        name: 'PHAROS III-b I',
        parentId: 'planet-pharos-b',
        orbit: {
          semiMajorAxis: 0.014,
          eccentricity: 0.01,
          inclination: 5,
          ascendingNode: 0,
          argumentOfPeriapsis: 0,
          meanAnomalyAtEpoch: 90,
          epoch: 0,
          period: 22,
        },
        visual: { displayRadius: 0.62, color: '#9fb0bd' },
        meta: { canonStatus: 'schematic', tags: ['moon'], sourceNote: SCHEMATIC_NOTE },
      },
      'schematic',
    ),
  );

  entities.push(
    makeEntity(
      {
        id: 'planet-pharos-c',
        type: 'planet',
        // Authored name is the pre-Year-121 designation; the rename event supplies
        // the later name once that event is in the resolved past.
        name: 'PHAROS OUTER MARKER',
        parentId: 'system-pharos-03',
        orbit: {
          semiMajorAxis: 2.6,
          eccentricity: 0.12,
          inclination: 7,
          ascendingNode: 88,
          argumentOfPeriapsis: 210,
          meanAnomalyAtEpoch: 300,
          epoch: 0,
          period: 1240,
        },
        visual: { displayRadius: 2.6, color: '#8c7f6a', banding: 0.45 },
        timeline: [
          event(
            'pharos-c-rename',
            121,
            'Redesignated after the siege survey',
            'renamed',
            'schematic',
            'Demonstration of a discrete rename: before Year 121 the record carries its survey designation.',
            { name: 'PHAROS III-c' },
          ),
        ],
        meta: {
          canonStatus: 'schematic',
          tags: ['planet', 'rename-demo'],
          sourceNote: SCHEMATIC_NOTE,
        },
      },
      'schematic',
    ),
  );

  /* ------------------------------------------- Ruby Eclipse forward node */
  entities.push(
    makeEntity(
      {
        id: 'system-ruby',
        type: 'system',
        name: 'RUBY ECLIPSE FORWARD NODE',
        parentId: 'sector-pharos',
        position: { x: 36, y: 2, z: -12, unit: 'pc' },
        // SYSTEM-SCOPE OVERRIDE: pinned to the Year 121 siege anchor. Scrub the
        // galaxy to Year 0 and this branch — and only this branch — stays at 121.
        time: { mode: 'override', overrideValue: 121 },
        timeline: [
          event(
            'ruby-siege',
            121,
            'Siege of the Ruby Eclipse',
            'annotation',
            'locked',
            'Year 121 — Administration attacks this Drakken forward node.',
          ),
        ],
        meta: {
          canonStatus: 'working',
          description:
            'Drakken forward node attacked in Year 121. The node itself is canon-anchored; its coordinates are schematic. Carries a SYSTEM-SCOPE historical override at Year 121 — a visible demonstration that siblings are unaffected.',
          tags: ['system', 'war', 'override-demo'],
          sourceNote: 'Year 121 siege is a supplied anchor; the coordinate is schematic.',
        },
      },
      'working',
    ),
  );

  entities.push(
    makeEntity(
      {
        id: 'star-ruby',
        type: 'star',
        name: 'NODE PRIMARY',
        parentId: 'system-ruby',
        visual: { displayRadius: 5.4, color: '#ffb9a0', emissive: '#ff8f6a', emissiveIntensity: 1 },
        meta: { canonStatus: 'schematic', tags: ['star'], sourceNote: SCHEMATIC_NOTE },
      },
      'schematic',
    ),
  );

  entities.push(
    makeEntity(
      {
        id: 'planet-ruby-shell',
        type: 'planet',
        name: 'NODE SHELL 1',
        parentId: 'system-ruby',
        orbit: {
          semiMajorAxis: 1.4,
          eccentricity: 0.06,
          inclination: 3,
          ascendingNode: 30,
          argumentOfPeriapsis: 15,
          meanAnomalyAtEpoch: 140,
          epoch: 0,
          period: 420,
        },
        visual: { displayRadius: 2.3, color: '#9a7a72', banding: 0.4 },
        timeline: [
          event(
            'ruby-shell-processed',
            121,
            'Biosphere processed by Drakken',
            'visualChanged',
            'provisional',
            'Demonstration of a discrete visual change tied to the Year 121 siege. Drakken activity replaces ecosystems, geology, atmospheres, settlements, cultures, and populations.',
            { color: '#6c4f4a' },
          ),
        ],
        meta: {
          canonStatus: 'schematic',
          tags: ['planet', 'processed'],
          sourceNote: SCHEMATIC_NOTE,
        },
      },
      'schematic',
    ),
  );

  entities.push(
    makeEntity(
      {
        id: 'ring-ruby',
        type: 'bloodRing',
        name: 'SIEGE RING OF THE RUBY ECLIPSE',
        parentId: 'planet-ruby-shell',
        visual: {
          color: '#8d2230',
          banding: 0.7,
          ring: {
            innerRadius: 1.7,
            outerRadius: 3.2,
            thickness: 0.46,
            inclination: 11,
            color: '#6d1a26',
            striations: 30,
          },
        },
        timeline: [
          event(
            'ring-ruby-created',
            121,
            'Blood Ring formed from the processed world',
            'bloodRingCreated',
            'provisional',
            'Demonstration Blood Ring anchored to the Year 121 siege. A Blood Ring is a huge solid orbital band built from the processed remains and biospheric material of a murdered world — not an asteroid belt and not decorative rings. This particular ring is not specified in canon.',
          ),
        ],
        meta: {
          canonStatus: 'provisional',
          description:
            'Your sky is built from your dead. Vitrified black-red composite with spin striations and ash inclusions; at distance it holds the terrible elegance of dark stained glass.',
          tags: ['blood-ring'],
          sourceNote: 'Ring not specified in canon; anchored to a supplied Year 121 event.',
        },
      },
      'provisional',
    ),
  );

  /* ------------------------------------------------- Fallenstar system */
  entities.push(
    makeEntity(
      {
        id: 'system-fallenstar',
        type: 'system',
        name: 'FALLENSTAR SYSTEM',
        parentId: 'sector-fallenstar',
        position: { x: -26, y: -2, z: 22, unit: 'pc' },
        meta: {
          canonStatus: 'working',
          description: 'Home system of Fallenstar Prime.',
          tags: ['system'],
          sourceNote: 'Fallenstar Prime is a supplied canon name; the coordinate is schematic.',
        },
      },
      'working',
    ),
  );

  entities.push(
    makeEntity(
      {
        id: 'star-fallenstar',
        type: 'star',
        name: 'FALLENSTAR',
        parentId: 'system-fallenstar',
        visual: { displayRadius: 6.8, color: '#ffd9c0', emissive: '#ffb98a', emissiveIntensity: 1.25 },
        meta: { canonStatus: 'working', tags: ['star'], sourceNote: 'Schematic position; canon name.' },
      },
      'working',
    ),
  );

  entities.push(
    makeEntity(
      {
        id: 'planet-fallenstar-prime',
        type: 'planet',
        name: 'FALLENSTAR PRIME',
        parentId: 'system-fallenstar',
        orbit: {
          semiMajorAxis: 1.1,
          eccentricity: 0.03,
          inclination: 1.5,
          ascendingNode: 0,
          argumentOfPeriapsis: 0,
          meanAnomalyAtEpoch: 60,
          epoch: 0,
          period: 330,
        },
        visual: {
          displayRadius: 2.4,
          color: '#8fb6c4',
          banding: 0.28,
          atmosphere: { enabled: true, color: '#a6efff', intensity: 0.34 },
        },
        timeline: [
          event(
            'fallenstar-vitrified',
            3,
            'Surface vitrified beneath the first ring',
            'visualChanged',
            'provisional',
            'Demonstration of a discrete visual patch coinciding with the Year 3 ring erection.',
            { color: '#7b5a53' },
          ),
        ],
        meta: {
          canonStatus: 'locked',
          description:
            'Fallenstar Prime — the world whose dead were raised into the first Blood Rings in Year 3.',
          tags: ['planet', 'canon'],
          sourceNote: 'Fallenstar Prime is a supplied canon name; its orbit here is schematic.',
          dossierHref: './',
        },
      },
      'locked',
    ),
  );

  entities.push(
    makeEntity(
      {
        id: 'ring-fallenstar',
        type: 'bloodRing',
        name: 'FIRST BLOOD RING',
        parentId: 'planet-fallenstar-prime',
        visual: {
          color: '#93242f',
          banding: 0.75,
          ring: {
            innerRadius: 1.6,
            outerRadius: 3.4,
            thickness: 0.5,
            inclination: 6,
            color: '#6d1a26',
            striations: 34,
          },
        },
        timeline: [
          event(
            'ring-fallenstar-created',
            3,
            'First Blood Rings erected',
            'bloodRingCreated',
            'locked',
            'Blood Eclipse War Year 3 — first Blood Rings erected around Fallenstar Prime.',
          ),
        ],
        meta: {
          canonStatus: 'locked',
          description:
            'A huge solid orbital band created from the processed remains and biospheric material of a murdered world: biological residue, ash, fats, minerals, Drakken processing material, and vitrified black-red composite. Your sky is built from your dead.',
          tags: ['blood-ring', 'canon'],
          sourceNote: 'Year 3 first Blood Rings around Fallenstar Prime is a supplied canon anchor.',
        },
      },
      'locked',
    ),
  );

  entities.push(
    makeEntity(
      {
        id: 'moon-fallenstar-1',
        type: 'moon',
        name: 'FALLENSTAR PRIME I',
        parentId: 'planet-fallenstar-prime',
        orbit: {
          semiMajorAxis: 0.02,
          eccentricity: 0.02,
          inclination: 4,
          ascendingNode: 20,
          argumentOfPeriapsis: 0,
          meanAnomalyAtEpoch: 200,
          epoch: 0,
          period: 18,
        },
        visual: { displayRadius: 0.66, color: '#a9b7c0' },
        timeline: [
          event(
            'moon-fallenstar-lost',
            3,
            'Moon consumed into ring material',
            'destroyed',
            'provisional',
            'Demonstration of a destruction event: absent from Year 3 onward in this branch, restored only as a historical visualisation when scrubbing backwards.',
          ),
        ],
        meta: {
          canonStatus: 'provisional',
          tags: ['moon', 'destroyed-demo'],
          sourceNote: 'Not specified in canon; demonstrates destruction handling.',
        },
      },
      'provisional',
    ),
  );

  /* ---------------------------------------------------- Aureal system */
  entities.push(
    makeEntity(
      {
        id: 'system-aureal',
        type: 'system',
        name: 'AUREAL GATE',
        parentId: 'sector-aureal',
        position: { x: 56, y: 5, z: 38, unit: 'pc' },
        timeline: [
          event(
            'aureal-collapse',
            170,
            'Final collapse at the Aureal Gate',
            'annotation',
            'locked',
            'Year 170 — Drakken use Starsilk against gods for the first time.',
          ),
          event(
            'aureal-destroyed',
            'post-siege-wall',
            'System historically destroyed by stellar collapse',
            'annotation',
            'working',
            'After the Aureal Gate, Shard-God Tiger collapses huge numbers of stars. This system is destroyed historically; scrubbing backwards visualises the earlier state and does not imply resurrection.',
          ),
        ],
        meta: {
          canonStatus: 'working',
          description:
            'Site of the final collapse in Year 170. Inherits the galaxy era so scrubbing past the war shows the stellar collapse; its moon below carries an object-scope override.',
          tags: ['system', 'war'],
          sourceNote: 'Aureal Gate and Year 170 are supplied anchors; the coordinate is schematic.',
        },
      },
      'working',
    ),
  );

  entities.push(
    makeEntity(
      {
        id: 'star-aureal',
        type: 'star',
        name: 'AUREAL PRIMARY',
        parentId: 'system-aureal',
        visual: { displayRadius: 7, color: '#ffe9c4', emissive: '#ffd28a', emissiveIntensity: 1.3 },
        timeline: [
          event(
            'aureal-starsilk-collapse',
            'post-siege-wall',
            'Starsilk extraction — stellar collapse',
            'starsilkExtractionCollapse',
            'working',
            'Pulling Starsilk from the centre of a star collapses it immediately into a black hole and destroys its star system. Anchored to the post-Aureal-Gate era; no exact date is supplied. This particular star is a schematic stand-in.',
            { type: 'blackHole' },
          ),
        ],
        meta: {
          canonStatus: 'working',
          description:
            'Before the collapse: a star with an extant system. After: a black hole and a historically destroyed system.',
          tags: ['star', 'collapse-demo'],
          sourceNote: 'The collapse mechanic is canon; this specific star is schematic.',
        },
      },
      'working',
    ),
  );

  entities.push(
    makeEntity(
      {
        id: 'planet-aureal-1',
        type: 'planet',
        name: 'GATEWARD I',
        parentId: 'system-aureal',
        orbit: {
          semiMajorAxis: 1.8,
          eccentricity: 0.09,
          inclination: 6,
          ascendingNode: 200,
          argumentOfPeriapsis: 60,
          meanAnomalyAtEpoch: 15,
          epoch: 0,
          period: 640,
        },
        visual: { displayRadius: 2.2, color: '#96a8b8', banding: 0.32 },
        meta: { canonStatus: 'schematic', tags: ['planet'], sourceNote: SCHEMATIC_NOTE },
      },
      'schematic',
    ),
  );

  entities.push(
    makeEntity(
      {
        id: 'moon-aureal-1',
        type: 'moon',
        name: 'GATEWARD I-a',
        parentId: 'planet-aureal-1',
        // OBJECT-SCOPE OVERRIDE: only this body is pinned to Year 121.
        time: { mode: 'override', overrideValue: 121 },
        orbit: {
          semiMajorAxis: 0.018,
          eccentricity: 0.03,
          inclination: 9,
          ascendingNode: 40,
          argumentOfPeriapsis: 0,
          meanAnomalyAtEpoch: 120,
          epoch: 0,
          period: 26,
        },
        visual: { displayRadius: 0.6, color: '#b3a99c' },
        meta: {
          canonStatus: 'schematic',
          tags: ['moon', 'override-demo'],
          sourceNote: `${SCHEMATIC_NOTE} Carries an OBJECT-SCOPE historical override (Year 121) to demonstrate sibling isolation. Note that ancestor absence still wins: when its system is historically destroyed, this body is absent whatever its own era says.`,
        },
      },
      'schematic',
    ),
  );

  /* ---------------------------------------------------- Hal'Ven system */
  entities.push(
    makeEntity(
      {
        id: 'system-halven',
        type: 'system',
        name: "HAL'VEN PRIMARY SYSTEM",
        parentId: 'sector-halven',
        position: { x: -48, y: 8, z: -36, unit: 'pc' },
        meta: {
          canonStatus: 'schematic',
          description: 'Invented demonstration system inside the named Hal\u2019Ven Cluster.',
          tags: ['system'],
          sourceNote: SCHEMATIC_NOTE,
        },
      },
      'schematic',
    ),
  );

  entities.push(
    makeEntity(
      {
        id: 'star-halven',
        type: 'star',
        name: "HAL'VEN A",
        parentId: 'system-halven',
        visual: { displayRadius: 5.6, color: '#d9ecff', emissive: '#bfe4ff', emissiveIntensity: 1.1 },
        meta: { canonStatus: 'schematic', tags: ['star'], sourceNote: SCHEMATIC_NOTE },
      },
      'schematic',
    ),
  );

  entities.push(
    makeEntity(
      {
        id: 'planet-halven-1',
        type: 'planet',
        name: "HAL'VEN A II",
        parentId: 'system-halven',
        orbit: {
          semiMajorAxis: 1.3,
          eccentricity: 0.05,
          inclination: 4,
          ascendingNode: 70,
          argumentOfPeriapsis: 130,
          meanAnomalyAtEpoch: 250,
          epoch: 0,
          period: 380,
        },
        visual: { displayRadius: 2, color: '#7dbf82', banding: 0.35 },
        meta: { canonStatus: 'schematic', tags: ['planet'], sourceNote: SCHEMATIC_NOTE },
      },
      'schematic',
    ),
  );

  /* --------------------------------------------- large-scale structures */
  entities.push(
    makeEntity(
      {
        id: 'structure-siege-wall',
        type: 'largeScaleStructure',
        name: 'SIEGE WALL',
        parentId: 'galaxy-root',
        position: { x: -6, y: 0, z: -4, unit: 'pc' },
        visual: { color: '#0d0509', structure: 'siegeWall', extent: 46 },
        timeline: [
          event(
            'siege-wall-formed',
            'post-siege-wall',
            'Siege Wall established by collapsed stars',
            'created',
            'working',
            'After the Aureal Gate, Shard-God Tiger collapses huge numbers of stars around Drakken territory; those stellar deaths establish the Siege Wall, which contains — does not annihilate — the Drakken. No exact date and no node count is supplied.',
          ),
        ],
        meta: {
          canonStatus: 'working',
          description:
            'NOT a literal wall. Large-scale containment architecture formed from stars collapsed into black holes. From inhabited worlds it manifests as an enormous swath of black absence across the night sky — lost stars and missing light. Rendered here as absence, never as bricks, panels, fencing, force fields, grids, or glowing barriers.',
          tags: ['siege-wall', 'absence'],
          sourceNote:
            'Supplied canon: the Siege Wall contains the Drakken and is established by stellar collapse after the Aureal Gate. Its geometry here is schematic, and any lensing nodes drawn are procedural render placeholders — no canon node count exists.',
        },
      },
      'working',
    ),
  );

  entities.push(
    makeEntity(
      {
        id: 'structure-drakken-domain',
        type: 'largeScaleStructure',
        name: 'DRAKKEN DOMAIN',
        parentId: 'galaxy-root',
        position: { x: -34, y: 0, z: -12, unit: 'pc' },
        visual: { color: '#7a2f3c', structure: 'region', extent: 34 },
        timeline: [
          event(
            'drakken-domain-war',
            0,
            'Domain contiguous with war-theatre activity',
            'annotation',
            'provisional',
            'Year 0 onward — Drakken are elemental terraforming entities produced by the Notebook Program; their activity replaces ecosystems, geology, atmospheres, settlements, cultures, populations, and stellar infrastructure. The domain outline here is schematic.',
          ),
        ],
        meta: {
          canonStatus: 'provisional',
          description:
            'Territory replaced by Drakken activity during the Blood Eclipse War. Contained by the Siege Wall afterwards — not annihilated by it.',
          tags: ['drakken', 'domain'],
          sourceNote: 'Outline schematic; Drakken identity and containment are supplied canon.',
        },
      },
      'provisional',
    ),
  );

  const settings = defaultSettings();
  settings.render.starfieldDensity = 10000;
  settings.render.labelMode = 'major';

  // Fixed catalogue timestamp: the demonstration plate is a dataset, not a live
  // session, so its export is byte-identical every time it is regenerated.
  const now = DEMO_CATALOGUE_DATE;
  return {
    schemaVersion: SCHEMA_VERSION,
    id: 'prj-starsilk-demo',
    title: 'STARSiLK DEMONSTRATION PLATE',
    createdAt: now,
    updatedAt: now,
    eraPresets: defaultEraPresets(),
    entities,
    settings,
  };
}
