# Spec: Data Pipeline — Score, Tag, Output (Unit 2)

## Goal

Turn the raw Wikidata snapshots in `/data-pipeline/data/raw/` into
schema-correct, deduplicated `people.json` and `events.json` — ranked
by fame score, tagged with occupation/region categories, and copied
into `/src/shared/data/` — so the frontend has a real dataset to
render from the start of Unit 4.

## Prerequisite: extend Fetch (Unit 1 gap)

While reviewing the raw snapshots against the required output schema,
none of the three SPARQL queries (`fetch/queries/people.ts`,
`historical-events.ts`, `inventions.ts`) fetch a description —
`project-overview.md` requires a "short description" field on every
person and event, and it's currently missing entirely. Per your
answer, this is fixed by extending Fetch rather than adding a second
Wikidata contact point inside Transform:

- Add `OPTIONAL { ?person schema:description ?description . FILTER(LANG(?description) = "en") }`
  (and the equivalent `?event` form) to all three query builders.
- Re-run `npm run fetch` to regenerate all three raw snapshots with
  the new `description` binding included.
- This is a one-line addition per query file, done as an explicit
  first step of this unit, before any Score/Tag/Output code is
  written — not a silent scope change, since it touches Fetch files
  that Unit 1 already shipped.
- Entries still missing a description after this (Wikidata has no
  `schema:description` for every item) are handled by the same
  drop rule as missing name/article — see Output stage below.

## Design

### Pipeline shape

Three new modules under `/data-pipeline/transform/` and one under
`/data-pipeline/output/`, run in sequence via a new `npm run build-data`
script (`transform → output`, mirroring the existing `npm run fetch`
orchestration pattern in `fetch/index.ts`):

```
transform/
  group-rows.ts          // denormalized SPARQL rows → one record per entity
  score.ts                // fame score + descending sort
  occupation-categories.ts // Q-ID → category lookup table + mapping fn
  region-categories.ts     // Q-ID → region lookup table + mapping fn
  event-type-categories.ts // the 8 historical-event class Q-IDs → category
  tag-people.ts            // applies occupation + region tagging to grouped people
  tag-events.ts             // applies category + region tagging to grouped events (both sources)
  index.ts                  // orchestrates group → score → tag for both datasets
output/
  write-datasets.ts        // validates final shape, writes people.json/events.json, copies to /src/shared/data/
  index.ts
```

### Why grouping comes before scoring or tagging

The raw SPARQL results are **denormalized**: a person with 3 occupation
claims appears as 3 rows sharing the same `?person` URI (confirmed
against the real data — `people.raw.json` has 4,000 rows for only 552
unique people). Scoring and tagging both need one record per entity,
so `group-rows.ts` is a distinct first step: it collapses rows by
entity URI into `{ id, label, dates, sitelinks, occupations: string[],
countries: string[], article, description }` before Score or Tag ever
see the data. This isn't a new pipeline stage in the architecture
sense (Fetch/Score/Tag/Output stay the four stages from
`architecture.md`) — it's a shared normalization helper both Score and
Tag are built on top of, since neither can do its job on raw
denormalized rows.

### Fame tier ceiling: 750

Per your decision, the "more" tier caps at **750**, applied
independently per lane:

- People lane: top 750 by sitelink count, out of the 552 unique
  candidates currently in `people.raw.json` (i.e., today, "top 750"
  and "all available candidates" are the same set — the cap only
  starts binding if a future Fetch re-run against a lower sitelink
  threshold produces more candidates).
- Events lane: top 750 by sitelink count, out of historical events
  (1,231 unique) and inventions (4,691 unique) **combined into one
  ranked pool** — confirmed no ID overlap between the two raw files,
  so the merge is a simple union, no dedup-conflict handling needed.

`shared/config/` (frontend) already needs a fame-tier constant list
(200/300/400/750) per `architecture.md`'s Stack table — this spec
only fixes the pipeline-side ceiling; wiring the frontend's fame-tier
selector UI to these numbers is Unit 9's job, not this one.

### Occupation / event-category tagging

Fixed category set (shared with region... no — shared across People
and Events per `ui-context.md`): `science, politics, art, philosophy,
war, invention, exploration, religion`.

