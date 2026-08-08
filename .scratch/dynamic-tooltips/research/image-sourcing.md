# Image sourcing (Wikidata P18) for tooltips — research findings

Status: answers all questions in `../issues/01-research-image-sourcing.md`.

**Scope note**: Wars & Conflicts (`wars.json`) was excluded from this
research per a mid-flight scope decision recorded in `../map.md` and the
ticket's `## Question`, not because of any technical finding here — it was
still in scope when the P18-coverage queries for Wars were run (see the
git history of this file if that data is ever needed later), but this
write-up reports People and Discoveries only, per that scope call.

All coverage figures below are computed from **live queries against
`https://query.wikidata.org/sparql`** (not a guess, not a secondary
write-up) run against the **full published corpus** of each in-scope lane
(all 3,672 people, all 121 discoveries) — not just the 30–50-item sample
the ticket asked for as a floor. The Commons URL/thumbnail pattern and
licensing findings are confirmed by (a) live behavioral tests against
`commons.wikimedia.org` with `curl`, cross-checked against (b) Commons' own
technical documentation (`Commons:Reusing content outside Wikimedia/
technical`, fetched directly), and (c) live per-file license metadata from
the Commons `imageinfo` API. All commands are reproducible as given.

## 0. Method (for reproducibility)

### 0.1 Recovering the exact `wd_id` per published person

The pipeline's existing reign-period and description enrichment passes
(`packages/data-pipeline/src/fetch/fetch-reigns.ts`,
`packages/data-pipeline/src/fetch/fetch-descriptions.ts`) both:

1. Read `data/raw/people-pantheon.raw.csv` back off disk (the just-downloaded
   Pantheon CSV — the "raw file is the handoff" pattern, per both files'
   own header comments) via `parsePantheonCsv`.
