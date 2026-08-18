Labels: ready-for-agent

# Russian Localization

## Problem Statement

Today the app is English-only, end to end: `TimelineEntry.name`/`tagline`/`description` are single strings sourced once at pipeline-build time (Conflicts/Milestones `name` is curator-typed, People's `name` comes from Pantheon's CSV, `tagline`/`description` are live-fetched from Wikidata/Wikipedia in English only — see `packages/data-pipeline/CLAUDE.md`), and every UI string (nav, buttons, filter/taxonomy labels) is hardcoded English text in `packages/web`. There is no i18n infrastructure, no per-language routing, and nothing in `docs/product-scope.md` addresses localization at all.

The user wants to read People/Conflicts/Milestones content in Russian, specifically because some entity names carry historiographical framing that a literal translation loses — e.g. the French Revolution's Wikidata Russian label is "Великая французская революция" ("**Great** French Revolution," the actual Russian-language historical convention), not a word-for-word translation of "French Revolution." That's the motivating case for sourcing Russian text from Wikidata's own per-language labels rather than machine-translating the English strings.

## Solution

Ship a fully separate Russian build of the app, alongside the existing English one, as **part of the v1 launch** (not a fast-follow):

- Two independent static deployments under one domain, subpath-addressed (e.g. `same-sky.app/en`, `same-sky.app/ru`), each single-language all the way down — no runtime language toggle, no inline bilingual display.
- A simple home-level link between the two (switches to the sibling deployment's default view; no deep-link/viewport-state preservation for v1).
- Both **entity content** (`name`, `tagline`, `description`, all three lanes) and **UI chrome** (nav, buttons, and every taxonomy/filter label — Occupation Domain, Conflict Category, Milestone Category, Region, Data Depth) get Russian versions.
- Entity content becomes symmetric, fully automated Wikidata/Wikipedia sourcing in both languages — no lane keeps a curator-typed or single-language-only field once this lands.
- Every field falls back to English, per field, when Russian data doesn't resolve for a given entity. Both language builds ship the identical entity set (same drop/inclusion rules as today) — only per-field text differs.

This is reached via a `/grilling` + `/domain-modeling` session; no `CONTEXT.md` glossary entries exist yet for the new concepts this introduces (see Further Notes) — write them as part of implementation, not deferred.

## User Stories

1. As a Russian-reading user, I want to open a fully Russian version of the app (not just some fields translated with English chrome around them), so that the experience reads as finished rather than half-localized.
2. As a user learning Russian, I want entity names sourced from Wikidata's own Russian label rather than a literal translation of the English name, so that I see the real historiographical framing (e.g. "Great French Revolution"), which is the whole reason I wanted this.
3. As a user on the Russian build, when a specific entity has no resolvable Russian name/tagline/description, I want to still see that entity (in English for the missing field) rather than have it silently vanish from the dataset.
4. As a user on either build, I want a visible link to switch to the other language's home view, so that I can move between them without knowing the URL scheme.
5. As a maintainer, I want the pipeline to produce two fully pre-resolved dataset files per lane (English/Russian), with fallback already baked in, so that `TimelineEntry`'s shape and all of `packages/web`'s consumer code stay completely unchanged — a build just points at a different data file.
6. As a maintainer, I want Conflicts/Milestones' `name` field sourced automatically from Wikidata's `rdfs:label` (both languages) instead of curator-typed text, so that English and Russian names come from one symmetric, consistent mechanism with no per-entity editorial drift between them.
7. As a maintainer, I want People's `name` sourced the same way (via the existing `wd_id`), replacing Pantheon's frozen-snapshot English name, so that all three lanes share one name-sourcing mechanism — accepting that names now reflect Wikidata's current state rather than Pantheon's snapshot date (e.g. a title change like "Prince of Wales" → "Charles III" would now show up on refetch).
8. As a maintainer, I want an initial Russian translation dictionary for UI chrome (nav/buttons/taxonomy labels) checked into the repo as a reviewable artifact, so that there's a concrete starting point rather than a live-translation dependency at build or runtime.
9. As a maintainer updating `docs/product-scope.md`, I want the Russian build's in-scope status and success criteria folded into the same v1 launch bar, so that the doc doesn't understate what v1 actually ships.

## Implementation Decisions

**Entity content sourcing (data-pipeline):**
- Conflicts/Milestones `name`: retire the curator-typed field entirely. Fetch `rdfs:label` in both `en` and `ru` via the same batched per-QID SPARQL pattern already used for `tagline`/sitelinks (see `queries/conflicts-enrichment.ts`, `queries/milestones-enrichment.ts`). The curated raw JSON's existing hand-typed `name` values are left on disk, unused, not deleted — same precedent as `tagline-description-split`'s treatment of Discoveries' old curated `description`.
- People `name`: switch from Pantheon's CSV `name` column to the same `rdfs:label(en)`/`rdfs:label(ru)` fetch, keyed by the existing required `wd_id` column (`pantheon-row-shape.ts`). This needs a new batched SPARQL enrichment pass for People keyed on `wd_id`, parallel to the existing People tagline/image enrichment pass.
- `tagline` (`schema:description`): extend the existing `FILTER(LANG(?tagline) = "en")` pattern with a second `ru`-filtered `OPTIONAL` binding, all three lanes.
- `description` (Wikipedia lead extract): add a second REST pass against `ru.wikipedia.org`'s summary API, parallel to the existing hardcoded `en.wikipedia.org` client (`wikipedia-client.ts`'s `ENDPOINT` needs to become per-language, not a constant). Expect materially lower Russian coverage than English here — this is exactly what the per-field English fallback exists for.
- Per-field fallback resolution (Russian value if present, else English) happens **in the pipeline**, at output time — not in `packages/web`. Each language's dataset file ships with fallback already baked in.

