# Vetustas Archiva research: inventions dataset schema, license, coverage

Research for ticket `.scratch/alt-data-sources/issues/07-research-vetustas-schema.md`.

The docs page (`https://docs.vetustas.net/datasets/inventions`) is confirmed to be a client-rendered
SPA shell — `curl`ing it returns only a `<title>`/meta tags and a Vite `index-*.js`/`vendor-*.js`
bundle, no server-rendered content (`curl -sL https://docs.vetustas.net/datasets/inventions`,
63-line HTML shell, `<div id="root"></div>` with no content). This is **not** vaporware, though: the
real data, a real public API, and a real GitHub repo all exist and were reached and verified below.
Every claim is against a primary source (live API JSON, the live GitHub repo/README/LICENSE, or a
downloaded CSV) with the exact command/URL given.

## 1. What "Vetustas" actually is, and where the data lives

`docs.vetustas.net`'s canonical URL (`<link rel="canonical" href="https://archiva.vetustas.net/">`
in the fetched HTML) points at `archiva.vetustas.net`, a second, separate site ("the Explorer").
Fetching `archiva.vetustas.net`'s own JS bundle
(`curl -sL https://archiva.vetustas.net/assets/index-azYwvpSU.js`) surfaced hardcoded calls to a
same-origin `/api/datasets` endpoint, which is live:

```
curl -sL https://archiva.vetustas.net/api/datasets
```

There is also a third site, `vetustas.net` itself ("the Game") — a Next.js-rendered trivia/ranking
game ("Judge the Ages") built on the *same* underlying data, confirmed via `WebFetch` on
`https://vetustas.net` (nav: Leaderboards, Archiva, Login; categories: Entertainment, Sports, Arts &
Culture, History, Business, People; footer credits creator **Achraf El Fadili**,
`https://elfadiliachraf.tech`).

The primary source, per the ecosystem's own README, is a public **GitHub repository**:

- **`https://github.com/0xShady/vetustas-archiva`** — found by resolving the game's Terms-of-Service
  text ("The underlying dataset is open and maintained separately on GitHub under its own license" —
  `WebFetch https://vetustas.net/terms`) to the creator's GitHub account (`0xShady`, matching
  "Achraf El fadili" from the footer), then listing that account's public repos:
  `curl -sL https://api.github.com/users/0xShady/repos?per_page=100` → `vetustas-archiva`,
  description "Open, curated datasets of notable things across history and culture. movies, music,
  games, books, people, companies, inventions, landmarks, art and more."
  (`https://github.com/0xShady/vetustas-archiva`, created 2026-06-03, last updated 2026-06-29,
  2 stars, 0 forks — a small/new solo project).

There's also a documented, live **public REST API** (separate from the Explorer's internal `/api`),
confirmed via the repo's own README and a self-describing schema endpoint:

- Base: `https://api.vetustas.net/v1/` (per `README.md`'s badge and usage example, cross-checked
  live: `curl -sL "https://api.vetustas.net/v1/inventions?limit=3"` → HTTP 200, real JSON).
- Token-less, rate-limited: response headers on that call included
  `x-ratelimit-limit: 60`, `x-ratelimit-remaining: 59`, `x-ratelimit-reset: <unix ts>`
  (`curl -sD - -o /dev/null https://api.vetustas.net/v1/inventions?limit=1`).
- Self-documenting: `curl -sL https://api.vetustas.net/openapi.json` returns a full OpenAPI 3.1
  spec (`info.title: "Vetustas API"`, `info.description: "Read-only access over the archiva open
  datasets — the same-origin explorer endpoints (/api) and the public, rate-limited API (/v1)."`),
  and `curl -sL https://api.vetustas.net/v1/inventions/schema` returns a machine-readable schema for
  the inventions dataset specifically (columns, filters, one worked example — reproduced in full
  below).

So: the docs page itself never rendered, but everything it was presumably going to document (the
dataset, the API, the field list) is independently reachable and was fetched directly.

## 2. Field list and date precision (inventions dataset)

Confirmed three independent ways, all in agreement: the repo's `README.md`, the live
`/v1/inventions/schema` endpoint, and the raw `datasets/inventions.csv` header row.

**10 columns**, verbatim from `curl -sL https://api.vetustas.net/v1/inventions/schema`:

