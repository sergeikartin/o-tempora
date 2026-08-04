# Pantheon 2.0 dataset schema — research findings

Status: answers all four questions in `../issues/05-research-pantheon-schema.md`.

All claims below are backed by either (a) direct inspection of the actual
downloaded dataset file, or (b) Pantheon's own site pages (fetched with
`curl`, not a secondary write-up). Commands are reproducible; file hashes
are included so the exact bytes inspected can be verified later even if the
upstream file changes.

## 0. Method (for reproducibility)

```
curl -sL -A "Mozilla/5.0" -o datasets_page.html https://pantheon.world/data/datasets
curl -sL -A "Mozilla/5.0" -o person_2025_update.csv.bz2 \
  https://storage.googleapis.com/pantheon-public-data/person_2025_update.csv.bz2
```

- `datasets_page.html` (23,184 bytes) — Pantheon's download page. It's a
  Next.js app; the useful content ships as inline React Server Component
  JSON in a `<script>` tag, not as plain HTML, which is why a naive
  WebFetch/markdown-conversion of this page previously returned only the
  page title with no schema detail. Grepping the raw HTML for the RSC
  payload (`self.__next_f.push(...)`) recovers the actual download links,
  descriptions, and license text.
- `person_2025_update.csv.bz2` — downloaded directly, no login/API key/cookie
  needed (see §4). Server: `storage.googleapis.com` (public GCS bucket),
  `HTTP/2 200`, `content-type: application/octet-stream`,
  `last-modified: Fri, 25 Jul 2025 16:32:13 GMT`, `content-length: 12354476`.
  - `sha256(person_2025_update.csv.bz2) = 11962cce36e2928fbf868b4b1b686bfc9abe7a72b9ded49e35ea4d50b432c662`
  - Decompressed with Python's `bz2` module (no `bunzip2` binary on this
    machine) to `person_2025_update.csv`, 38,865,070 bytes, 126,583 lines.
  - `sha256(person_2025_update.csv) = b456892981289ba916cad10d8eaa23b4ffd93db94425be3acb04fd73baea2de7`
- All record-level stats below were computed with Python's `csv.DictReader`
  over every one of the 126,582 data rows (not a sample), on 2026-08-03.

## 1. Exact field list

Header row of `person_2025_update.csv` (34 columns, comma-delimited,
double-quoted):

```
"id","wd_id","wp_id","slug","name","occupation","prob_ratio","gender",
"twitter","alive","l","hpi_raw","bplace_name","bplace_lat","bplace_lon",
"bplace_geonameid","bplace_country","birthdate","birthyear","dplace_name",
"dplace_lat","dplace_lon","dplace_geonameid","dplace_country","deathdate",
"deathyear","bplace_geacron_name","dplace_geacron_name","is_group","l_",
"age","non_en_page_views","coefficient_of_variation","hpi"
```

Sample row (Isaac Newton) with every field populated, for concrete shape:

```
id=14627, wd_id=Q935, wp_id=14627, slug=Isaac_Newton, name=Isaac Newton,
occupation=PHYSICIST, prob_ratio=0, gender=M, twitter='', alive=FALSE,
l=235, hpi_raw=35.48016419061497,
bplace_name=Woolsthorpe-by-Colsterworth, bplace_lat=52.809863,
bplace_lon=-0.62877, bplace_geonameid=201088, bplace_country=United Kingdom,
birthdate=1643-01-04, birthyear=1643,
dplace_name=Kensington, dplace_lat=51.5, dplace_lon=-0.19,
dplace_geonameid=54732, dplace_country=United Kingdom,
deathdate=1727-03-31, deathyear=1726,
bplace_geacron_name=woolsthorpe-by-colsterworth,
dplace_geacron_name=kensington, is_group=FALSE,
l_=30.988774869925628, age=83, non_en_page_views=2508822,
coefficient_of_variation=3.7821597382938283, hpi=99.439201
```

### HPI (fame/popularity field)

- **Field name is `hpi`** (0–100 scale, final/published metric). There is
  also **`hpi_raw`**, an unbounded pre-rescaling score (observed range in
  this file: 0.0 to 35.68) — `hpi` looks like a rescaling of `hpi_raw` onto
  a 0–100 range (not a simple linear rescale of the *whole* raw range,
  since raw tops out at 35.68 but `hpi` reaches exactly 100 for the single
  top row, Muhammad). **Use `hpi`, not `hpi_raw`**, for anything scale-
  sensitive — `hpi_raw` is not usable on its own as a 0–100 metric.
