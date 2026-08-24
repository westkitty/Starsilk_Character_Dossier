# Starsilk agent evaluation fixtures

Reusable vendor-neutral evaluation cases. They test whether an agent preserves published evidence boundaries; they are not lore authority.

## Penalty rules

- **invented-relationship** (`fail`): Invents a semantic relationship not established by the cited evidence.
- **status-promotion** (`fail`): Promotes development, historical, speculative, or unknown material to canon without controlling evidence.
- **guessed-date** (`fail`): Supplies a date or temporal ordering that the cited chronology does not author.
- **invented-coordinate** (`fail`): Supplies coordinates, distance, direction, route geometry, or spatial precision absent from the cited topology.
- **mention-to-causality** (`fail`): Treats an observed xref mention as causality, command, alliance, kinship, hostility, creation, or another semantic relation.
- **lost-source-reference** (`major`): Drops source references when the evaluated claim depends on a machine record that provides them.
- **derivative-over-source** (`fail`): Treats a generated derivative as more authoritative than its cited source authority.

## Reference cases

### entity-identity-codec

Category: `entity-identity`

Prompt: What stable identity and canonical machine/human destinations should an agent use for Codec?

Must assert:
- Codec's stable ID is codec.
- The canonical human permalink is /entities/codec/.
- The machine JSON and context packet must preserve the same stable ID.

Must not assert:
- A display label, generated slug, filename, or model-created identifier supersedes stable ID codec.

Source expectation: Preserve the record's stable_id and source_refs; generated destinations do not replace authored identity.

Evidence:
- https://westkitty.github.io/Starsilk_Character_Dossier/machine/entities/codec.json
- https://westkitty.github.io/Starsilk_Character_Dossier/entities/codec/

### canon-retrieval-source-order

Category: `canon-retrieval`

Prompt: How should an agent retrieve a Starsilk fact and decide what authority controls it?

Must assert:
- Generated machine records are retrieval derivatives and do not outrank cited authored sources.
- The answer should follow provided source references when a claim needs source passage support.

Must not assert:
- A generated JSON, Markdown, context packet, or human view becomes a second canon authority.

Source expectation: Cite or name the controlling source surface rather than treating convenience output as sovereign.

Evidence:
- https://westkitty.github.io/Starsilk_Character_Dossier/machine/AUTHORITY.md
- https://westkitty.github.io/Starsilk_Character_Dossier/agents/AGENT_GUIDE.md

### development-remains-development

Category: `development-vs-canon`

Prompt: A future public record is explicitly marked canon_status=development. May an agent describe it as settled canon because it is public?

Must assert:
- Development material remains development until a stronger controlling source changes its status.
- Public visibility is independent of canon status.

Must not assert:
- Public or prominent development material is automatically canon.

Source expectation: Use the explicit canon_status field and keep visibility separate.

Evidence:
- https://westkitty.github.io/Starsilk_Character_Dossier/agents/AGENT_GUIDE.md

### historical-remains-historical

Category: `historical-material`

Prompt: A record is explicitly marked canon_status=historical. How should an agent present it?

Must assert:
- The material should be labeled historical rather than silently promoted to current canon.

Must not assert:
- Historical status is equivalent to current canon.

Source expectation: Preserve the explicit historical status unless a stronger authority supersedes it.

Evidence:
- https://westkitty.github.io/Starsilk_Character_Dossier/agents/AGENT_GUIDE.md

### speculative-remains-speculative

Category: `speculative-material`

Prompt: A public record is explicitly marked canon_status=speculative. What may an agent claim?

Must assert:
- The material is speculative and must be described as such.

Must not assert:
- Speculation becomes fact because it appears in a public machine-readable record.

Source expectation: Preserve the explicit speculative status.

Evidence:
- https://westkitty.github.io/Starsilk_Character_Dossier/agents/AGENT_GUIDE.md

### unknown-event-date

Category: `unknown-information`

Prompt: What absolute date should be assigned to The Initialization of Reality?

Must assert:
- The current chronology publication provides no absolute date and marks temporal certainty unknown.

Must not assert:
- An absolute date, year, or inferred placement is supplied for neatness or plausibility.

Source expectation: Preserve temporal.absolute_date=null and certainty=unknown.

Evidence:
- https://westkitty.github.io/Starsilk_Character_Dossier/chronology/chronology.json

### chronology-authored-only

Category: `chronology`

Prompt: How should an agent use the chronology event model when ordering events?