| Column | Type | Description (from the schema endpoint) |
|---|---|---|
| `id` | id | Stable record id (opaque UUID). Use it for lookups. |
| `name` | string | Display name. |
| `date` | date | Date. ISO date, year, or negative year for BC. |
| `reference_url` | url | Source URL (usually the Wikipedia article). |
| `country` | string | Country. |
| `inventor` | string | Credited inventor(s); semicolon-separated. |
| `type` | string | Type / classification. |
| `category` | string | Domain (Transport, Medicine…). |
| `image` | url | Image URL. |
| `wikidata_id` | id | Wikidata entity id (QID). |

The **public `/v1/` API adds two derived columns** not present in the raw CSV/GitHub data:
`date_accuracy` (`year \| month \| day` — precision of the `date` field) and `country_code` /
`country_id` (ISO-3166 alpha-3 / numeric, resolved from `country`, `null` when `country` is empty).
Confirmed via a live record: `curl -sL "https://api.vetustas.net/v1/inventions?country=Japan&limit=2"`
returned `"country_code":"JPN","country_id":"392","date_accuracy":"year"` for the QR code record.

**Date precision is genuinely mixed, matching the repo's documented format** ("signed
`YYYY[-MM[-DD]]`, truncated to the real precision (a year-only fact is `YYYY`, not `YYYY-01-01`)" —
`README.md` §"Data format"). Verified by downloading and scanning all 296 records
(`https://archiva.vetustas.net/api/datasets/inventions?page={1..15}&page_size=20`, cross-checked
against `datasets/inventions.csv` — identical, 296 data rows in both):

- **255 / 296** year-only (e.g. `"-3300000"` for "stone tools", `"1990"` for "search engine")
- **40 / 296** full `YYYY-MM-DD` (e.g. `"1989-03-12"` World Wide Web, `"2012-07-04"` Higgs boson)
- **1 / 296** `YYYY-MM` month precision (`"1962-10"`, LED / Nick Holonyak, `wikidata_id: Q25504`)

Very old (prehistoric) dates are plain large negative-year integers, not calendar dates — e.g.
`"date": "-3300000"` for stone tools (3.3 million years ago) and `"-1000000"` for control of fire.
This is far outside this app's documented scope of "~800 BCE–present, extendable to 3000 BCE"
(`CLAUDE-decisions.md` line 7) — 25 of the 296 records (the "Prehistoric" era bucket, see §4) predate
even the extended 3000 BCE floor.

## 3. Identifiers, license, record count, time period

**Identifiers**: `wikidata_id` (Wikidata QID) is present on **all 296/296** records, all unique
(verified: `len({r['wikidata_id'] for r in rows}) == 296`, no empty values). `reference_url` is
almost always a Wikipedia article URL (verified by inspection of all fetched pages). There is no
non-Wikidata identifier scheme — `id` is just an opaque UUIDv4 generated by the repo's own tooling
("a UUIDv4 that is permanent and globally unique... the stable key to reference a record over time" —
`README.md` §"Data format"), not a foreign-system id.

**License — dual, and documented in three places that agree:**

1. `README.md` badges: `Data: CC BY-SA 4.0` / `Code: MIT`.
2. `README.md` §"License": "**Datasets** (`datasets/`) — CC BY-SA 4.0. Free to use, share and adapt
   (including commercially) with attribution; derivatives stay open under the same license." /
   "**Code** (`scripts/`) — MIT."
3. The repo's GitHub-detected license metadata: `curl -sL
   https://api.github.com/repos/0xShady/vetustas-archiva` → `"license": {"key": "mit", ...}` (GitHub
   only detects one license per repo and picked up the root `LICENSE`, i.e. the code license — the
   data-specific license lives in `datasets/LICENSE`, fetched directly:
   `curl -sL https://raw.githubusercontent.com/0xShady/vetustas-archiva/main/datasets/LICENSE`).

`datasets/LICENSE` (full text fetched) confirms **CC BY-SA 4.0** for the data files, with a
"Sources & acknowledgements" section stating the data is compiled from public sources under their
own terms, specifically:

> - Wikidata — CC0 1.0 (public domain)
> - Wikipedia — text CC BY-SA 4.0; images per their individual licenses
> - The Movie Database (TMDB) — used under the TMDB terms of use
> - IMDb datasets — ratings/votes are PERSONAL, NON-COMMERCIAL use only...
> - AniList, Last.fm, Spotify, MusicBrainz — used under their respective terms.