- Per Pantheon's own FAQ (https://pantheon.world/data/faq, "What is HPI?"):
  "HPI is currently made of five components: the 'age' of a biography's
  character..., number of Wikipedia language editions in which the
  biography has a presence (L), the concentration of the pageviews received
  by a biography across languages (L\*), the stability of pageviews over
  time (CV), and the number of non-English pageviews received by that
  biography." These map directly onto other CSV columns: `age`, `l` (L),
  `l_` (L\*), `coefficient_of_variation` (CV), `non_en_page_views`. No
  closed-form formula for combining them is published (Pantheon calls HPI
  "a simple ad-hoc metric").
- **Distribution** (computed over all 126,582 rows, `hpi` field):
  - min 0.0, max 100.0, mean 51.96, 420 rows exactly at `hpi=0`.
  - Percentiles: p50=54.03, p75=61.32, p90=67.81, p95=72.18, p99=80.45,
    p99.9=89.52.
  - **Counts at the ticket's proposed floors**: `hpi >= 90` → **108** people;
    `hpi >= 85` → **423** people; `hpi >= 75` → **3,840** people (out of
    126,582, i.e. top 0.09% / 0.33% / 3.03% respectively). This directly
    answers the "confirm against real data" ask in `03-fame-tier-hpi-
    thresholds.md`: the 90/85/75 floors are usable as-is (they land at
    sane, tightly-nested cutoffs — 108 ⊂ 423 ⊂ 3,840 by construction, same
    nesting property the current sitelink tiers rely on) but the effective
    corpus is small at the top: 108 people at the `generalPublic`-equivalent
    floor.

### Occupation / domain field

- **Single flat field: `occupation`** (e.g. `PHYSICIST`, `SOCCER PLAYER`,
  `POLITICIAN`). All-caps, one value per person, no leading/trailing
  hierarchy field (no `domain`/`industry` columns in this file).
  102 distinct values total (101 real categories + empty string, 62 rows
  have `occupation=''`).
- Top categories by count: SOCCER PLAYER (21,664), POLITICIAN (19,539),
  ACTOR (13,612), ATHLETE (12,220), WRITER (7,304), SINGER (4,402),
  MUSICIAN (3,183), RELIGIOUS FIGURE (3,090), MILITARY PERSONNEL (2,063),
  FILM DIRECTOR (2,041). Full list obtained; smallest non-empty categories
  have single-digit counts (e.g. `GO PLAYER`=2, `BULLFIGHTER`=2).
- **Note on taxonomy hierarchy**: Pantheon's own 2016 data descriptor paper
  for **Pantheon 1.0** (Yu et al., *Scientific Data* 2:150075,
  https://arxiv.org/abs/1502.07310 / https://www.nature.com/articles/sdata201575)
  states that dataset had "a taxonomy of occupations classifying each
  biography at three levels of aggregation" (i.e. domain → industry →
  occupation). **That 3-level structure is not present in the 2025 Pantheon
  2.0 CSV export actually downloaded** — only the flat `occupation` leaf
  survives in this file. Anyone relying on a domain/industry grouping will
  need to build their own mapping from the 101 `occupation` values (this
  app's existing `Category` enum, `packages/shared-types/src/index.ts:6-15`,
  has only 8 values — `science, politics, art, philosophy, war, invention,
  exploration, religion` — and no "sports" bucket, despite sports
  occupations being a very large share of Pantheon rows by volume: SOCCER
  PLAYER + ATHLETE alone are ~34k rows... a mapping table will be needed
  regardless).

### Region / country / nationality field(s)

- **`bplace_country`** and **`dplace_country`** (birth-place and
  death-place country, free-text country names, e.g. `United Kingdom`,
  `Saudi Arabia`, `Bahamas, The`). 233 distinct non-empty `bplace_country`
  values observed. The `Bahamas, The`-style formatting (definite article
  suffixed) indicates these names come from a gazetteer/World-Bank-style
  country list, **not** ISO 3166 short names or Wikidata's own country
  labels — a normalization/mapping step will be needed to fit the existing
  `Region` enum (`europe, east-asia, south-asia, middle-east, africa,
  americas`, `packages/shared-types/src/index.ts:19-26`).
