# CDB90 research: war-level date ranges, license, DBpedia crosswalk

Research for ticket `.scratch/alt-data-sources/issues/06-research-cdb90-war-ranges.md`.

All claims below are checked against the primary sources: the live `jrnold/CDB90` GitHub repo
(`master` branch, repo file tree confirmed via `git/trees/master?recursive=1`, `version.csv` =
`9.0.3`) and, for the DBpedia crosswalk, live DBpedia JSON responses. Every file referenced was
fetched directly with `curl` from `raw.githubusercontent.com/jrnold/CDB90/master/...`; commands
are given so they can be re-run.

## 1. No war-level start/end dates anywhere; `battles.csv`'s `time` column is *not a date at all*

**`battles.csv` has no date field, and its `time` column is a tactical boolean, not a date.**

Fetched `data/battles.csv` (`curl https://raw.githubusercontent.com/jrnold/CDB90/master/data/battles.csv`,
660 data rows) and cross-checked its schema doc `src-data/datapackage/resources/battles.yaml`.
The schema entry for `time` reads:

```yaml
- description: did defender's posture change over time?
  id: time
  type: integer
```

`time` sits in a run of tactical posture-descriptor columns (`postype`, `post1`, `post2`, `front`,
`depth`, `time`) — "did the defender's posture change along the front / with depth / over time?" —
and its values in the CSV are indeed 0/1/blank, e.g. row 1 (`NIEUPORT`, Netherlands' War of
Independence, 1600) has `time = 0`. **This confirms the prior team's suspicion: `time` is not a
date column at all**, it's a yes/no tactical-analysis flag. There is no column in `battles.csv`
named or described as a battle date, and certainly no war-level start/end date column — the closest
things are `war`, `war2`, `war3`, `war4`, `war4_theater`, `cow_warno`, `cow_warname` (all naming/
classification fields, no dates).

**Real per-battle dates exist, but in a separate joined table: `data/battle_durations.csv`.**

Fetched `data/battle_durations.csv` (660 data rows, one row per `isqno` — confirmed 1:1 join
against `battles.csv`, zero unmatched `isqno`s). Header and sample:

```
"isqno","datetime_min","datetime_max","datetime","duration1","duration2"
1,"1600-07-02T14:30:00","1600-07-02T19:30:00","1600-07-02T17:00:00",1,0.25
2,"1620-11-08T12:00:00","1620-11-08T13:00:00","1620-11-08T12:30:00",1,0.05
```

These are full ISO-8601 datetimes with sub-day precision (`datetime_min`/`datetime_max` bound the
battle's start/end; `datetime` is a point estimate; `duration1`/`duration2` are duration figures in
days). This is a genuine date field — just not the one the prior header skim landed on, and not
inside `battles.csv` itself.

There's also `data/active_periods.csv` (830 data rows > 660 battles, confirming multiple discrete
"activity periods" per battle for some battles), with columns `isqno, atp_number, start_time_min,
start_time_max, end_time_min, end_time_max, duration_max, duration_min, duration_only` — an even
finer-grained sub-battle time breakdown. Not needed for war-range derivation, but worth knowing it
exists if finer battle-phase timing is ever wanted.

**Conclusion for Q1**: war-level dates must be *derived*; they don't exist as a native field
anywhere in the repo (checked every CSV in `data/`, see §5). Per-battle dates *do* exist as real
datetimes, but only by joining `battles.csv` (for `war`/`cow_warno`/`cow_warname` grouping) against
`battle_durations.csv` on `isqno`.

## 2. Is min/max-per-war from battle dates a reasonable approach?

Joined `battles.csv` and `battle_durations.csv` on `isqno` (script run locally against the fetched
CSVs) and grouped by the `war` field (free-text war name) and separately by `cow_warno` (Correlates
of War number, populated for a subset of rows):

- 660 battles total, join is complete (every battle has a duration row).
- Grouping by `war` (free text): **65 distinct wars**, of which **48 have multiple battles** and
  **17 have only a single battle**.
- Grouping by `cow_warno` (COW war number, populated on 33 of the war groups — many older/
  pre-1816 wars have no COW number and would need to fall back to the `war`/`war4` text field):
  33 distinct COW wars, of which 11 have only a single battle and 22 have multiple.

So most wars in the dataset (roughly 3 in 4 by the `war` grouping) do have multiple battles spread
over time, which is what makes min/max derivation meaningful rather than degenerate. Spot checks:

| War (`war` field) | battles | derived min/max (from `battle_durations`) | actual historical span |
|---|---|---|---|
| THIRTY YEAR'S WAR | 18 | 1620-11-08 → 1648-08-10 | 1618–1648 |
| ENGLISH CIVIL WAR | 6 | 1642-10-23 → 1645-06-14 | 1642–1651 (1st ECW: 1642–1646) |
| DUTCH WAR | 5 | 1674-06-16 → 1675-06-28 | 1672–1678 |

