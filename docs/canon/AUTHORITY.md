# Canon Inspector authority

The Canon Inspector is a deterministic public derivative of `src/canon/invariants.json`. It publishes the machine-enforced validation locks used by the repository. It is not the complete Starsilk canon and it is not a second editable canon database.

## Authority hierarchy

1. Authored dossier content in `src/content/sections/*.title.html`, `src/content/sections/*.body.html`, and the stable section structure in `src/content/sections.json` remain the canon/content authority.
2. `src/canon/invariants.json` is the machine-validation authority. It extracts a deliberately limited set of established facts into enforceable locks.
3. `build/validate.py --strict` applies those locks to the generated Compendium. Document locks run over the complete generated document; section locks run only over their declared generated section.
4. `build/canon_publication.py` renders `/canon/` from the invariant file. Its HTML, JSON, Markdown, schema copy, and this note are public derivatives and can be regenerated.

Absence from the public register does not mean a fact is non-canon, false, or available for invention. It means only that no corresponding machine-enforced lock is registered here.

## Scope and pattern semantics

- A document lock applies to the complete generated Compendium. Its positive requirements are checked only at that document scope; its prohibitions apply globally.
- A section lock applies to the generated section identified by its existing stable section ID. Both positive requirements and prohibitions are evaluated inside that declared section.
- Pattern strings are implementation evidence for the validator. They are not standalone canon prose and must not be read as a complete statement of any character, object, or world fact.

The structural counts, principal-name expectations, and Drakken art identities shown by the inspector are additional invariant inputs used by the existing strict validator. They are not promoted into inferred lore or new public identities.

## Public boundary

The Canon Inspector contains only public, deterministic derivatives of repository authority. It must pass `tools/check_public_boundary.py`, preserve existing section/object/relationship identities, and must not modify canonical media, authored canon prose, or observed-xref semantics.
