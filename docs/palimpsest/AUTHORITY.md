# Starsilk: Palimpsest authority boundary

`/palimpsest/` is a curated interactive onboarding experience over existing Starsilk authority. It is a presentation system, not a canon database.

## What governs

- Canon/content claims continue to be governed by the existing authoritative Compendium source records under `src/content/sections/` and by `src/canon/invariants.json` where a machine lock exists.
- `src/palimpsest/experience.json` governs only experience identity, phase order, interaction labels, source pointers, and editorial spoiler gates.
- The opening proposition, `Tiger saved us from the Drakken.`, is an editorial question the experience asks the visitor to investigate. Its presence here does not promote that sentence into an independent canon assertion.
- Generated `docs/palimpsest/` files are disposable derivatives and never outrank their cited source records.

## Evidence and interpretation

Palimpsest may juxtapose source-backed facts so a visitor can notice tensions. Juxtaposition is not a new semantic relationship, moral verdict, causality claim, or canon ruling.

Visitor choices are counterfactual learning interactions. The interface must separately identify any historical choice supported by a cited source. A visitor choice never changes canon.

The final claim inspector may classify a proposition as source-supported, unresolved, or editorially contested only within the bounded evidence shown by the experience. It must not produce a morality score, political alignment, personality profile, or claim to know what the visitor believes.

## Local state

Palimpsest may retain the current witness-session state in `sessionStorage` so reloads can resume a local run. That state may contain phase completion, interaction choices, and presentation preferences only.

It must not:

- persist prose written by the visitor;
- create a server-side account;
- send analytics, telemetry, beacons, or remote runtime requests;
- write to the repository;
- promote local state into canon or evidence;
- infer moral character or ideology from choices.

A visible restart action must clear Palimpsest session state.

## Runtime boundary

The experience must remain a same-origin static publication compatible with the existing GitHub Pages architecture. Native browser capabilities may progressively enhance presentation, but the complete narrative path must remain usable without WebGPU, WebXR, motion sensors, vibration, audio, or another permission-gated API.

Canvas imagery is explanatory presentation only. Every meaningful state and interaction must have a DOM/text equivalent.