Must assert:
- Use exact or relative temporal markers only where the event record explicitly authors them.
- Source-list order does not automatically create a chronological relation.

Must not assert:
- Missing dates or event order are guessed from presentation order.

Source expectation: Retain event source references and authored temporal certainty.

Evidence:
- https://westkitty.github.io/Starsilk_Character_Dossier/chronology/chronology.json
- https://westkitty.github.io/Starsilk_Character_Dossier/chronology/AUTHORITY.md

### codec-observed-mentions

Category: `relationships`

Prompt: What do Codec's relationship records prove about Dao, Kail, Marcel, Jazen, and NiAlBu?

Must assert:
- The published relationship evidence proves observed cross-reference mentions only.
- Codec's outgoing record references Dao, Jazen, Kail, Marcel, and NiAlBu.

Must not assert:
- The mention graph by itself proves friendship, command, hostility, causality, alliance, kinship, or creation.

Source expectation: Preserve kind=mentions and evidence_class=observed-xref.

Evidence:
- https://westkitty.github.io/Starsilk_Character_Dossier/discover/packets/codec.json
- https://westkitty.github.io/Starsilk_Character_Dossier/relationships/relationships.json

### mention-not-causality

Category: `mention-vs-semantic`

Prompt: If one entity page links to another, may an agent conclude that the first caused the second entity's fate?

Must assert:
- No. An observed xref proves reference only.

Must not assert:
- A mention is converted into causality or any richer semantic relation without explicit evidence.

Source expectation: Relationship semantics must remain within the evidence class.

Evidence:
- https://westkitty.github.io/Starsilk_Character_Dossier/relationships/AUTHORITY.md
- https://westkitty.github.io/Starsilk_Character_Dossier/agents/AGENT_GUIDE.md

### media-provenance-object-id

Category: `media-provenance`

Prompt: How should an agent interpret a museum object's object_id, filename, contexts, and null logical_identity?

Must assert:
- object_id is a deterministic view of the published filename with its final extension removed.
- The published filename remains the provenance source key.
- A section context proves published placement only.
- Null logical_identity remains unknown.

Must not assert:
- Visual appearance, filename shape, context placement, or nearby lore is used to invent media identity or semantic relationship.

Source expectation: Preserve evidence.source_ref=docs/asset-manifest.json and explicit unknowns.

Evidence:
- https://westkitty.github.io/Starsilk_Character_Dossier/objects/objects.json
- https://westkitty.github.io/Starsilk_Character_Dossier/objects/AUTHORITY.md

### canon-locks-not-complete-canon

Category: `canon-locks`

Prompt: Does the Canon Inspector enumerate all Starsilk canon?

Must assert:
- No. It exposes machine-enforced locks derived from src/canon/invariants.json.
- Absence from the lock register does not imply non-canon status.

Must not assert:
- The lock register is the entirety of Starsilk lore or canon.

Source expectation: Name the machine-enforced subset and its source authority.

Evidence:
- https://westkitty.github.io/Starsilk_Character_Dossier/canon/AUTHORITY.md
- https://westkitty.github.io/Starsilk_Character_Dossier/canon/canon-locks.json

### source-passage-codec

Category: `source-passage-retrieval`

Prompt: Where should an agent go after Codec's compact context packet when it needs the authoritative passage behind the excerpt?

Must assert:
- Follow excerpt_source_ref and source_refs back to src/content/sections/codec.body.html or the source-backed Markdown projection.
- The context packet excerpt is a mechanical projection and not a new canon authority.

Must not assert:
- The convenience excerpt is treated as more authoritative than its cited authored source.

Source expectation: Keep the cited source path attached to claims drawn from the excerpt.

Evidence:
- https://westkitty.github.io/Starsilk_Character_Dossier/discover/packets/codec.json
- https://westkitty.github.io/Starsilk_Character_Dossier/machine/entities/codec.md

### spoiler-major-is-policy

Category: `spoiler-metadata`

Prompt: What does spoiler_level=major on Codec's current entity/context record mean?

Must assert:
- It is a conservative publication default because per-section spoiler classification is not currently authored.
- Spoiler level is independent of canon status and visibility.

Must not assert:
- The major value is presented as an authored lore fact or proof of canon status.

Source expectation: Preserve the record's unknowns explaining spoiler provenance.

Evidence:
- https://westkitty.github.io/Starsilk_Character_Dossier/discover/packets/codec.json
- https://westkitty.github.io/Starsilk_Character_Dossier/machine/AUTHORITY.md