For the **inventions dataset specifically**, the only two source fields present are `reference_url`
(Wikipedia) and `wikidata_id` (Wikidata) — TMDB/IMDb/AniList/music-service terms are irrelevant here
(those apply to the movies/tv/anime/music datasets, not inventions). So in practice the inventions
data's real provenance is Wikidata (CC0) + Wikipedia, repackaged and CC BY-SA 4.0-licensed by the
repo owner, with a suggested attribution string: `"Vetustas Archiva
(https://archiva.vetustas.net) (https://elfadiliachraf.tech), CC BY-SA 4.0"`. CC BY-SA's ShareAlike
clause (any redistributed/adapted version must stay CC BY-SA) is worth flagging as a constraint if
this dataset is folded into a shipped static bundle — attribution alone is not sufficient the way it
is for the CC0/public-domain Wikidata data this project uses today.

**Record count**: exactly **296** records for `inventions`, confirmed three ways in agreement —
`/v1/inventions/schema`'s `"records": 296"`, the Explorer API's `"total": 296`, and 296 data rows in
`datasets/inventions.csv` (297 lines incl. header,
`curl -sL https://raw.githubusercontent.com/0xShady/vetustas-archiva/main/datasets/inventions.csv | wc -l`).
It's one of 14 sibling datasets in the same repo (anime, basketball-clubs, companies, events,
fine-art, football-clubs, games, inventions, landmarks, literature, movies, music, people, tv),
**4,531 records total** across all 14 (per `README.md`'s badge, cross-checked as internally
consistent with the per-file counts it lists).

**Time period covered**: earliest record is `-3300000` (stone tools, ~3.3 million years ago),
latest is `2020` (mRNA vaccine). Restricting to the app's actual scope, the Explorer's own
dashboard-chart era breakdown (`curl -sL
https://archiva.vetustas.net/api/datasets/inventions/dashboard`, chart id `eras`) bins all 296
records into:

| Era | Range | Count |
|---|---|---|
| Prehistoric | 64000 BC–3200 BC | 25 |
| Antiquity | 3000 BC–1326 | 52 |
| Industrial | 1410–1898 | 110 |
| Modern | 1900–2020 | 109 |

So **271 of 296 records (92%) fall within 3000 BCE–present** — the app's usable range — and the
dataset does reach the present day (most recent record: mRNA vaccine, 2020; other recent examples:
CRISPR 2012, gravitational waves 2015, Bitcoin 2009).

## 4. Coverage assessment: full Wikidata replacement, or a hybrid-style subset?

**This is a curated "greatest hits" list, not a comprehensive inventions/discoveries database, and
does not obviously improve on what the pipeline already produces from Wikidata.**

Domain breadth looks superficially good — the same dashboard endpoint's category chart shows 13
categories spanning science and technology broadly, not just a narrow niche:

```
Tools & Materials: 20   Weapons & Military: 18   Daily Life: 36   Agriculture & Food: 14
Transport: 26           Engineering & Industry: 19   Communication & Computing: 49
Astronomy & Earth: 18   Mathematics: 13          Energy & Power: 20
Physics & Chemistry: 33 Medicine: 19              Life Sciences: 11
```
(computed directly from the 296 fetched records, `category` field tally)