2. Filter to `row.hpi >= MIN_HPI` (`MIN_HPI = 75`,
   `packages/data-pipeline/src/fetch/queries/min-hpi.ts` — "must match
   `FAME_TIER_MIN_HPI.specialist` in `transform/score.ts`").
3. Dedupe `row.wdId` (the CSV's `wd_id` column) into a candidate QID list.
4. Pass that list to `batchedSparqlFetch(personIds, buildXQuery)`
   (`packages/data-pipeline/src/fetch/batched-sparql-fetch.ts`), which runs
   `buildXQuery` (a `VALUES ?person { wd:Q1 wd:Q2 ... }`-clause query, 50
   QIDs per batch, 500 ms courtesy delay between batches) against
   `runSparqlQuery` (`packages/data-pipeline/src/fetch/wikidata-client.ts`,
   `POST https://query.wikidata.org/sparql`, `Accept:
   application/sparql-results+json`, a descriptive `User-Agent`, 429/502-504
   retry with backoff).

This is the "exact mechanism" the ticket asked to find — it is a **batched
VALUES-clause SPARQL pass keyed on Wikidata QID**, run against a
Pantheon-HPI-filtered candidate list, not a corpus scan. `buildReignsQuery`
(`packages/data-pipeline/src/fetch/queries/reigns.ts`) is a direct model for
how any new per-QID People enrichment (including P18) would be shaped.

For this research, rather than re-deriving `wd_id` indirectly (name lookup
via `wbsearchentities`, as the ticket allowed as a fallback), the exact
`wd_id` for **every one of the 3,672 published people** was recovered
directly: `people.json`'s `id` field is Pantheon's `id`/`wp_id` (verified —
see `../../alt-data-sources/research/pantheon-schema.md` §1, "`id` and
`wp_id` are identical for 126,581 of 126,582 rows"), which is also a column
in `people-pantheon.raw.csv`. Joining `people.json[].id` against
`people-pantheon.raw.csv`'s `id` → `wd_id` column recovered a `wd_id` for
**all 3,672** published people with **zero misses**:

```python
import csv, json

id_to_wdid = {}
with open("packages/data-pipeline/data/raw/people-pantheon.raw.csv", newline="", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        id_to_wdid[row["id"]] = row["wd_id"]

people = json.load(open("packages/shared-types/src/data/people.json"))
wdids = [id_to_wdid[p["id"]] for p in people]  # 3672/3672 resolved, 0 missing
```

### 0.2 P18 coverage query shape

Same `VALUES`-clause + `OPTIONAL` pattern as the existing enrichment
queries (`descriptions.ts`, `events-enrichment.ts`), batched 50 QIDs per
request with a courtesy delay, run to completion over the **entire**
candidate list per lane (People: all 3,672 recovered `wd_id`s;
Discoveries: all 121 `discoveries.json` QIDs):

```sparql
SELECT ?person ?image WHERE {
  VALUES ?person { wd:Q91 wd:Q935 ... }   # up to 50 per batch
  OPTIONAL { ?person wdt:P18 ?image . }
}
```

(`?item` in place of `?person` for Discoveries, whose published `id` is
already the QID — no `wd_id` indirection needed for that lane.)

Query script used (`User-Agent: same-sky-research/0.1 (personal project
research; contact sergei.kartin@gmail.com)`, `POST
https://query.wikidata.org/sparql`, `Accept:
application/sparql-results+json`, 0.6 s delay between batches, up to 3
retries per batch on transport error): batches were POSTed with
`urllib.request`, one row of `{qid: bool}` accumulated per unique entity
seen (a `VALUES` row with no `OPTIONAL` match still comes back as a row
with no `image` binding, not a missing row — confirmed by checking that
every requested QID was present as a key in the accumulated result set for
both runs, i.e. `unresolved ids: 0` in every run below).

## 1. P18 coverage per lane (full corpus, not a sample)

| Lane | Corpus size | Entities with a P18 image | Coverage |
|---|---|---|---|
| People (`people.json`) | 3,672 | 3,636 | **99.02%** |
| Discoveries & Inventions (`discoveries.json`) | 121 | 108 | **89.26%** |

Sanity-checked against an independent 40-item random sample (seed 42) per
lane before running the full corpus — sample and full-corpus figures agree
closely (People 40/40 sample vs 99.02% full; Discoveries 36/40 sample vs
89.26% full), so the full-corpus runs aren't an artifact of query
construction.

**What's missing, qualitatively** (inspected the actual missing-name lists,
not just the counts):

- **People** (36 missing, all recovered by name via the CSV join): mostly
  ancient/legendary figures with no surviving portrait tradition — e.g.
  Abdullah ibn Abd al-Muttalib (Muhammad's father), Björn Ironside,
  Hecataeus of Miletus, Apollodorus of Athens, Jordanes — plus a few
  reasonably modern people who simply have no uploaded Commons photo (e.g.
  Gianni Versace, John Holmes). Not a systematic gap tied to lane
  mechanics — an inherent "does a picture of this person exist at all"
  limit.
- **Discoveries & Inventions** (13 missing): almost entirely intangible
  processes/standards/protocols rather than physical objects — Email,
  Penicillin, GSM, TeX, Human Genome Project, Haber-Bosch process,
  Chlorofluorocarbon, Chemical vapor deposition, Fischer-Tropsch process,
  Electrical telegraph, invention of the telephone. (Note: several of
  these, e.g. "invention of the telephone," plausibly *do* have a
  depictable subject on Wikidata under a differently-scoped QID — e.g. a
  specific telephone artifact rather than the abstract invention concept
  the curated list points at; not independently verified per-item here,
  flagged as a possible future per-row P18-fallback opportunity rather
  than a hard "no image exists" wall.)

## 2. Commons URL pattern, thumbnail sizing, and licensing

### 2.1 What a P18 SPARQL binding actually looks like

Confirmed directly from the query results above (not assumed): a `wdt:P18`
value comes back through the SPARQL endpoint as a full **URI**, already in
`Special:FilePath` form, not a bare filename:

```
http://commons.wikimedia.org/wiki/Special:FilePath/Abraham%20Lincoln%20O-77%20matte%20collodion%20print.jpg
http://commons.wikimedia.org/wiki/Special:FilePath/USS%20Constitution%20vs%20Guerriere.jpg
http://commons.wikimedia.org/wiki/Special:FilePath/Floppy%20disk%202009%20G1.jpg
```

(Space-containing filenames come back `%20`-encoded, non-`https`
protocol-relative `http://` — worth normalizing to `https://` on write,
though `http://` does 301-redirect to `https://` in practice, confirmed by
the redirect chain in §2.2.)

### 2.2 Requesting a small thumbnail — confirmed live, not from docs alone

Commons' own technical guidance page,
`https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia/technical`
(fetched directly), states verbatim under "Hotlinking":

> "How to hotlink: use the special page Special:FilePath. You can link
> directly with
> `https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/Sample.png&width=300`
> you can omit the `&width=` parameter for the full resolution."

This was independently confirmed by direct `curl` tests against the exact
`Special:FilePath` URI a live P18 query returned
(`Abraham Lincoln O-77 matte collodion print.jpg`), appending `?width=`:

```
curl -sL -D - -o out.jpg \
  "https://commons.wikimedia.org/wiki/Special:FilePath/Abraham%20Lincoln%20O-77%20matte%20collodion%20print.jpg?width=200"
```

Redirect chain observed: `Special:FilePath/...?width=200` → 302 →
`Special:Redirect/file/...&width=200` → 301 →
`upload.wikimedia.org/.../thumb/.../250px-....jpg` → 200 `image/jpeg`
(19,228 bytes, `250x322px`), versus 3,898,023 bytes / full original size
with no `width=` param at all — so `?width=` **can be appended directly to
the exact URI the P18 SPARQL binding already returns**, no URL
reconstruction needed.

**Caveat found only by testing, not documented**: the returned width
snaps up to a nearby served bucket rather than matching the requested
value exactly:

| Requested `width=` | Actual thumbnail width returned |
|---|---|
| 100 | 120px |
| 137 | 250px |
| 200 | 250px |
| 400 | 500px |

Treat `width=` as "no wider than roughly this, rounded up to the nearest
cached bucket," not an exact-pixel guarantee — fine for a tooltip thumbnail
slot sized with `max-width`/`object-fit`, not something to rely on for an
exact-pixel layout.

### 2.3 Licensing and attribution

Same technical page, "Hotlinking" section, verbatim:

> "Hotlinking is *allowed* from Wikimedia servers, but is *not generally
> recommended*: this is because anyone could change, vandalise, rename or
> delete a hotlinked image. On your own server, you will have control over
> what is served."
>
> "If you *do* hotlink, then it is still necessary to follow the licensing
> conditions... including (if the license requires it) providing
> attribution as specified by the content creator. Ignoring the licenses
> could be a copyright infringement, regardless of whether you hotlink or
> use a copy of the file from your own server."

So: hotlinking itself is permitted (not a Commons policy violation), but
carries two distinct obligations for this app:

1. **A stability risk, not a legal one**: a hotlinked file can be renamed,
   replaced, or deleted upstream at any time, with no notice to this app —
   relevant to "no runtime data fetching" only in that the *URL string* is
   static-baked, but the *bytes* it points to are not under this app's
   control and can silently 404 or change later. (The map's existing
   decision — "no image available → omit the image slot entirely" —
   already covers the load-failure case at the `<img>` level; nothing new
   needed there.)
2. **A real per-file licensing obligation**: Commons' own reuse guide
   (`https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia`,
   fetched directly) states "Almost all images and other media on
   Wikimedia Commons are under some kind of free license (usually CC BY,
   CC BY-SA, or GFDL...) or in the public domain" and "If attribution is
   required, provide attribution... If the copyright holder has not
   specified how to attribute... see Commons:Credit line."

**License mix is real, not hypothetical** — confirmed live via the Commons
`imageinfo` API (`iiprop=extmetadata`) on 5 of the sampled files:

| File | `LicenseShortName` | `AttributionRequired` |
|---|---|---|
| Abraham Lincoln O-77 matte collodion print.jpg | Public domain | false |
| USS Constitution vs Guerriere.jpg | Public domain | false |
| Floppy disk 2009 G1.jpg | Public domain | false |
| Ben Affleck on the Red Carpet, SXSW 2023 (cropped).jpg | CC BY-SA 4.0 | **true** |
| Ali Khamenei Nowruz message official portrait 1397 02.jpg | CC BY 4.0 | **true** |

```
curl -A "$UA" "https://commons.wikimedia.org/w/api.php?action=query&titles=File:Ben%20Affleck%20on%20the%20Red%20Carpet%2C%20SXSW%202023%20%28cropped%29.jpg&prop=imageinfo&iiprop=extmetadata&format=json"
```

Practical implication: many older/historical subjects hit public-domain
images (no attribution obligation), but plenty of modern people (living
politicians, actors) resolve to CC BY/CC BY-SA images that **do** require
attribution — this app cannot treat "hotlink and forget" as universally
safe. Two workable paths, not resolved here (a spec/scope decision, not a
research one):
  - Fetch-time: pull `extmetadata` (`LicenseShortName`, `AttributionRequired`,
    `Artist`, `Credit`) alongside `P18` and store enough to render a credit
    line when required — heavier pipeline change, exact compliance.
  - Ship-time editorial call: since People/Discoveries here skew
    historical (the "no attribution needed, public domain" bucket
    dominates for pre-20th-century subjects per the sample above), scope
    could restrict tooltip images to CC0/PD-only, at the cost of dropping
    the living/modern subset that resolves to CC BY(-SA). Not evaluated
    quantitatively here — would need a full-corpus `extmetadata` pass to
    size that tradeoff, out of this ticket's scope.

## 3. Recommended data shape and pipeline wiring

### 3.1 Field shape

Add `image?: string` to `TimelineEntry`
(`packages/shared-types/src/index.ts:135-141`), stored as the **raw
`Special:FilePath` URI exactly as SPARQL returns it** (no width baked in at
fetch time) — same convention `wikipediaUrl` already uses on the same
interface (store the full URL verbatim, no pipeline-side transformation).
Absent means no P18 claim, matching the map's already-settled "no image
available → omit the image slot entirely, no placeholder" decision. The
frontend appends `?width=<n>` at render time (per §2.2, this is a plain
string-append onto the stored URL, not a URL rebuild) — keeps the pixel
size a frontend/CSS concern, not a pipeline one, consistent with images
being explicitly exempted from the "no runtime data fetching" principle in
`map.md`'s Notes (the URL is static-baked; only the byte fetch is lazy).

### 3.2 Fetch-stage wiring, per lane

Mirroring the existing description/reigns/events-enrichment pattern found
in §0.1, per lane:

- **Discoveries** (`fetch-events-enrichment.ts` /
  `queries/events-enrichment.ts`): cheapest option — this pass already runs
  a batched `VALUES`-clause query per curated QID for `sitelinks`/
  `article`/`country`. Add `OPTIONAL { ?event wdt:P18 ?image . }` and
  `?image` to the `SELECT` line in `buildEventsEnrichmentQuery`, and thread
  `image` through `EnrichmentFields`/`EnrichedEvent` the same way
  `wikipediaUrl` already is. No new fetch pass, no new raw file — same
  request count as today.
- **People** (`fetch-descriptions.ts` / `queries/descriptions.ts`, or a new
  dedicated pass): two options, both batched on the same `wd_id` list
  `fetch-reigns.ts`/`fetch-descriptions.ts` already build (§0.1):
  - **Cheapest**: extend `buildDescriptionsQuery` with
    `OPTIONAL { ?person wdt:P18 ?image . }` / `?image` in the `SELECT` —
    same request count as today, since descriptions and P18 are both
    single-valued OPTIONAL claims on the same already-queried `?person`.
  - **Alternative** (closer to "a new Fetch-stage SPARQL pass" as the
    ticket's question phrased it): a standalone `queries/images.ts` /
    `fetch-images.ts`, same shape as `fetch-reigns.ts` (reads
    `people-pantheon.raw.csv` back off disk, filters `hpi >= MIN_HPI`,
    calls `batchedSparqlFetch`, writes `data/raw/people-images.raw.json`).
    Worth it only if the team wants P18 fetching decoupled from
    descriptions for independent retry/scheduling — otherwise it doubles
    the request count for no benefit over extending the existing query.

Either way, `write-datasets.ts`'s `buildPeople`/`buildWars`/`buildDiscoveries`
(`packages/data-pipeline/src/output/write-datasets.ts`) each already thread
an optional-field lookup map through the row → `TimelineEntry` mapping
(`reignsByPersonId` for `Person`, `EnrichedEvent.wikipediaUrl` for
Discoveries) — adding `image` follows the identical shape, no new pattern
needed there.

## Sources

- `https://query.wikidata.org/sparql` — live SPARQL P18-coverage queries,
  full corpus per in-scope lane (3,672 people via recovered `wd_id`, 121
  discoveries), run 2026-08-08
- `https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia/technical` —
  "Hotlinking" section: `Special:FilePath`/`Special:Redirect/file/...&width=`
  pattern, hotlinking-allowed-but-not-recommended stance, licensing
  obligations even when hotlinking (fetched directly, exact quotes above)
- `https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia` —
  license mix (CC BY / CC BY-SA / GFDL / public domain) and attribution/
  credit-line guidance (fetched directly)
- `https://commons.wikimedia.org/w/api.php` (`action=query&prop=imageinfo&iiprop=extmetadata`) —
  live per-file license/attribution metadata for 5 sampled Commons files
- `https://commons.wikimedia.org/wiki/Special:FilePath/...` (direct `curl`
  tests, with and without `?width=`) — confirmed redirect chain
  (`Special:FilePath` → `Special:Redirect/file/...` →
  `upload.wikimedia.org/.../thumb/...`), confirmed thumbnail-width bucket-
  snapping behavior, confirmed file-size delta (19 KB thumbnail vs 3.9 MB
  original for the same file)
- Local repo cross-references: `packages/data-pipeline/src/fetch/fetch-reigns.ts`,
  `fetch-descriptions.ts`, `fetch-events-enrichment.ts`, `queries/reigns.ts`,
  `queries/descriptions.ts`, `queries/events-enrichment.ts`,
  `batched-sparql-fetch.ts`, `wikidata-client.ts`,
  `packages/data-pipeline/src/output/write-datasets.ts`,
  `packages/data-pipeline/data/raw/people-pantheon.raw.csv`,
  `packages/shared-types/src/index.ts`,
  `.scratch/alt-data-sources/research/pantheon-schema.md` (for the
  `id`==`wp_id` fact this research's `wd_id` join relies on)
