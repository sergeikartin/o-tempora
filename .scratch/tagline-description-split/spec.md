Labels: ready-for-agent

# Split `description` into `Tagline` + `Description` (Wikipedia extract)

## Problem Statement

Every entity's detail view — People, Wars & Conflicts, and Events & Inventions alike — shows a single `description` field sourced from Wikidata's `schema:description` claim: a terse, one-line disambiguating subtitle (e.g. "American physicist", "production of voltage by a varying magnetic field"), not real prose. The `DetailPanel` it renders into ([DetailPanel.tsx](../../packages/web/src/widgets/detail-panel/ui/DetailPanel.tsx)) is a scrollable, fixed-width drawer built to hold arbitrary-length text, with no truncation anywhere in the pipeline or the UI — the text is simply short because Wikidata's convention keeps it short, not because anything requires it to be. Users want beefier, more informative descriptions when they open an entity.

## Solution

Split the field in two, per `CONTEXT.md`'s `Tagline`/`Description` glossary entries (already committed):

- **`Tagline`** — the existing Wikidata `schema:description` one-liner, renamed from today's `description`. Stays required for publish (same drop-gate behavior as today). Live-fetched per-QID via Wikidata SPARQL for **all three lanes**, including Events & Inventions (Discoveries) — which today hand-curates this text and never refetches it. No fallback to the curated text once live-fetched: an entity whose live fetch can't resolve a `Tagline` is dropped, matching how People/Wars already behave.
- **`Description`** (new) — Wikipedia's REST summary API `extract` field: the entity's English Wikipedia article's lead paragraph, real prose. Optional (absent when no English Wikipedia article resolves), English-only, uncapped length — no artificial truncation, consistent with the existing zero-truncation convention.

`DetailPanel` renders both, stacked: `Tagline` as a small subtitle under the entity name, `Description` as the main body paragraph below it, omitted entirely when absent.

This is a deliberate, explicitly-confirmed behavior change for Discoveries: its `Tagline` stops being curator-guaranteed-present. A Wikidata item that unexpectedly lacks an English `schema:description` can now cause that entity to be dropped at publish — accepted as consistent with how People/Wars already work, not treated as a special case requiring a fallback.

## User Stories