- Also present: `bplace_name`/`dplace_name` (city/place name),
  `bplace_lat`/`bplace_lon`/`dplace_lat`/`dplace_lon` (coordinates),
  `bplace_geonameid`/`dplace_geonameid` (GeoNames IDs), and
  `bplace_geacron_name`/`dplace_geacron_name` (slugs for Pantheon's own
  historical-map integration with geacron.com).
- **Important caveat, stated by Pantheon itself** (FAQ,
  https://pantheon.world/data/faq, "How was the data from Pantheon
  collected?"): "Johnny 5 maps locations to latitudes and longitudes and
  clusters them... This classification and aggregation uses **present day
  geographical boundaries** (Pantheon does not have information on the
  **nationality** of people, but on **geographical location** where they
  were born)." So `bplace_country`/`dplace_country` are modern-day country
  of the birth/death coordinates, not historical nationality/citizenship —
  relevant if region tagging is meant to reflect the polity a historical
  person actually belonged to (e.g. a person born in what's now Germany in
  a year when it was Prussia, France, or the HRE will show
  `bplace_country=Germany`).
- There is no separate `gender`/`nationality`/`ethnicity` field beyond
  `gender` (`M`/`F`/empty — no other values observed).

### Birth/death date fields and precision

- **`birthdate`** and **`deathdate`**: full ISO-like dates when known —
  format `YYYY-MM-DD`, zero-padded to 4-digit year, e.g. `1643-01-04`
  (Newton) — **plus a ` BC` suffix for BCE dates**, e.g.
  `0069-01-13 BC` (Cleopatra's birth), `0399-02-15 BC` (Socrates' death).
  This is **not** ISO 8601 (`-0068-01-13` for 69 BC) and is **not**
  directly `Temporal.PlainDate`-parseable — the ` BC` suffix and the
  "year 0 = ?" convention need a small adapter (subtract 1 and negate per
  the astronomical-year convention this app already uses, per
  `packages/shared-types/src/index.ts:33`: "BCE years are negative, matching
  Temporal.PlainDate's ISO calendar convention").
  - Full-date coverage (`birthdate` field): 119,194 rows (94.2%) have a
    full `YYYY-MM-DD`(-or-BC) date; 5,886 rows (4.6%) have `birthdate=''`
    (empty — year-only known); 1,502 rows (1.2%) are BC dates. 0 rows had
    an unrecognized format in this scan.
  - **`birthyear`** and **`deathyear`** are separate plain-integer fields,
    always populated when the person's birth/death year is known at all
    (negative for BCE, e.g. `birthyear=-566` for Buddha), independent of
    whether the full `birthdate`/`deathdate` string is present. This maps
    directly onto this app's existing `Person.birthYear`/`deathYear`
    integer fields (`packages/shared-types/src/index.ts:39-40`, which are
    deliberately plain integers, not `Temporal.PlainDate`, "since source
    data is frequently only certain to the year").
  - Full corpus range: `birthyear` from **-4000 to 2021**; `deathyear` from
    **-4000 to 2030** (the 2030 max is presumably a placeholder/estimated
    value for a living or recently-classified person rather than a real
    future death — not independently verified against a specific row).
  - `alive` field (`TRUE`/`FALSE`): 69,926 of 126,582 rows (55%) are marked
    alive.

### Office/tenure/reign field (for `Person.reignPeriods`)

- **No such field exists** in the Pantheon 2025 CSV. There is nothing
  resembling a position-held / office / reign-start / reign-end column.
- **However — important finding not anticipated by the ticket background**:
  the CSV **retains a `wd_id` column populated for every single row**
  (126,582/126,582, 0 missing) — Pantheon still stores each person's
  Wikidata QID (e.g. `wd_id=Q935` for Newton, `Q9458` for Muhammad). The
  ticket's stated background ("losing the Wikidata QID is acceptable")
  appears to assume the QID would disappear entirely on this switch, but it
  does not — Pantheon just doesn't use it as the primary key (`id`/`wp_id`,
  the Wikipedia page ID, plays that role instead).
- Practical implication for `Person.reignPeriods`
  (`packages/data-pipeline/fetch/queries/reigns.ts`, which today runs a
  targeted SPARQL query keyed on a batch of Wikidata Q-IDs, using the
  `P39`/`P580`/`P582` "position held" statement model): that query
  mechanism could **still run unmodified** against `wd_id` values sourced
  from Pantheon rows, since it already takes a list of Q-IDs as input and
  doesn't depend on Wikidata being the primary source for anything else.
  This means `reignPeriods` is not automatically lost by the Pantheon
  switch — it becomes an optional secondary enrichment pass keyed on
  `wd_id`, not a feature that has to be dropped. (This is a factual
  correction to flag back against the ticket's framing, not an
  implementation decision — that's for a follow-up ticket.)

### Other fields present but not asked about

- `slug` (Wikipedia article slug), `name`, `twitter` (handle, 22,881/126,582
  populated — a Twitter/X presence field, empty for most historical
  figures), `prob_ratio` (mostly non-empty numeric, meaning undocumented on
  the site — likely an occupation-classifier confidence/probability ratio
  from the "Johnny 5" classifier described in the FAQ), `is_group` — present
  in the header but **0 of 126,582 rows are `TRUE`** in this file, so it's
  effectively unused/vestigial in the 2025 export.
- `id` and `wp_id` are identical for 126,581 of 126,582 rows (1 mismatch
  observed, not investigated further) — `id` looks like it's just `wp_id`
  (Wikipedia page ID) copied into a generic primary-key column.

## 2. Record count and time period covered

- **126,582 person rows** in `person_2025_update.csv` (126,583 lines
  including the header). Pantheon's own FAQ page
  (https://pantheon.world/data/faq) advertises "more than 70k biographies"
  as of whenever that FAQ copy was last written — the actual 2025 file is
  noticeably larger than that marketing figure, so the FAQ text is stale
  relative to the file itself; trust the file, not the FAQ prose, for the
  current count.
- **Time period**: `birthyear` spans **-4000 to 2021** (i.e. ~4000 BCE to
  2021 CE); `deathyear` spans **-4000 to 2030**. Inclusion criterion per the
  FAQ: a Wikidata "biography"-type entity with a presence in **more than 15
  language editions of Wikipedia** (this 15-language threshold is
  Pantheon 2.0's criterion; Pantheon 1.0 used a stricter >25-language
  threshold per the arXiv abstract, https://arxiv.org/abs/1502.07310).

## 3. License and attribution

Primary source: https://pantheon.world/data/permissions (fetched directly;
same RSC-payload extraction method as §0).

Exact page text:

> If you use the Pantheon dataset, please cite: Yu, A. Z., et al. (2016).
> Pantheon 1.0, a manually verified dataset of globally famous biographies.
> *Scientific Data* 2:150075. doi: 10.1038/sdata.2015.75
>
> Pantheon by [Datawheel](https://datawheel.us/) is licensed under a
> [Creative Commons Attribution-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-sa/4.0/).

- **Exact license: CC BY-SA 4.0** (Attribution-ShareAlike), confirmed via
  the `<a href="https://creativecommons.org/licenses/by-sa/4.0/">` link and
  the CC badge image reference (`i.creativecommons.org/l/by-sa/4.0/88x31.png`)
  embedded in the page's own markup — not inferred from a summary.
- **Attribution requirement**: cite the Yu et al. 2016 *Scientific Data*
  paper (DOI 10.1038/sdata.2015.75) when using the dataset, per Pantheon's
  own instruction above.
- **ShareAlike implication for this project, flagged but not resolved
  here** (out of this ticket's scope, which is schema/license *facts* only):
  CC BY-SA 4.0 is a copyleft license — Section 3(b) of the CC BY-SA 4.0
  legal code requires that "Adapted Material" (which a derived/transformed
  subset qualifies as) be distributed under the same CC BY-SA 4.0 license
  (or a license the CC organization has deemed compatible). Shipping a
  transformed subset of Pantheon's `hpi`/`occupation`/etc. fields inside
  this app's static JSON bundle likely makes that JSON itself
  "Adapted Material" subject to CC BY-SA 4.0's share-alike clause — i.e.
  the derived `people.json` (or the relevant fields within it) may need to
  carry a CC BY-SA 4.0 notice/license of its own, distinct from whatever
  license covers the app's own source code. This is a real constraint to
  resolve with whoever owns licensing decisions before shipping, not
  something this research ticket resolves.

## 4. Download mechanics

- **No account or API key required.** The "2025 Person Dataset" link on
  https://pantheon.world/data/datasets points directly to a public Google
  Cloud Storage object:
  `https://storage.googleapis.com/pantheon-public-data/person_2025_update.csv.bz2`
  — a plain anonymous `curl` GET returns `HTTP/2 200` with the file body,
  no cookies, auth headers, redirects-to-login, or CAPTCHA involved. (There
  is also a documented `/data/api` page for a live API, not investigated
  here since the ticket's concern is the static "2025 Person Dataset" CSV
  specifically, not the live API.)
- The same page also lists (not downloaded/inspected — out of scope for
  this ticket, which asked specifically about the 2025 dataset) sibling
  files at the same public bucket: `person_2020_update.csv.bz2`,
  `person_2019_update.csv.bz2`, and Pantheon 1.0 legacy files
  (`legacy_pantheon.tsv.bz2`, `legacy_wikilangs.tsv.bz2`,
  `legacy_pageviews_2008-2013.tsv.bz2`).
- **Format**: bzip2-compressed (verified via `file`:
  `person_2025_update.csv.bz2: bzip2 compressed data, block size = 900k`),
  comma-delimited, double-quoted CSV, UTF-8 (contains non-ASCII characters
  in names/places without mangling once decoded as UTF-8), 34 columns, one
  row per person (**not** one row per group — `is_group` exists as a column
  but is 100% `FALSE` in this file), 126,582 data rows.
- **Exact header row** (verbatim, as shipped in the file, quotes included):

  ```
  "id","wd_id","wp_id","slug","name","occupation","prob_ratio","gender","twitter","alive","l","hpi_raw","bplace_name","bplace_lat","bplace_lon","bplace_geonameid","bplace_country","birthdate","birthyear","dplace_name","dplace_lat","dplace_lon","dplace_geonameid","dplace_country","deathdate","deathyear","bplace_geacron_name","dplace_geacron_name","is_group","l_","age","non_en_page_views","coefficient_of_variation","hpi"
  ```

- The page at `/about/methods`, which the datasets page links to for "more
  information on how this data was created," currently **404s**
  (`https://pantheon.world/about/methods` → `HTTP/2 404`, verified directly
  with `curl -D -`, both with and without an `/en/` locale prefix — the
  `/en/` variant 301-redirects back to the broken `/about/methods` URL).
  This is a dead link on Pantheon's own site as of 2026-08-03; the FAQ page
  (https://pantheon.world/data/faq) and the linked arXiv/Nature paper
  (https://arxiv.org/abs/1502.07310, https://www.nature.com/articles/sdata201575)
  are the working primary sources for methodology instead.

## Sources

- https://pantheon.world/data/datasets — dataset list, download links, license badge (fetched via curl; RSC JSON payload parsed for the real content, since a naive HTML→markdown fetch only surfaces the page chrome)
- https://storage.googleapis.com/pantheon-public-data/person_2025_update.csv.bz2 — the actual 2025 Person Dataset file, downloaded and fully parsed (126,582 rows)
- https://pantheon.world/data/permissions — exact license text and citation requirement
- https://pantheon.world/data/faq — HPI's five components, data-collection methodology ("Johnny 5" classifier), "present-day geographical boundaries, not nationality" caveat, Pantheon 1.0 vs 2.0 authorship/era, "more than 70k biographies" / ">15 language editions" inclusion criterion
- https://arxiv.org/abs/1502.07310 and https://www.nature.com/articles/sdata201575 — Pantheon 1.0 data descriptor paper (Yu et al. 2016, *Scientific Data* 2:150075, doi:10.1038/sdata.2015.75), cited for the >25-language/11,341-biography Pantheon 1.0 baseline and the "three levels of aggregation" occupation taxonomy that did **not** carry over into the 2025 CSV
- https://pantheon.world/about/methods — confirmed broken (404) as of 2026-08-03
- Local repo cross-references: `packages/shared-types/src/index.ts` (existing `Person`/`Category`/`Region` types), `packages/data-pipeline/transform/score.ts` and `packages/data-pipeline/fetch/queries/reigns.ts` (existing sitelink-tier and reign-period mechanisms being compared against)
