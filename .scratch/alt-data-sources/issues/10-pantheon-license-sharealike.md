Type: grilling
Status: resolved

## Question

Pantheon 2.0 is licensed **CC BY-SA 4.0** (Attribution-ShareAlike), not a generic CC license as assumed at charting time — see [Pantheon schema research](../issues/05-research-pantheon-schema.md). Vetustas Archiva's inventions data carries the same CC BY-SA 4.0 license (its code is separately MIT) — see [Vetustas schema research](../issues/07-research-vetustas-schema.md). ShareAlike (Section 3(b) of the license) likely requires that "Adapted Material" — a transformed subset of these fields shipped inside this app's `people.json`/`events.json` would qualify — be distributed under a compatible CC BY-SA 4.0 notice of its own, separate from whatever license covers the app's own source code.

Is CC BY-SA 4.0's ShareAlike obligation acceptable for this project, for any dataset carrying it (Pantheon for People, and Vetustas if adopted for Events & Inventions)? If yes, how should the derived dataset's license notice be surfaced (a LICENSE/NOTICE file, a credits page, a comment in the generated JSON)? If no, this reopens both the People-lane sourcing decision and, if relevant, the Events & Inventions sourcing decision.

## Context

Blocks: shipping any Pantheon-derived data, and any Vetustas-derived data if [Events & Inventions source decision](../issues/14-events-source-decision.md) adopts it. Depends on [People source: Pantheon](../issues/01-people-source-pantheon.md) — if this resolves "not acceptable," that decision needs revisiting.

## Answer

Accepted. The project currently has no stated license (`package.json` has no `license` field, `"private": true`, no `LICENSE` file) — this sets its first data-licensing stance. Compliance mechanism: a `LICENSE-DATA` notice (or similar) marking the Pantheon-derived fields in `people.json` (and Vetustas-derived fields in `events.json`, if [Events & Inventions source decision](../issues/14-events-source-decision.md) adopts it) as CC BY-SA 4.0, plus an attribution credit surfaced somewhere in the app (About/Sources page or footer) citing Yu et al. 2016 for Pantheon. Exact placement/wording is an implementation detail, not decided further here. The app's own source-code license is a separate, unrelated question this ticket doesn't touch.
