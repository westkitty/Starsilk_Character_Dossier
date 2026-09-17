# Administration Educational Film Vault authority

The Film Vault is a curated collection of **diegetic Starsilk media**: fictional instructional films issued, commissioned, distributed, recovered, or archived by the Administration.

It is not a second canon database. Film metadata, scripts, questions, staging, and institutional framing may interpret established canon for dramatic production, but they do not outrank authored Compendium canon, the Canon Ledger, chronology authority, or machine-enforced invariants.

## Authority rules

- The Administration is the ultimate issuer for every reel.
- The exact institutional slogan is **Your fate is in our hands.**
- `src/films/films.json` is editorial/production authority for the Film Vault catalog and film treatments only.
- Canon facts cited by a reel remain governed by their existing Compendium sources. `source_stable_ids` are source pointers, not new relationship claims.
- A reel may expose institutional framing, euphemism, propaganda, selective truth, and morally distorted interpretation without converting that framing into objective canon truth.
- `status=planned` means the reel is only a catalogued production concept. It must not be presented as a completed recovered film.
- `status=production-treatment` means a production-ready treatment/transcript exists, not that a rendered video or audio master exists.
- Archive dates remain `unknown` until authored. Mid-century styling is presentation grammar, not an in-universe calendar claim.
- Generated `docs/films/` files are public derivatives owned by `build/film_publication.py` and must not be hand-edited as authority.

## Tone

The Administration is patient, paternal, procedural, emotionally remote, and certain that compliance is ordinary. It does not perform theatrical villainy. Catastrophe is normalized through approved vocabulary, allocation language, civic instruction, and selective truth.
