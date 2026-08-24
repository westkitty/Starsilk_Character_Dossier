# Starsilk Compendium — Canon Inspector

Canonical: https://westkitty.github.io/Starsilk_Character_Dossier/canon/
JSON: https://westkitty.github.io/Starsilk_Character_Dossier/canon/canon-locks.json
Schema: https://westkitty.github.io/Starsilk_Character_Dossier/machine/schema/v1/canon-lock-register.schema.json
Authority: https://westkitty.github.io/Starsilk_Character_Dossier/canon/AUTHORITY.md

These are machine-enforced validation locks protecting selected established facts. They are not the complete Starsilk canon.
Absence from this register does not imply non-canon status.

- Total locks: 16
- Document locks: 3
- Section locks: 13

## blood-eclipse-war-170-years

Blood Eclipse War lasts one hundred seventy years, not seventeen.

- Scope: `document`
- Target: [complete-compendium-document](https://westkitty.github.io/Starsilk_Character_Dossier/)
- Machine validation authority: `src/canon/invariants.json`
- Enforcement: `build/validate.py --strict` — `enforced-on-generated-compendium-validation`
- Scope semantics: Applied to the complete generated Compendium document; positive requirements are evaluated at document scope and prohibitions apply globally.

### Machine validation patterns

These raw patterns are technical evidence, not canon prose.

#### Positive requirements

- `170[- ]year|one[- ]hundred[- ]seventy[- ]year`

#### Prohibitions

- `\b17-year\b`
- `\bseventeen-year\b`
- `\b17 years\b`
- `\bseventeen years\b`
- `\bYear 17(?!\d)`

## no-william

The rejected/obsolete name 'William' must never appear.

- Scope: `document`
- Target: [complete-compendium-document](https://westkitty.github.io/Starsilk_Character_Dossier/)
- Machine validation authority: `src/canon/invariants.json`
- Enforcement: `build/validate.py --strict` — `enforced-on-generated-compendium-validation`
- Scope semantics: Applied to the complete generated Compendium document; positive requirements are evaluated at document scope and prohibitions apply globally.

### Machine validation patterns

These raw patterns are technical evidence, not canon prose.

#### Positive requirements

- None.

#### Prohibitions

- `(?i)\bwilliam\b`

## wordstreamer-canonical-spelling

The deity's canonical name is Wordstreamer; the obsolete internal-capital form WordStreamer must not appear.

- Scope: `document`
- Target: [complete-compendium-document](https://westkitty.github.io/Starsilk_Character_Dossier/)
- Machine validation authority: `src/canon/invariants.json`
- Enforcement: `build/validate.py --strict` — `enforced-on-generated-compendium-validation`
- Scope semantics: Applied to the complete generated Compendium document; positive requirements are evaluated at document scope and prohibitions apply globally.

### Machine validation patterns

These raw patterns are technical evidence, not canon prose.

#### Positive requirements

- None.

#### Prohibitions

- `\bWordStreamer\b`

## dao-right-arm

Dao's integrated buster/mechanical arm remains on the right.

- Scope: `section`
- Target: [published-section](https://westkitty.github.io/Starsilk_Character_Dossier/entities/dao/) (`dao`)
- Machine validation authority: `src/canon/invariants.json`
- Enforcement: `build/validate.py --strict` — `enforced-on-generated-compendium-validation`
- Scope semantics: Applied only to generated section #dao; positive requirements and prohibitions are evaluated inside that section.

### Machine validation patterns

These raw patterns are technical evidence, not canon prose.

#### Positive requirements

- `right arm|right mechanical arm`

#### Prohibitions

- `(?i)left arm`

## dao-eyepatch-left

Dao's eyepatch remains over the left eye.

- Scope: `section`
- Target: [published-section](https://westkitty.github.io/Starsilk_Character_Dossier/entities/dao/) (`dao`)
- Machine validation authority: `src/canon/invariants.json`
- Enforcement: `build/validate.py --strict` — `enforced-on-generated-compendium-validation`
- Scope semantics: Applied only to generated section #dao; positive requirements and prohibitions are evaluated inside that section.

### Machine validation patterns

These raw patterns are technical evidence, not canon prose.

#### Positive requirements

- `eyepatch`

#### Prohibitions

- `(?i)right eye`

## kail-scarf-covers-mouth

Kail's red scarf remains over the mouth/throat in ordinary depiction.

- Scope: `section`
- Target: [published-section](https://westkitty.github.io/Starsilk_Character_Dossier/entities/kail/) (`kail`)
- Machine validation authority: `src/canon/invariants.json`
- Enforcement: `build/validate.py --strict` — `enforced-on-generated-compendium-validation`
- Scope semantics: Applied only to generated section #kail; positive requirements and prohibitions are evaluated inside that section.

### Machine validation patterns

These raw patterns are technical evidence, not canon prose.

#### Positive requirements

- `over the mouth`
- `scarf`

#### Prohibitions

- None.

## kail-no-exposed-mouth

Kail does not gain an ordinary exposed speaking mouth.

- Scope: `section`
- Target: [published-section](https://westkitty.github.io/Starsilk_Character_Dossier/entities/kail/) (`kail`)
- Machine validation authority: `src/canon/invariants.json`
- Enforcement: `build/validate.py --strict` — `enforced-on-generated-compendium-validation`
- Scope semantics: Applied only to generated section #kail; positive requirements and prohibitions are evaluated inside that section.

### Machine validation patterns

These raw patterns are technical evidence, not canon prose.

#### Positive requirements

- `exposed speaking mouth`

#### Prohibitions

- None.

## shard-god-single-tail

Shard-God Tiger has exactly one tail.

- Scope: `section`
- Target: [published-section](https://westkitty.github.io/Starsilk_Character_Dossier/entities/shard-god/) (`shard-god`)
- Machine validation authority: `src/canon/invariants.json`
- Enforcement: `build/validate.py --strict` — `enforced-on-generated-compendium-validation`
- Scope semantics: Applied only to generated section #shard-god; positive requirements and prohibitions are evaluated inside that section.

### Machine validation patterns

These raw patterns are technical evidence, not canon prose.

#### Positive requirements

- `(?i)single[- ]tail(ed)?`

#### Prohibitions

- None.

## shard-god-digitigrade

Shard-God Tiger is digitigrade.

- Scope: `section`
- Target: [published-section](https://westkitty.github.io/Starsilk_Character_Dossier/entities/shard-god/) (`shard-god`)
- Machine validation authority: `src/canon/invariants.json`
- Enforcement: `build/validate.py --strict` — `enforced-on-generated-compendium-validation`
- Scope semantics: Applied only to generated section #shard-god; positive requirements and prohibitions are evaluated inside that section.

### Machine validation patterns

These raw patterns are technical evidence, not canon prose.

#### Positive requirements

- `(?i)digitigrade`

#### Prohibitions

- None.

## shard-god-obsidian

Shard-God Tiger's body identity remains obsidian.

- Scope: `section`
- Target: [published-section](https://westkitty.github.io/Starsilk_Character_Dossier/entities/shard-god/) (`shard-god`)
- Machine validation authority: `src/canon/invariants.json`
- Enforcement: `build/validate.py --strict` — `enforced-on-generated-compendium-validation`
- Scope semantics: Applied only to generated section #shard-god; positive requirements and prohibitions are evaluated inside that section.

### Machine validation patterns

These raw patterns are technical evidence, not canon prose.

#### Positive requirements

- `(?i)obsidian`

#### Prohibitions

- None.

## starsilk-material-azure

Starsilk's material identity remains cyan/azure luminous edges.

- Scope: `section`
- Target: [published-section](https://westkitty.github.io/Starsilk_Character_Dossier/entities/starsilk-material/) (`starsilk-material`)
- Machine validation authority: `src/canon/invariants.json`
- Enforcement: `build/validate.py --strict` — `enforced-on-generated-compendium-validation`
- Scope semantics: Applied only to generated section #starsilk-material; positive requirements and prohibitions are evaluated inside that section.

### Machine validation patterns

These raw patterns are technical evidence, not canon prose.

#### Positive requirements

- `(?i)azure`

#### Prohibitions

- None.

## marcel-staff-non-magical

Marcel's plain wooden staff remains non-magical.

- Scope: `section`
- Target: [published-section](https://westkitty.github.io/Starsilk_Character_Dossier/entities/marcel/) (`marcel`)
- Machine validation authority: `src/canon/invariants.json`
- Enforcement: `build/validate.py --strict` — `enforced-on-generated-compendium-validation`
- Scope semantics: Applied only to generated section #marcel; positive requirements and prohibitions are evaluated inside that section.

### Machine validation patterns

These raw patterns are technical evidence, not canon prose.

#### Positive requirements

- `no magical properties`

#### Prohibitions

- None.

## wordstreaming-living-practice

Wordstreaming remains a living practice named for the deceased Wordstreamer.

- Scope: `section`
- Target: [published-section](https://westkitty.github.io/Starsilk_Character_Dossier/entities/ontology-horror/) (`ontology-horror`)
- Machine validation authority: `src/canon/invariants.json`
- Enforcement: `build/validate.py --strict` — `enforced-on-generated-compendium-validation`
- Scope semantics: Applied only to generated section #ontology-horror; positive requirements and prohibitions are evaluated inside that section.

### Machine validation patterns

These raw patterns are technical evidence, not canon prose.

#### Positive requirements

- `Wordstreaming</b> is a living communication and reality-code practice named for`

#### Prohibitions

- None.

## post-wall-wordstreaming-living

Post-Wall Drakken still use wordstreaming as a living communication practice.

- Scope: `section`
- Target: [published-section](https://westkitty.github.io/Starsilk_Character_Dossier/entities/beyond-wall/) (`beyond-wall`)
- Machine validation authority: `src/canon/invariants.json`
- Enforcement: `build/validate.py --strict` — `enforced-on-generated-compendium-validation`
- Scope semantics: Applied only to generated section #beyond-wall; positive requirements and prohibitions are evaluated inside that section.

### Machine validation patterns

These raw patterns are technical evidence, not canon prose.

#### Positive requirements

- `Wordstreaming survives as a living communication practice`

#### Prohibitions

- None.

## post-wall-codec-time-estimate

Codec estimates roughly 8,560 years have passed since the Blood Eclipse War era.

- Scope: `section`
- Target: [published-section](https://westkitty.github.io/Starsilk_Character_Dossier/entities/beyond-wall/) (`beyond-wall`)
- Machine validation authority: `src/canon/invariants.json`
- Enforcement: `build/validate.py --strict` — `enforced-on-generated-compendium-validation`
- Scope semantics: Applied only to generated section #beyond-wall; positive requirements and prohibitions are evaluated inside that section.

### Machine validation patterns

These raw patterns are technical evidence, not canon prose.

#### Positive requirements

- `roughly 8,560 years`

#### Prohibitions

- None.

## modern-drakken-larger-than-humans

Modern Drakken remain larger than humans while being much smaller than Blood Eclipse War Titans.

- Scope: `section`
- Target: [published-section](https://westkitty.github.io/Starsilk_Character_Dossier/entities/beyond-wall/) (`beyond-wall`)
- Machine validation authority: `src/canon/invariants.json`
- Enforcement: `build/validate.py --strict` — `enforced-on-generated-compendium-validation`
- Scope semantics: Applied only to generated section #beyond-wall; positive requirements and prohibitions are evaluated inside that section.

### Machine validation patterns

These raw patterns are technical evidence, not canon prose.

#### Positive requirements

- `larger than humans`

#### Prohibitions

- None.

## Additional strict-validator inputs

These are invariant inputs used by the existing validator. They are not additional complete-canon claims.

### Structural counts

- `total_sections_min`: 138
- `principal`: 6
- `peripheral`: 45
- `drakken`: 56

### Principal-name expectations

- Shard-God Tiger
- Codec
- Dao
- Kail
- Marcel
- Jazen

### Drakken art-identity section IDs

- `drk-the-egg`
- `drk-magma-pleuron`
- `drk-granithelion`
- `drk-fault-tongue`
- `drk-obsidian-gul`
- `drk-tremorhound`
- `drk-glassspine`
- `drk-quarrymind`
- `drk-aerokarst`
- `drk-cloudmaw`
- `drk-atmantid`
- `drk-weathernode`
- `drk-vortenbray`
- `drk-fumericus`
- `drk-skymourn`
- `drk-verdgorge`
- `drk-pollenvault`
- `drk-mycethron`
- `drk-raintaster`
- `drk-terragullet`
- `drk-petalnest`
- `drk-feralseed`
- `drk-solnexus`
- `drk-nullthorn`
- `lyriboris`
- `drk-helionth`
- `drk-umbrakrael`
- `drk-cinderverge`
- `drk-singularch`
- `drk-redacted-grin`
- `drk-spinal-loop`
- `cradle-exe`
- `foldhowl`
- `manifest-discord`
- `drk-gloryfail`
- `drk-viral-bastion`
