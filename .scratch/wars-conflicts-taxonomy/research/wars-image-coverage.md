# P18/Commons image coverage for Wars & Conflicts — research findings

Status: answers all questions in `../issues/10-research-wars-image-coverage.md`.

**Scope note**: this re-runs, for Wars & Conflicts only, the measurement the
Dynamic tooltips map's `../../dynamic-tooltips/research/image-sourcing.md`
explicitly skipped for this lane. The mechanism itself (`Special:FilePath?width=`
thumbnailing, per-file Commons `imageinfo`/`extmetadata` licensing lookup, the
`wdt:P18` claim) is **not re-derived here** — that file, and
`../../dynamic-tooltips/spec.md` §4, are the precedent and are treated as
settled. This file only supplies the missing numbers: P18 coverage and
licensing mix for the population that will actually ship — items clearing
each category's specialist/fetch floor of 70 sitelinks, per the resolved
[Per-category sitelink fame-tier floors](../issues/01-per-category-sitelink-floors.md)
ticket.

All figures below are computed from **live queries against
`https://query.wikidata.org/sparql`** and the Commons `action=query&prop=imageinfo`
REST API, run 2026-08-08, with `User-Agent: same-sky-research/0.1 (personal
project research; contact sergei.kartin@gmail.com)` (matching the precedent
research's UA convention). All commands are reproducible as given.

## 0. Method (for reproducibility)

### 0.1 Query shape — matches `historical-events.ts`, not a transitive walk

Per `packages/data-pipeline/src/fetch/queries/historical-events.ts`, this
pipeline's existing Wars query uses a direct `wdt:P31 ?type` against an
explicit `VALUES` list of classes, not a `wdt:P279*` transitive walk — the
transitive form times out against WDQS at this corpus size (comment in that
file, not re-verified here since it's an established fact about this
pipeline's query shape, not something this ticket questioned). Every query
below follows the same direct-`wdt:P31`-per-QID shape, one QID at a time
(the 9 categories are evaluated as 9 independent single-class queries, mirroring
how the "Split fetch into per-category queries" effort is restructuring the
fetch stage into 9 type-specific queries — one per `ConflictCategory` value —
rather than the single shared `EVENT_TYPES` list `historical-events.ts`
currently uses).

### 0.2 Coverage query — and a dedup bug caught mid-run

First attempt used a plain `COUNT(?item)`/`SUM(IF(BOUND(?image),1,0))` shape
(the same pattern as the precedent research's discovery/people coverage
query). This **overcounts** for Wars: several war/battle items carry
*multiple* `P18` values (e.g. Battle of Badr, `Q486124`, has 7 distinct
Commons images), and `OPTIONAL { ?item wdt:P18 ?image }` produces one output
row per `(item, image)` pair, not one row per item — a non-`DISTINCT` count
inflates both `total` and `withImage` by however many extra images an item
happens to carry. This was caught by comparing the first-pass numbers
against the "Per-category sitelink fame-tier floors" ticket's own population
column (40/16/2/7/11/5/1/3/6) — the first-pass totals were as high as
45/24/3/11/… , a mismatch traced directly to Battle of Badr's 7 rows
inflating `battle`'s count from 16 to 24.

Corrected query (per category, `${qid}` substituted for each of the 9 values):

```sparql
SELECT (COUNT(DISTINCT ?item) AS ?total) (COUNT(DISTINCT ?itemWithImage) AS ?withImage) WHERE {
  ?item wdt:P31 wd:${qid} ;
        wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= 70)
  OPTIONAL { ?item wdt:P18 ?image . BIND(?item AS ?itemWithImage) }
}
```

`COUNT(DISTINCT ?itemWithImage)` is correct here because SPARQL's `COUNT`
skips unbound inputs (a row where the `OPTIONAL` didn't match binds nothing
to `?itemWithImage`, which `COUNT` doesn't count) — the same "unbound ≠
counted" behavior the precedent research's `SUM(IF(BOUND(...),1,0))` pattern
relied on, just expressed with `DISTINCT` added so multi-image items don't
multiply the count.

This corrected query's output for every one of the 9 categories reproduced
the "Per-category sitelink fame-tier floors" ticket's population column
**exactly** (40/16/2/7/11/5/1/3/6) — a strong live cross-check that both
that ticket's numbers and this file's are sound, not an artifact of query
construction. A second, independent check — pulling the full
`?item ?itemLabel ?sitelinks ?image` row list per category and de-duplicating
in Python — reproduced the identical per-category totals a third way (see
§1 table; script logic in "Sources" below).

### 0.3 Licensing query — full corpus, not a sample

The ticket asked for "a representative subset." Given the total imaged
population across all 9 categories at floor 70 is only **89 items**, this
research ran the Commons `imageinfo`/`extmetadata` licensing check against
**all 89**, not a subset — cheap to do exhaustively (2 batched Commons API
calls of ≤50 titles each, well under the 50-title-per-request unauthenticated
limit `commons-client.ts` already codes to), and it removes all sampling
uncertainty from the licensing-mix figures in §2. One representative
image-bearing file per item was used (the first `?image` binding returned,
matching how `fetch-image-attribution.ts` will resolve exactly one
`imageAttribution` per entity in practice).

```
GET https://commons.wikimedia.org/w/api.php
  ?action=query&prop=imageinfo&iiprop=extmetadata
  &titles=File:<name1>|File:<name2>|...   (up to 50 per request)
  &format=json&formatversion=2
```

(Same endpoint/params `commons-client.ts`'s `fetchCommonsImageInfo` already
uses in production.)

## 1. P18 coverage per category (population = items clearing sitelinks ≥ 70)

| Category | QID | Population | With P18 | Coverage |
|---|---|---|---|---|
| war | Q198 | 40 | 39 | **97.5%** |
| battle | Q178561 | 16 | 16 | **100.0%** |
| siege | Q188055 | 2 | 2 | **100.0%** |
| military-operation | Q645883 | 7 | 6 | **85.7%** |
| revolution | Q10931 | 11 | 11 | **100.0%** |
| rebellion | Q124734 | 5 | 5 | **100.0%** |
| coup-d'état | Q45382 | 1 | 1 | **100.0%** |
| war-of-independence | Q1006311 | 3 | 3 | **100.0%** |
| peace-treaty | Q625298 | 6 | 6 | **100.0%** |
| **Total** | | **91** | **89** | **97.8%** |

Only **two items in the entire specialist-floor population lack a P18
claim**:

- `Q185729` "War on Terrorism" (war, 73 sitelinks) — an abstract/umbrella
  campaign concept rather than a depictable single event; unsurprising it
  has no canonical image.
- `Q138503695` "2026 Iran War" (military-operation, 101 sitelinks) — a
  very recent/ongoing conflict (matches the current date context of this
  research session); Wikidata's item for it is still thin, plausibly
  because no image has been curated onto it yet, not because none exists.

**Note on population vs. the floor-tuning ticket's table**: this file's
population column (40/16/2/7/11/5/1/3/6, total 91) reproduces the "Per-category
sitelink fame-tier floors" ticket's numbers exactly, confirming both are
sound. A handful of items are legitimately classified under **more than one**
`ConflictCategory` at once (e.g. `Q620735` Russo-Georgian War is
`wdt:P31` both `wd:Q198` war and `wd:Q645883` military operation; `Q160077`
Fall of Constantinople is both `battle` and `siege`; `Q33761` Arab Spring is
both `rebellion` and `revolution`) — 7 items are double-counted this way
across the 9 category populations (91 total rows → 84 unique items). This
is expected multi-instance-of modeling on Wikidata's side, not a query bug:
each of the 9 per-category fetch queries will independently pick up such an
item, exactly as `historical-events.ts`'s current single shared query
already does today for any item matching more than one class in its
`EVENT_TYPES` list.

## 2. Licensing mix

### 2.1 Per category (allowing the cross-category overlap noted above — 89 rows, matching §1's "With P18" column)

| Category | Imaged items | Attribution required | PD / no attribution required |
|---|---|---|---|
| war | 39 | 19 (48.7%) | 20 (51.3%) |
| battle | 16 | 3 (18.8%) | 13 (81.3%) |
| siege | 2 | 1 (50.0%) | 1 (50.0%) |
| military-operation | 6 | 3 (50.0%) | 3 (50.0%) |
| revolution | 11 | 2 (18.2%) | 9 (81.8%) |
| rebellion | 5 | 2 (40.0%) | 3 (60.0%) |
| coup-d'état | 1 | 1 (100.0%) | 0 (0.0%) |
| war-of-independence | 3 | 0 (0.0%) | 3 (100.0%) |
| peace-treaty | 6 | 1 (16.7%) | 5 (83.3%) |
| **Total (with overlap)** | **89** | **32 (36.0%)** | **57 (64.0%)** |

### 2.2 License breakdown, unique items (84 — collapsing the 7 double-classified items to one row each)

| `LicenseShortName` | Count | % |
|---|---|---|
| Public domain | 55 | 65.5% |
| CC BY-SA 3.0 | 9 | 10.7% |
| CC BY-SA 4.0 | 7 | 8.3% |
| CC BY 4.0 | 5 | 6.0% |
| CC BY-SA 3.0 de | 2 | 2.4% |
| CC BY 2.0 | 2 | 2.4% |
| CC BY 3.0 | 1 | 1.2% |
| CC BY-SA 2.0 | 1 | 1.2% |
| CC BY-SA 2.5 | 1 | 1.2% |
| GFDL | 1 | 1.2% |

**PD/no-attribution: 65.5%. Some CC variant requiring attribution: 34.5%.**
Directionally close to the People/Discoveries precedent's small 5-file spot
check (60% PD / 40% CC there), but the *composition* of the CC-requiring
34.5% skews meaningfully differently, and unevenly across categories — see
below.

### 2.3 Does Wars & Conflicts skew differently from People/Discoveries? Yes — three distinct patterns, not one

The ticket specifically asked to flag whether modern-conflict press
photography changes the picture. It does, but the full attribution-required
list (reproduced below in full, since the population is small enough to
just show all of it) reveals **three separate mechanisms**, not the single
"living photographer" pattern People/Discoveries showed:

```
[battle]              Q151340  Battle of France                          CC BY-SA 3.0 de
[battle]               Q154182  Battle of Berlin                          CC BY-SA 3.0 de
[battle]               Q130861  Battle of Kursk                           CC BY 4.0
[coup-d'état]          Q15224558 Euromaidan                               CC BY 2.0
[peace-treaty]         Q46362   Congress of Vienna                        CC BY-SA 4.0
[rebellion]            Q164348  Hungarian Revolution of 1956              CC BY 4.0
[rebellion]            Q104705419 January 6 US Capitol attack             CC BY 2.0
[revolution]           Q126065  Iranian Revolution                        GFDL
[revolution]           Q180548  neolithic revolution                      CC BY-SA 3.0
[siege]                Q151860  Siege of Leningrad                        CC BY-SA 3.0
[war]                  Q110999040 full-scale Russo-Ukrainian war          CC BY-SA 4.0
[war]                  Q122962941 Gaza War                                CC BY-SA 3.0
[war]                  Q15860072 Russo-Ukrainian war                      CC BY 4.0
[war]                  Q545449  Iraq War                                  CC BY-SA 3.0
[war]                  Q83085   Soviet-Afghan War                         CC BY-SA 4.0
[war]                  Q33143   Seven Years' War                          CC BY 3.0
[war]                  Q49100   Yom Kippur War                            CC BY-SA 3.0
[war]                  Q170314  Second Sino-Japanese War                  CC BY-SA 3.0
[war]                  Q182865  War in Afghanistan (2001-2021)            CC BY-SA 3.0
[war]                  Q620735  Russo-Georgian War                        CC BY-SA 3.0
[war]                  Q127751  Wars of the Roses                         CC BY-SA 4.0
[war]                  Q33745   Peloponnesian War                         CC BY-SA 4.0
[war]                  Q179250  French invasion of Russia                 CC BY-SA 4.0
[war]                  Q29269   First Chechen War                        CC BY-SA 4.0
[war]                  Q134900605 Twelve-Day War                          CC BY 4.0
[war]                  Q6271    Second Punic War                          CC BY-SA 4.0
[war]                  Q49104   2006 Lebanon War                          CC BY-SA 2.0
[war]                  Q190029  Kosovo War                                CC BY-SA 2.5
[war]                  Q99659280 Second Nagorno-Karabakh War               CC BY 4.0
```

1. **Modern press/user photography of a modern conflict** — the pattern
   People/Discoveries also showed, just far more concentrated here: Gaza
   War, both Russo-Ukrainian-war items, Iraq War, Soviet-Afghan War, War in
   Afghanistan (2001-2021), Russo-Georgian War, First Chechen War,
   Twelve-Day War, 2006 Lebanon War, Kosovo War, Second Nagorno-Karabakh
   War, Euromaidan, January 6 Capitol attack, Hungarian Revolution of 1956.
   This alone is 15 of the 29 attribution-required items and is the
   headline finding: **`war`'s attribution-required rate (48.7%) is roughly
   2.5-4x every other category's** (battle 18.8%, revolution 18.2%,
   peace-treaty 16.7%), driven almost entirely by the post-1990 conflicts
   that dominate the top of `war`'s specialist-floor population (the
   ongoing Russo-Ukrainian war alone appears twice, once per its two
   distinct Wikidata items).
2. **Institutional-archive donations, not "a photographer"** — `Battle of
   France`, `Battle of Berlin`, `Battle of Kursk` are all `CC BY-SA 3.0 de`,
   the license the German Federal Archive (Bundesarchiv) used for its bulk
   donation of WWII-era photographs to Commons. These are *historical*
   subjects (1940s) but carry a *modern* institutional CC license with a
   mandated attribution format ("Bundesarchiv, Bild [ID]") — a distinct
   attribution shape from a byline credit, worth knowing about if
   `imageAttribution` string construction ever special-cases `Artist` vs.
   `Credit` fields.
3. **A modern Commons contributor's cartography of an old event** — Second
   Punic War, Peloponnesian War, Seven Years' War, Wars of the Roses,
   French invasion of Russia, Congress of Vienna, and the Siege of
   Leningrad's map are all CC BY-SA because the *artifact* (a war-progress
   map, campaign diagram, or collage assembled by a Commons volunteer) is
   itself a recent original work, even though the depicted conflict is
   centuries old. The event's age doesn't predict the image's license —
   the image's *authorship* does.