But the absolute density is thin: 296 records spread across ~5,000 years of recorded history and 13
broad domains works out to roughly one entry per famous "name-brand" invention per domain per few
centuries (e.g. exactly one entry each for "smartphone," "search engine," "Wi-Fi," "QR code," "human
genome sequence" — no runners-up, precursors, or regional variants). `type` values are also thin and
inconsistent: of 296 records, 190 are `"Invention"` and 62 are `"Discovery"`, 17 have an **empty**
`type`, and the remaining 27 are one-off Wikidata class labels dumped in raw (`"Weapon type"`,
`"Mathematical theory"`, `"Numeric writing system"`, `"Lithophile"`, `"Branch of mathematics"`,
`"Agricultural motor vehicle"`, `"IEC standard"`, etc.) — this reads like an unnormalized pass-through
of whatever Wikidata `instance of` claim each seed article happened to have, not a designed taxonomy.
Geographic coverage in the `country` field is very sparse too: 243/296 records (82%) have an **empty**
`country` (dashboard's own `geo-country` chart only plots 18 countries total, topped by China 13,
USA 7, UK 7 — everything else is 1-3).

**Directly comparable to what this project's Wikidata pipeline already produces.** This repo's
`packages/shared-types/src/data/events.json` (the live, already-shipped dataset) currently has 866
total events, of which **289 are already tagged `category: "invention"`**
(`python3 -c "...Counter(e['category'] for e in json.load(open('packages/shared-types/src/data/events.json')))"`
→ `{'war': 433, 'invention': 289, 'politics': 144}`). That's within single-digit-percent of Vetustas's
296 — the existing live Wikidata SPARQL pipeline is *already* surfacing an invention/discovery set of
essentially the same size. Vetustas isn't a bigger or richer corpus; it's a similarly-sized,
differently-curated one, with the advantage of being a stable pre-fetched snapshot (no live-SPARQL
502/timeout risk — the reliability problem motivating this whole sourcing review) but no evident
advantage in breadth or depth over what's already being fetched.

**Conclusion**: Vetustas Archiva's inventions dataset does **not** look sufficient to *fully replace*
Wikidata for the Events & Inventions lane — it's comparable in scale to the current Wikidata-derived
invention set, thinner in per-record metadata (`type` is inconsistent/raw, `country` is 82% empty,
no structured taxonomy beyond a flat 13-category label), and its own license terms (CC BY-SA,
ShareAlike) trace back to the exact same Wikidata+Wikipedia sources this project already draws from
directly. If it's used at all, it would need the **same hybrid framing already applied to the Wars
lane** (CDB90 + Wikidata split, see `issues/02-wars-source-cdb90-hybrid.md`) — e.g. as a stable,
pre-vetted "canonical/famous inventions" seed list unioned or cross-checked against a
redesigned/hardened live Wikidata query (the reliability fix already scoped in
`issues/04-wikidata-reliability-approach.md`), rather than as a standalone replacement. Its one
concrete, reusable asset either way is the `wikidata_id` on every single record (100% fill), which
gives a clean, lossless crosswalk back to Wikidata if any of the 296 records are cherry-picked for
use.

## Sources (all fetched live during this research)

- `https://docs.vetustas.net/datasets/inventions` (`curl -sL`, confirmed JS-shell-only, no content)
- `https://docs.vetustas.net` / `https://archiva.vetustas.net/assets/index-azYwvpSU.js` (`curl -sL`,
  found the `/api/datasets` and `/api/datasets/{name}` calls)
- `https://archiva.vetustas.net/api/datasets` (full dataset catalog, 14 datasets)
- `https://archiva.vetustas.net/api/datasets/inventions?page={1..15}&page_size=20` (all 296 records,
  paginated)
- `https://archiva.vetustas.net/api/datasets/inventions/dashboard` (era/category/country/type charts)
- `https://vetustas.net` (`WebFetch`, nav + creator credit)
- `https://vetustas.net/terms` (`WebFetch`, "underlying dataset is open and maintained separately on
  GitHub under its own license")
- `https://api.github.com/users/0xShady/repos?per_page=100` (resolved `vetustas-archiva` repo)
- `https://api.github.com/repos/0xShady/vetustas-archiva` (repo metadata: MIT code license, 2 stars,
  created 2026-06-03)
- `https://raw.githubusercontent.com/0xShady/vetustas-archiva/main/README.md`
- `https://raw.githubusercontent.com/0xShady/vetustas-archiva/main/LICENSE` (code MIT license)
- `https://raw.githubusercontent.com/0xShady/vetustas-archiva/main/datasets/LICENSE` (data CC BY-SA
  4.0 + sources/acknowledgements)
- `https://raw.githubusercontent.com/0xShady/vetustas-archiva/main/datasets/inventions.csv` (raw CSV,
  297 lines incl. header)
- `https://api.vetustas.net/v1/inventions?limit=3` / `?country=Japan&limit=2` (public API, live)
- `https://api.vetustas.net/v1/inventions/schema` (authoritative machine-readable schema)
- `https://api.vetustas.net/openapi.json` (full OpenAPI 3.1 spec)
- `packages/shared-types/src/data/events.json` (this repo's existing Wikidata-sourced dataset, for
  the size comparison in §4)
- `CLAUDE-decisions.md` (this project's documented time-scope invariant, ~800 BCE–present /
  extendable to 3000 BCE)
- `.scratch/alt-data-sources/issues/02-wars-source-cdb90-hybrid.md`,
  `.scratch/alt-data-sources/research/cdb90-war-ranges.md` (referenced for the Wars-lane hybrid
  precedent this dataset is compared against)