- **People**: `occupation-categories.ts` is an explicit
  `Record<string, Category>` keyed by Wikidata occupation Q-ID (e.g.
  `Q36180` "writer" → `art`, `Q82955` "politician" → `politics`,
  `Q4964182` "philosopher" → `philosophy`). Built by hand against the
  447 distinct occupation Q-IDs actually present in `people.raw.json`
  (a helper script, `transform/list-unmapped-occupations.ts`, dumps
  any Q-ID a grouped person carries that isn't yet in the table — run
  it after each batch of manual additions until it reports zero
  unmapped IDs across the top-750 pool).
- Per your decision: each person gets **one primary `category`**
  (used for bar color — the occupation claim mapping to a category
  with the most sitelink-weighted... no sitelink weighting exists per
  claim, so: the first occupation claim that maps to a known category,
  in claim order) **and** a full `occupationTags: Category[]` (deduped,
  used for occupation-filter matching against any active chip).
- **Historical events**: `event-type-categories.ts` maps the 8
  known `?type` class Q-IDs directly — this is a closed, already-fully-
  enumerated set (confirmed: exactly 8 distinct values appear in
  `events-historical.raw.json`, matching `EVENT_TYPES` in
  `fetch/queries/historical-events.ts`):
  - war (Q198), battle (Q178561), siege (Q188055), military operation
    (Q645883) → `war`
  - treaty (Q131569), revolution (Q10931), rebellion (Q124734) →
    `politics`
  - historical event (Q13418847) — generic catch-all, only 25 rows —
    → `politics` (fallback; flagged here as a judgment call, not a
    real Wikidata signal, since this class carries no inherent
    category)
- **Inventions**: no `?type` field exists in this query (see
  `fetch/queries/inventions.ts`'s own comment on why). Every row from
  `events-inventions.raw.json` gets category `invention`, unconditionally
  — no lookup table needed for this source.

### Region tagging

- `region-categories.ts`: explicit `Record<string, Region>` keyed by
  Wikidata country/state Q-ID, values from the fixed set (`europe,
  east-asia, south-asia, middle-east, africa, americas`) — note this
  fixed set has no entry for Oceania/Australia or Sub-Saharan vs.
  North Africa distinctions; if a candidate resolves to a place not
  covered by the six regions in `project-overview.md`, treat it the
  same as "no region" (empty tag) rather than inventing a ninth
  category, mirroring the "no ninth pastel" rule `ui-context.md` sets
  for occupation.
- Built the same way as occupation: a helper script dumps distinct
  country Q-IDs actually present (153 for people, 237 for historical
  events, 47 for inventions — build the table against the union) and
  is re-run until nothing's unmapped in the top-750 pool. Many are
  historical polities (e.g. Roman Republic, Qing dynasty) rather than
  modern states — each is mapped to the region its territory
  geographically corresponds to, not its current-day political
  successor's name.
- Per your decision: candidates with **no** country/nationality claim
  at all (365/552 people rows lack one before grouping — after
  grouping, count as "has zero country claims") ship with
  `regionTags: []`. They're visible with no region filter active and
  disappear the moment any region chip is toggled on — this falls out
  of Invariant 2's AND-only filtering with no special-case code
  needed, per your call.
- Unlike occupation, there's no single "primary region" needed — the
  UI Context doesn't tie region to any visual encoding (region is
  filter-chip-only, never a fill/border color), so `regionTags:
  Region[]` (deduped, possibly empty) is the only region field. No
  parallel "primary region" field.

### Output stage: drop rules

An entry is excluded from the final JSON (not written with a null
field) if, after grouping, it's missing any field the type contract
requires:

- No English label/name (`personLabel`/`eventLabel` — 29 people rows,
  2,380 invention rows affected pre-dedup)
- No Wikipedia article link (0 people rows, 2,920 invention rows
  affected pre-dedup)
- No description (see Fetch-extension note above — actual rate
  unknown until the re-fetch runs; same drop rule applies)
- No birth date (people) / no date (events) — Fetch already requires
  this via `FILTER(BOUND(...))`, so it should be structurally
  impossible, but `output/write-datasets.ts` validates it defensively
  anyway since Output is the last chance to catch a schema violation
  before the frontend ever sees this data.

Missing `deathDate` (people) is **not** a drop condition — living
people are valid data; `Person.deathYear` is optional in the type
contract (see below).

### Fame score

Per `architecture.md`, fame score is the sitelink count, unmodified —
no normalization, no log-scaling, no blending with page views or
manual weight. `score.ts` is a one-line sort by `sitelinks` descending
plus a slice to 750; scoring introduces no new derived number beyond
what's already in the raw data.

## Implementation

Build in this order, each a small, reviewable step:

1. **Fetch extension** (prerequisite, touches `/data-pipeline/fetch/`):
   add `description` to all three query builders, re-run `npm run
   fetch`, spot-check the regenerated raw JSON for the new field.
2. **Shared types**: add `Person` and `HistoricalEvent`/`TimelineEvent`
   interfaces somewhere both `/data-pipeline` and (eventually)
   `/src` can import from without either project importing the other
   — per `architecture.md`'s "share those types between `/src` and
   `/data-pipeline` rather than redefining them," this needs its own
   package-boundary decision (e.g. a small shared-types workspace
   package, or duplicated-but-identical files with a comment pointing
   at the canonical copy). **Flagging this as a real open question**
   rather than deciding it silently — `code-standards.md` says share,
   but the repo has no shared package set up yet, and Unit 3
   (frontend scaffold) hasn't happened yet either. Propose resolving
   this explicitly before writing the type files, possibly as a tiny
   preliminary step of its own.
3. `transform/group-rows.ts` — denormalized rows → grouped entity
   records, for people and for each event source. Unit tested against
   small fixture rows (a synthetic 2-row, 1-entity case) rather than
   the full raw files.
4. `transform/occupation-categories.ts`, `event-type-categories.ts`,
   `region-categories.ts` — the lookup tables, plus
   `list-unmapped-occupations.ts` / `list-unmapped-countries.ts`
   helper scripts to drive filling them in against the real data.
5. `transform/tag-people.ts`, `transform/tag-events.ts` — apply the
   lookup tables to grouped records, producing primary category +
   tag array (people) or category (events) + region tags.
6. `transform/score.ts` — sort-and-slice to top 750 per lane.
7. `transform/index.ts` — orchestrates steps 3–6 for both datasets.
8. `output/write-datasets.ts` — final shape validation, writes
   `data-pipeline/output/people.json` / `events.json`, copies both
   into `/src/shared/data/`.
9. Run end-to-end (`npm run build-data`), spot-check output (e.g.
   confirm Pericles lands in `people.json` with `category: politics`,
   non-empty `occupationTags`, correct BCE date, working Wikipedia
   URL).
10. Update `progress-tracker.md` (mark Unit 2 complete, log real
    output counts) and `code-standards.md`'s File Organization list
    with the new `transform/` and `output/` files, per
    `ai-workflow-rules.md`'s "update in the same unit of work" rule.

## Dependencies

No new packages. This unit only uses what's already in
`data-pipeline/package.json` (Node's built-in `fs`/`path`, TypeScript,
`tsx`) — no HTTP client needed here (Fetch's re-run reuses the
existing `wikidata-client.ts`), no schema-validation library, since
validation is a handful of explicit field-presence checks, not
complex enough to justify a dependency like `zod` without calling it
out first per `ai-workflow-rules.md`.

## Verification Checklist

1. Fetch re-run completes and all three raw snapshots contain a
   `description` binding on at least the majority of rows.
2. `group-rows.ts` collapses `people.raw.json`'s 4,000 rows to exactly
   552 grouped records (or however many the post-re-fetch run
   produces) — no entity appears twice in grouped output.
3. Every person in `people.json` has exactly one `category` and a
   non-empty-or-legitimately-empty `occupationTags` array; no person
   has a category absent from the fixed 8-value set.
4. Every event in `events.json` has a `category`; inventions are all
   tagged `invention` unconditionally, historical events follow the
   8-class table.
5. `regionTags` is `[]` (not missing, not null) for candidates with no
   country claim — never causes a write error or an "undefined"
   leaking into the JSON.
6. Fame tier nesting (Invariant 3) holds: the top-200 slice of
   `people.json` is exactly the first 200 entries of the top-750
   slice, unchanged — verified by literally slicing the sorted array,
   not re-querying.
7. No entry in either output file is missing `name`/`label`,
   `article` (Wikipedia URL), `description`, or a required date field
   — the drop rule was actually applied, not just documented.
8. `people.json` and `events.json` exist in both
   `/data-pipeline/output/` and `/src/shared/data/` and are identical
   copies.
9. `npm run typecheck` (data-pipeline) is clean, strict mode, no `any`.
10. Fetch stage still writes only to `/data-pipeline/data/raw/` and
    still never merges/scores/tags (Invariant 8) — the description
    addition is a new field in the same query shape, not new
    Fetch-side logic.
11. Nothing outside Output writes to `/src/shared/data/*.json`
    (Invariant 7).
12. `progress-tracker.md` and `code-standards.md` updated in this same
    unit, per `ai-workflow-rules.md`.