Net: People/Discoveries' framing ("older subjects → PD portraiture, modern
subjects → CC press photos") only explains pattern (1) here. Wars &
Conflicts adds two more CC-attribution sources that have nothing to do with
the subject's era, both because Wars items more often illustrate with maps/
diagrams/collages rather than a single period portrait. The practical
consequence for this app is the same either way — `imageAttribution` needs
to be populated whenever `AttributionRequired` is `true`, regardless of
which of the three patterns produced it, exactly per the already-shipped
People/Discoveries dynamic-tooltips spec §4.2 mechanism, no new logic
needed.

## 3. Recommended wiring

**Extend the 9 per-category SPARQL queries directly with `OPTIONAL { ?event wdt:P18 ?image }`
(and `?image` in the `SELECT` line) — same treatment `events-enrichment.ts`
already gives P18 for Discoveries, and the cheapest of the two options the
ticket raised.** No standalone pass is warranted for the image *URI* itself.

This is actually a slightly cleaner fit for Wars than it was for
People/Discoveries, not just an equally-cheap option:

- People (`descriptions.ts`) and Discoveries (`events-enrichment.ts`) both
  needed P18 added to a **second, separate enrichment query** because their
  candidate ID lists come from somewhere else first (Pantheon CSV row scan;
  the checked-in curated JSON list) — the base "which QIDs exist" step and
  the "what sitelinks/description/image does this QID have" step are two
  different fetch passes for those lanes.