1. As a user browsing the People lane, I want to see a short identifying subtitle for a person (e.g. "American physicist") at a glance, so that I can quickly confirm I clicked the right entity before reading further.
2. As a user who opens a person's detail panel, I want a real paragraph of biographical prose (not just a one-line tag), so that I actually learn something about who they were without leaving the app.
3. As a user browsing Wars & Conflicts, I want the same short-subtitle-plus-full-paragraph treatment for wars and war events, so that the experience is consistent across lanes.
4. As a user browsing Events & Inventions, I want the same treatment for discoveries/inventions, so that a curiosity-driven click (e.g. "Electromagnetic induction") gives me an actual explanation, not just a six-word fragment.
5. As a user, when an entity has no matching English Wikipedia article, I want to still see its short subtitle without a broken or empty "description" section, so that the panel never looks like something failed to load.
6. As a maintainer of the data pipeline, I want `Tagline` sourced identically (live Wikidata SPARQL, no curated fallback) across all three lanes, so that there's one mental model for where this field comes from, not a lane-specific exception for Discoveries.
7. As a maintainer, I want the new Wikipedia-extract fetch to be resilient to individual failures (network errors, disambiguation pages, missing articles) without ever failing the whole pipeline run, so that one bad QID doesn't block a full data refresh.
8. As a maintainer, I want the new fetch pass rate-limited to Wikimedia's REST courtesy guidance (~2 req/sec) with a proper `User-Agent` and retry/backoff on 429/5xx, so that the pipeline doesn't get throttled or blocked.
9. As a maintainer reading `packages/data-pipeline/CLAUDE.md` and the ADR history, I want the new second live dependency (Wikipedia's REST API, alongside Wikidata SPARQL) and the reasoning for superseding ADR 0006's "no new live dependency" stance to be recorded, so that a future reader doesn't wonder why this was added or try to remove it.
10. As a maintainer, I want Discoveries' curated file's old hand-typed `description` text left on disk (not deleted), so that the historical curation record isn't destroyed even though the pipeline no longer reads it.
11. As a developer extending this codebase later, I want `Tagline` and `Description` to be genuinely independent fields with no fallback logic between them (not "Description falling back to Tagline" merged into one field), so that the type system and the UI both reflect that these are two distinct kinds of content.

## Implementation Decisions

**Renaming `description` → `tagline` (People, Wars, Discoveries):**
- People: the existing per-QID batched-SPARQL description fetch (currently `fetch-descriptions.ts` / `queries/descriptions.ts`) is renamed to reflect `tagline` terminology throughout — module names, the SPARQL query's bound variable, and its raw output file.
- Wars: the existing `wars-enrichment.ts` SPARQL query's `?description` binding is renamed to `?tagline`; its enriched-row shape follows.
- Discoveries: **not just a rename** — this lane's per-QID enrichment SPARQL (`events-enrichment.ts`, which today only backfills sitelinks/article URLs/country/image) gains a new live `OPTIONAL { ?event schema:description ?tagline . FILTER(LANG(?tagline) = "en") }` binding, the same shape Wars already has. The curated file's hand-typed `description` field is no longer read by the pipeline once this lands — left in place on disk, unused, not deleted.
- The shared `TimelineEntry` interface (`packages/shared-types`) changes from `description: string` to `tagline: string; description?: string;`. This is one coherent, atomic type change — all three lanes' transform/output code and all of `packages/web`'s consumers must move together since TypeScript enforces the field across every call site simultaneously (this is a small, single-repo blast radius, not large enough to warrant an expand/contract migration).
- The output-layer drop gate (`write-datasets.ts`'s `validateEventRow`/`buildPeople`) keeps its presence check, just renamed: an entity with no resolvable `tagline` is still dropped, drop-reason string updated from "missing description" to "missing tagline".

**New `description` (Wikipedia extract), all three lanes:**
- A new REST client for Wikipedia's `https://en.wikipedia.org/api/rest_v1/page/summary/{title}` endpoint — single-title lookups only, no VALUES-clause batch equivalent exists for this API. Modeled on the existing Commons `imageinfo` REST client's shape: same courtesy `User-Agent`, same retry/backoff on 429 (honoring `Retry-After`) and 502/503/504, same short request timeout. HTTP 404 is treated as "no data for this title," not an error.
- A pacing/cleaning layer sequences these requests roughly 2/second (Wikimedia's REST courtesy guidance) — deliberately not the higher-concurrency burst pattern the existing pageviews/Commons batch fetchers use, since that would exceed this API's comfortable rate. Extracted text has disambiguation-page and empty results filtered out, and stray Unicode control/format characters (e.g. U+200E) stripped — plain `.trim()` alone doesn't catch these.
- Individual fetch failures are logged and skipped, never fail the whole pipeline run — same best-effort philosophy the existing batched Wikidata SPARQL fetcher already uses.
- Wikipedia article titles are already resolvable for every entity without new Wikidata enrichment: People's from Pantheon's own `slug` column; Wars/Discoveries' from the English-language article URL their existing enrichment SPARQL already resolves (reusing the existing exported URL→title extraction helper rather than duplicating it).
- Output: one combined raw file (per this pipeline's established "raw file is the handoff, checked into `data/raw/`" convention) holding an extract per entity id, per lane.
- `transform`/`write-datasets` pass this through as the new optional `description` field with no fallback logic — `tagline` and `description` are independent fields, never merged or substituted for one another.
- No length cap on the extract text — nothing in the pipeline or the UI truncates today, and Wikipedia's REST summary extract is already bounded to a lead paragraph (typically a few hundred characters).
- No caching of fetch results across pipeline runs — follows the existing convention that every `npm run fetch` run refetches everything from scratch. This step is the dominant cost of a fetch run (~4,000+ sequential REST calls, mostly the People lane), accepted as a one-time cost of an on-demand (never scheduled, never runtime) pipeline.

**`packages/web`:**
- `DrawerContent` (the shape `build-drawer-content.ts` assembles for `DetailPanel`) gains `tagline: string` alongside a now-optional `description?: string`, threaded through from each of the three entity-content builders (person/war/discovery).
- `DetailPanel` renders `tagline` as a subtitle under the entity name/date line, and `description` as a body paragraph below it — present only when the field is present. New CSS for the subtitle style, visually distinct from (smaller/lighter than) the existing body-text style now used for the extract.

**Docs:**
- `packages/data-pipeline/CLAUDE.md`'s pipeline description and stack table updated to reflect `tagline` being live-fetched for all three lanes (no more Discoveries exception) and the new Wikipedia REST dependency for `description`.
- A new ADR records: the field split itself; adding Wikipedia's REST summary API as a second live dependency (explicitly superseding the existing "no new live dependency beyond Wikidata SPARQL" ADR for this one field, which stays as immutable history with a pointer note added rather than being rewritten); and Discoveries' `tagline` becoming live-fetched with no curated fallback (a narrow reversal of that lane's "curated, never refetched" description-sourcing precedent — entity *selection* for Discoveries remains curated and untouched, only this one field's sourcing changes).
- `CONTEXT.md`'s `Tagline`/`Description` glossary entries are already committed as part of the design work preceding this spec.

## Testing Decisions

Three seams, confirmed with the user — external behavior only, no implementation-detail assertions:

1. **New network-boundary seam**: the new Wikipedia REST summary client gets its own dedicated test file, mirroring the existing Commons `imageinfo` client and Wikidata SPARQL client tests (`commons-client.test.ts`, `wikidata-client.test.ts`) — the only place HTTP/`fetch` is mocked directly. Covers: title encoding, a successful parse, 404 treated as empty (not an error), retry-then-succeed on a 5xx, no retry on a non-retryable 4xx, and rejection of a malformed response shape.
2. **Data-pipeline output-boundary seam** (existing, reused): the established `stubRawFiles`-based fixture pattern already used in `transform/index.test.ts` for Wars/Discoveries. This is the highest seam that can exercise `tagline` sourcing (live-fetched vs. previously-curated), the new `description` merge, and the presence/drop-gate behavior together, without re-testing each individual fetch script's internals through it. Extend with cases for: `tagline` present/absent (drop) per lane, `description` present/absent (no drop, field simply missing) per lane, and new `transformPeople` coverage (this function currently has none).
3. **UI-boundary seam** (existing, reused): `build-drawer-content.test.ts` and `DetailPanel.test.tsx`, the same seam already covering image/reign-period rendering. Extend for: tagline renders as the subtitle for all three entity types; description renders as body text when present; description's body section is cleanly absent (not an empty paragraph) when the field is undefined.

The pacing/cleaning layer between the new client and the transform seam (dedup, per-entry try/catch skip-on-failure, disambiguation/empty filtering, control-character stripping) is tested directly at the unit level alongside the client, since it's new logic with edge cases (disambiguation pages, control characters) that the higher transform seam has no natural way to exercise without contrived fixtures.

## Out of Scope

- Any non-English Wikipedia extract fallback (an entity with no English article simply has no `Description`, `Tagline` alone still renders).
- Any length cap/truncation on the new `Description` field, in the pipeline or the UI.
- Caching Wikipedia fetch results across pipeline runs to speed up reruns.
- Any change to which entities are selected for Wars/Discoveries' curated lists — this spec only changes how `Tagline`'s *text* is sourced for already-curated entities, not entity selection itself.
- Any UI mechanism (tooltip, preview) beyond the existing click-to-open `DetailPanel` drawer — no hover tooltip exists today and none is being added here.
- Deleting or otherwise modifying Discoveries' curated file's old hand-typed `description` values on disk.

## Further Notes

- Volume: the new extract fetch touches roughly 4,150+ People rows (everything clearing the existing `MIN_HPI` floor) plus the much smaller Wars/Discoveries curated lists — at ~2 requests/second this is a multi-minute, dominated-by-People fetch step, one-time per `npm run fetch` run. This is an accepted operational cost of an on-demand pipeline with no scheduler.
- The `tagline`/`description` split was reached via a `/grilling` + `/domain-modeling` session; `CONTEXT.md` already carries the resulting glossary entries and should be treated as the source of truth for the two terms' precise meaning during implementation.
- A prior draft of this work considered a single `description` field with "Wikipedia extract, falling back to Wikidata's short text" merge logic. That approach was explicitly rejected in favor of the two-field split — do not reintroduce fallback merging between `tagline` and `description`; they are independent fields.