Pattern: the derived range is consistently **narrower than the war's true historical span**,
because CDB90 only catalogs major/notable battles, not every skirmish, and doesn't capture
declaration-of-war or peace-treaty dates. This is a known, structural limitation — the derived
range should be understood as "span of major battles" not "de jure war duration." For a
range-bar visualization this is probably fine (it still anchors the bar close to the real war),
but it will systematically clip a few months to a few years off both ends versus Wikidata's
(SPARQL-sourced) start/end dates, which are usually declaration/armistice-based. Single-battle
wars (17 of 65 by name, 11 of 33 by COW number) degenerate to a zero-length "range" (a point) —
those would need either a fallback duration heuristic or to render as a point rather than a bar.

**Conclusion for Q2**: deriving war ranges from min/max battle date (via `battles.csv` →
`battle_durations.csv` join, grouped by `cow_warno` where present else `war`/`war4` text) is
reasonable and produces plausible non-degenerate ranges for most (majority) wars, but systematically
undershoots true war duration at both ends and produces zero-width ranges for ~1/4–1/3 of wars
(single-battle wars) that will need special-casing.

## 3. License terms

Fetched `README.md` (`https://raw.githubusercontent.com/jrnold/CDB90/master/README.md`), which
states, verbatim, under the "Licenses" heading:

```
# Licenses

- Code is [BSD-3](http://opensource.org/licenses/BSD-3-Clause) unless otherwise noted.
- Data is [odc-by](http://opendatacommons.org/licenses/by/).
- The original CDB90 data in `src-data/M000121` is Public Domain.
```

There is **no separate top-level `LICENSE` file** in the repo (`curl .../master/LICENSE` → HTTP
404) — the README section above is the only license statement in the repo. This was cross-checked
against `datapackage.json` (`https://raw.githubusercontent.com/jrnold/CDB90/master/datapackage.json`),
whose machine-readable `licenses` field independently confirms the derived data's license:

```json
"licenses": [
  { "id": "odc-by", "url": "http://opendatacommons.org/licenses/by/" }
]
```

So: the file this project would actually consume, `data/battles.csv` (and the other files under
`data/`), is **ODC-BY (Open Data Commons Attribution License)** — redistribution is permitted with
attribution required. The raw, unprocessed original files under `src-data/M000121/` (the `.WKS`/
`.csv` originals from NTIS/DTIC) are stated as **Public Domain**. Code (the R/Python build scripts)
is BSD-3-Clause, which is irrelevant to shipping the data itself. **ODC-BY requiring attribution is
the one actionable constraint** — the app would need to credit CDB90/jrnold (and, transitively,
the original CAA/HERO/DTIC study) somewhere (e.g. a sources/credits page), consistent with how the
project presumably already attributes Wikidata. No terms here block redistribution in a shipped
static app; attribution is the only obligation.

## 4. DBpedia crosswalk

`battles.csv`'s `dbpedia` column, per its schema doc (`src-data/datapackage/resources/battles.yaml`):

```yaml
- description: >
     URI for associated `dbpedia <http://dbpedia.org>`__ resource.
     These are easy to find for battles in the wars prior to WWI. It was harder to
     find these for WWI and later wars, and especially for the Arab-Israeli wars.
  label: Dbpedia URI
  id: dbpedia
  type: string
  source: Arnold
```

**Values are full DBpedia URIs** (not bare slugs), e.g. row 1:
`http://dbpedia.org/resource/Battle_of_Nieuwpoort`. (Note: a separate, earlier-stage file,
`src-data/local/wars.csv` — despite its name, this is a per-battle override table, see §5 — stores
the same identifiers as bare slugs like `Battle_of_Nieuwpoort`; the final `data/battles.csv` has
the full `http://dbpedia.org/resource/...` URI form.)

**Fill rate, measured directly from the fetched CSV** (Python `csv.DictReader` over all 660 rows):

- **414 / 660 rows (62.7%)** have a non-empty `dbpedia` URI overall.
- Restricting to rows whose `cow_warname` contains "WORLD WAR" or "ARAB" (WWI/WWII/Arab-Israeli
  wars, 326 rows): **123 / 326 (37.7%)** filled — confirming the README's own caveat that these
  later/20th-century wars have sparser DBpedia coverage than the pre-WWI ones.