- Wars has no such split today, and the "Split fetch into per-category
  queries" effort's replacement (9 type-specific queries) doesn't introduce
  one either — each per-category query **is** the primary candidate-discovery
  pass (`?event wdt:P31 wd:${qid}`) *and* already inlines several
  `OPTIONAL` enrichment clauses in the same query (`?country`, `?article`,
  `?description`, `?partOfLabel`, per `historical-events.ts`'s existing
  shape). Adding `OPTIONAL { ?event wdt:P18 ?image }` is one more line in a
  query that already does exactly this kind of inline enrichment — not a
  new architectural pattern, and not a new HTTP request per candidate
  batch (P18 rides along in the same `VALUES`/direct-`wdt:P31` request that
  already fetches everything else for that category).

**A standalone pass is still needed for `imageAttribution`** — but this
already exists and just needs a third input. `fetch-image-attribution.ts`
(`packages/data-pipeline/src/fetch/fetch-image-attribution.ts`) already
runs a second, distinct Commons `imageinfo` pass **after** the SPARQL fetch
stage, generically keyed as `{ people: {...}, discoveries: {...} }`, reading
`people-descriptions.raw.json` and `events-curated-enriched.raw.json` off
disk and calling the shared `batchedCommonsImageAttributionFetch` helper
(`batched-commons-image-attribution-fetch.ts`) once per lane. Wiring Wars in
is additive, not new machinery:

1. Each of the 9 per-category raw output files gains an `id`+`image` pair
   for every item that resolved a P18 image (same shape
   `events-curated-enriched.raw.json` already has for Discoveries).
2. `fetch-image-attribution.ts` gains a third `warsEntries` derivation
   (read the 9 raw files, collect `{id, imageUri}` pairs the same way
   `discoveryEntries` is built today), a third
   `batchedCommonsImageAttributionFetch(warsEntries)` call, and a `wars`
   key alongside `people`/`discoveries` in `image-attribution.raw.json`'s
   output shape.
3. `fetch/index.ts`'s ordering just needs `fetchImageAttribution()` to keep
   running after the (now 9, currently 1) Wars fetch step(s) finish writing
   their raw files — same "depends on raw output already on disk" ordering
   constraint that already governs its position relative to
   `fetchDescriptions`/`fetchEventsEnrichment` today.

Volume-wise this is cheap: 89 imaged items across all of Wars & Conflicts
(§1) is a fraction of Discoveries' 121 or People's 3,672 — two Commons API
batches (≤50 titles each) cover the entire lane's attribution needs, well
inside `commons-client.ts`'s existing per-request title limit and retry
handling.

## Sources

- `https://query.wikidata.org/sparql` — live SPARQL P18-coverage
  (`COUNT(DISTINCT ...)`, §0.2) and full item-list queries, all 9
  `ConflictCategory` QIDs, run 2026-08-08.
