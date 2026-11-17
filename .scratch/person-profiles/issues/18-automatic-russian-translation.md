# Automatically translate approved Profiles into Russian

Type: task
Status: resolved

Translate approved English Profiles offline instead of publishing English prose in Russian Profile files. Keep historical verification on English and separately audit Russian fidelity.

- [x] `verify` automatically translates approved/current English; `translate` supports backfill, retries and forced regeneration in API/session modes.
- [x] Translation approval binds source identity/content, translated text, policy and complete independent audit; changed source/content invalidates it.
- [x] Preserve structure, citations, legend flags and Connection identities; localize Connection names from the dataset.
- [x] Missing, stale or held translations leave Russian Description; English remains publishable.
- [x] Tests cover altered numbers, missing fields, invalid markup, stale/tampered approvals, audit failures, output and reuse.
- [x] Backfill Cleopatra, Gregorian calendar and Isaac Newton; publish and validate the production build.
- [x] Update living docs and record pipeline ADR 0026.

## Comments

2026-11-17: Published three approved Russian translations covering 71 fields (Cleopatra 24, calendar 22, Newton 25). Independent audits passed; Newton's audit caught strengthened priority wording, exchange-value ambiguity and an awkward sentence, corrected before approval. The retry path uses audit feedback, preserves unaffected text and performs another complete audit. English historical approvals remain unchanged. Pipeline tests/typecheck passed; lint passed with 13 existing warnings. Build/publish and the web production build passed. Output checks confirm translated prose, localized Connection names, unchanged citations/legend flags/Connection identities, and locale `hasProfile` flags. A repeat `verify` skipped all three English approvals and translations without model calls.