**DBpedia → Wikidata crosswalk confirmed live** on two samples: fetched
`http://dbpedia.org/data/Battle_of_Nieuwpoort.json` and
`http://dbpedia.org/data/Battle_of_Mons.json` (DBpedia's JSON resource description) and inspected
the `http://www.w3.org/2002/07/owl#sameAs` property:

- `Battle_of_Nieuwpoort` → `owl:sameAs` → `http://www.wikidata.org/entity/Q1392`
- `Battle_of_Mons` → `owl:sameAs` → `http://www.wikidata.org/entity/Q1417205`

Both resolved correctly to real, matching Wikidata battle entities (Q1392 = Battle of Nieuwpoort,
Q1417205 = Battle of Mons). **Conclusion for Q4**: yes, DBpedia URIs are a usable crosswalk to
Wikidata via `owl:sameAs` for the ~63% of battles that have one (dropping to ~38% for 20th-century
wars) — but it's a per-*battle* crosswalk, not per-war, and it only covers battles, not the wars
themselves (there's no war-level DBpedia/Wikidata field in the dataset — see §1/§5).

## 5. Is there a separate "wars" table?

Full repo file listing fetched via GitHub API
(`https://api.github.com/repos/jrnold/CDB90/git/trees/master?recursive=1`). Files under `data/`
(the cleaned/published tables, per the README's "the directory `data` contains the revised data"):

```
data/active_periods.csv
data/battle_actors.csv
data/battle_durations.csv
data/battle_dyads.csv
data/battles.csv
data/belligerents.csv
data/commanders.csv
data/enum_*.csv          (11 lookup/enum tables for coded fields)
data/front_widths.csv
data/terrain.csv
data/version.csv
data/weather.csv
```

**There is no `wars.csv` (or similarly named war-level table) in `data/`.** All tables are
battle-, actor-, or dyad-level (i.e. keyed by `isqno` or a battle/actor pair), matching the
Data Package's per-battle design described in the README ("separate tables for battles,
combatants, activity periods, etc" — wars are not among them).

There **is** a file called `src-data/local/wars.csv`, under the pre-publication `src-data/`
staging tree — but fetching it (`curl .../master/src-data/local/wars.csv`) shows it is **not** a
war-level table despite the name: it has 660 data rows, one per `isqno` (battle), with columns
`isqno,name,war,war2,war3,war4,war4_theater,dbpedia,cow_warno,cow_warname,comment,sidea` — i.e.
it's a per-battle local-override/staging file (likely the hand-curated input later merged into
`battles.csv`'s war-name/dbpedia columns during the build), not a deduplicated one-row-per-war
table with its own dates. Its `isqno` values run 1, 2, 3, 4, 5... matching individual battles, not
distinct war IDs — confirmed no aggregation to war level.

**Conclusion for Q5**: no war-level file exists anywhere in the repo, published or staging. War
ranges are unavoidably a derived/computed concept if CDB90 is used for the Wars lane.

## Summary / implications for the hybrid design

1. War start/end dates must be **derived** (min/max battle datetime per `cow_warno`/`war` group,
   via a join of `battles.csv` × `battle_durations.csv` on `isqno`) — no native field exists.
2. This derivation is reasonable for the majority (~70%) of multi-battle wars but will
   systematically understate true war duration at both ends, and degenerates to a zero-width point
   for single-battle wars (~1/4–1/3 of wars) — needs a fallback (e.g. pad by N months, or render as
   a point event instead of a range bar) for those cases.
3. Data license is ODC-BY (attribution required, redistribution permitted) for everything under
   `data/`; original NTIS/DTIC source files are public domain. No blocker for shipping in the
   static app; add an attribution credit.
4. DBpedia URIs in `battles.csv.dbpedia` (full URIs, 62.7% filled, sparser for 20th-century wars)
   do crosswalk to Wikidata via `owl:sameAs`, confirmed live on 2 samples — useful for cross-linking
   individual **battles** to existing Wikidata-sourced entities if ever needed, but not a source of
   war-level dates or a war-level crosswalk (no war-level identifiers exist in CDB90 at all).

## Sources (all fetched live during this research)

- `https://raw.githubusercontent.com/jrnold/CDB90/master/README.md`
- `https://api.github.com/repos/jrnold/CDB90/git/trees/master?recursive=1` (full file tree)
- `https://raw.githubusercontent.com/jrnold/CDB90/master/data/battles.csv`
- `https://raw.githubusercontent.com/jrnold/CDB90/master/data/battle_durations.csv`
- `https://raw.githubusercontent.com/jrnold/CDB90/master/data/active_periods.csv`
- `https://raw.githubusercontent.com/jrnold/CDB90/master/src-data/local/wars.csv`
- `https://raw.githubusercontent.com/jrnold/CDB90/master/src-data/datapackage/resources/battles.yaml`
- `https://raw.githubusercontent.com/jrnold/CDB90/master/datapackage.json`
- `https://raw.githubusercontent.com/jrnold/CDB90/master/data/version.csv` (repo version `9.0.3`)
- `https://raw.githubusercontent.com/jrnold/CDB90/master/LICENSE` (confirmed 404 — no root LICENSE file)
- `http://dbpedia.org/data/Battle_of_Nieuwpoort.json`, `http://dbpedia.org/data/Battle_of_Mons.json`
  (live DBpedia `owl:sameAs` lookups)