- `https://commons.wikimedia.org/w/api.php`
  (`action=query&prop=imageinfo&iiprop=extmetadata&formatversion=2`) — live
  per-file license/attribution metadata for all 84 unique imaged items
  across the 9 categories' specialist-floor populations, run 2026-08-08 (2
  batched requests, ≤50 titles each).
- Local repo cross-references: `packages/data-pipeline/src/fetch/queries/historical-events.ts`
  (query shape precedent — direct `wdt:P31`, not transitive), `queries/events-enrichment.ts`
  (the exact `OPTIONAL { ?event wdt:P18 ?image }` extension pattern this
  file recommends mirroring), `queries/min-sitelinks.ts`,
  `fetch/fetch-image-attribution.ts`, `fetch/commons-client.ts`,
  `fetch/batched-commons-image-attribution-fetch.ts`, `fetch/index.ts`
  (current pipeline stage ordering).
- `../../dynamic-tooltips/research/image-sourcing.md` — the mechanism
  precedent this file explicitly does not re-derive (Commons
  `Special:FilePath`/`?width=` thumbnailing, licensing/attribution
  obligations, `imageinfo` API shape).
- `../issues/01-per-category-sitelink-floors.md` — the specialist floor
  (70 sitelinks) this file's population figures are filtered to, and the
  independent population numbers (40/16/2/7/11/5/1/3/6) this file's §1
  reproduces exactly as a live cross-check.