**Pipeline output shape:**
- Two fully parallel, pre-resolved JSON files per lane: `people.json`/`people.ru.json`, `conflicts.json`/`conflicts.ru.json`, `milestones.json`/`milestones.ru.json` in `packages/shared-types/src/data/`.
- `TimelineEntry` and all per-lane types (`Person`, `Conflict`, `ConflictEvent`, `Milestone`) are unchanged — still single-string `name`/`tagline`/`description`. The `.ru.json` files use the identical shape, just Russian-or-English-fallback text baked in per field.
- Both files, per lane, contain the same set of entity `id`s — inclusion/drop rules (sitelinks, tagline presence, date resolution, etc.) run once, off the English fetch results, and apply identically to both outputs.

**`packages/web`:**
- A build-time language selector (e.g. an env var) picks which lane data files to bundle and which UI chrome string catalog to use. No runtime language switch, no client-side routing library — this is a build-time fork producing two static outputs.
- New Russian UI-chrome string catalog covering nav, buttons, tooltips, and every taxonomy label surface (Occupation Domain pills, Conflict/Milestone Category labels and groups, Region pills, Data Depth). Drafted by the implementing agent as an initial pass, checked in for the user to review/correct — not machine-translated at build or runtime.
- A home-level link/switcher between the `/en` and `/ru` deployments (static link to the sibling build's root, no state preservation).

**Docs:**
- `docs/product-scope.md`: fold the Russian build into the v1 "In scope" list and success criteria (not a separate "out of scope, deferred" line) — reflects the same-v1-push decision.
- `packages/data-pipeline/CLAUDE.md`: update the pipeline description/stack table for the new `ru.wikipedia.org` REST dependency, the new People label-fetch pass, and Conflicts/Milestones' `name` no longer being curator-typed.
- Root `CONTEXT.md`: add glossary entries for the new domain concepts this introduces (language build, per-language dataset file, fallback resolution, etc. — exact terms to be settled during implementation, following `docs/agents/domain.md`'s "creates them lazily" convention).
- A new ADR should record: retiring curator-typed `name` for Conflicts/Milestones; switching People's `name` off Pantheon in favor of Wikidata; and the new `ru.wikipedia.org` live dependency alongside the existing `en.wikipedia.org` one.

## Out of Scope

- Any runtime language toggle or inline bilingual (side-by-side) display — this is two separate builds, not a switch within one app session.
- Deep-linking the language switcher to preserve the selected entity/viewport across builds — home-level link only for v1.
- Translating entity `description` via machine translation as a substitute for the `ru.wikipedia.org` fetch — Russian `description` comes from Wikipedia's own Russian article, or falls back to English; never a translated version of the English extract.
- A curator override mechanism for Conflicts/Milestones' auto-fetched `name` (e.g. a `nameRu` hand-correction field) — not needed since both languages now come from the same automated Wikidata source; revisit only if real-world drift turns out to bite.
- Any languages beyond English/Russian.
- A re-fetch/staleness-monitoring mechanism for Wikidata-sourced names beyond the pipeline's existing on-demand, no-scheduler model.

## Further Notes

- Reached via a `/grilling` session using `/domain-modeling`; no `CONTEXT.md` terms exist yet for this feature's concepts — write them during implementation rather than treating this spec's prose as the terminology source of truth.
- Spot-checked 12 People entries (top-200-by-fame sample) against live Wikidata `en` labels: 11/12 matched Pantheon's `name` exactly; the one mismatch was "Charles, Prince of Wales" (Pantheon, frozen snapshot) vs. "Charles III" (Wikidata, current) — confirms the switch is low-risk for existing display text, with title/status changes over time as the one known drift category, explicitly accepted.
- The Conflicts curated raw file's own placeholder text (`"name": "conflict label"`) suggests curators were already hand-copying Wikidata's label into `name` rather than freely editorializing — consistent with the spot check finding curator names already match Wikidata's `en` label exactly in the sampled cases.
- Testing-seam decisions (what gets unit-tested vs. covered at the transform/output boundary vs. UI boundary) were not part of this grilling session and should be worked out at implementation time, following this repo's existing seam conventions (see `tagline-description-split/spec.md`'s Testing Decisions section for the shape that discussion should take).
- `docs/product-scope.md`'s success criteria will need a Russian-dataset-completeness bar defined (e.g. does "top 200 people" apply per-language, or is the English set the floor and Russian inherits whatever coverage falls out of fallback) — not decided in this session, needs settling before the doc rewrite.

## Comments

This spec's "no runtime language toggle... build-time fork producing two static outputs" decision is superseded by `packages/web/docs/adr/0009-runtime-locale-switch-replaces-per-locale-builds.md`: the app is now a single build with the locale resolved at runtime from the URL. The `/` ↔ `/ru/` URL scheme and the switcher's full-page-navigation, no-state-preservation behavior are unchanged — only the build/deploy mechanism producing them moved.
