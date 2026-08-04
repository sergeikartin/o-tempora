Type: research
Status: resolved

## Question

What is Pantheon 2.0's actual dataset schema? Specifically:
- Exact field list, especially: HPI (or equivalent fame/popularity field) name, scale, and distribution; occupation/domain field(s) and their taxonomy; region/country/nationality field(s) and taxonomy; birth/death date fields and their precision (year only vs full date — matters for `Temporal.PlainDate` compatibility); any office/tenure/reign field for rulers.
- Record count and time period covered.
- Exact license (which Creative Commons variant) and attribution requirements for redistributing a derived dataset in a shipped static web app.
- Download mechanics: does it require an account/API key, and what format is the "2025 Person Dataset" bzip-compressed CSV's actual header row.

## Context

Blocks: People-lane occupation/region tagging design, fame-tier threshold confirmation (90/85/75 against HPI — see [Fame tier HPI thresholds](../issues/03-fame-tier-hpi-thresholds.md)), the reign-periods-feature-survival question, and Pantheon license compliance.

## Answer

Full findings: [research/pantheon-schema.md](../research/pantheon-schema.md). Downloaded and fully parsed the actual 2025 Person Dataset (126,582 rows, 34 columns) — not just the docs page.

- **HPI**: field is `hpi` (0-100 scale; `hpi_raw` is an unbounded pre-rescale value, don't use it directly). The proposed 90/85/75 floors are confirmed usable against real data: 108 / 423 / 3,840 people respectively (out of 126,582), tightly nested like the current sitelink tiers.
- **Occupation**: single flat `occupation` field, 101 categories, all-caps (e.g. `SOCCER PLAYER`, `POLITICIAN`). No domain/industry hierarchy (Pantheon 1.0's paper describes one; it didn't survive into the 2025 CSV) — a mapping table to this app's 8-value `Category` enum is required, and that enum has no "sports" bucket despite sports occupations being ~34k of 126,582 rows.
- **Region**: `bplace_country`/`dplace_country`, free-text gazetteer-style names (233 distinct values, e.g. "Bahamas, The"), **present-day geographic location, not historical nationality** (Pantheon's own FAQ is explicit about this) — needs a mapping to the app's 6-value `Region` enum, with that present-day-vs-historical caveat carried forward as a real tradeoff.
- **Dates**: `birthdate`/`deathdate` are `YYYY-MM-DD` with a trailing ` BC` for BCE — not ISO 8601, needs a small parsing adapter for `Temporal.PlainDate`. 94.2% of rows have a full date. `birthyear`/`deathyear` are separate plain integers (negative for BCE), mapping directly onto the app's existing `Person.birthYear`/`deathYear` fields.
- **Reign/office field**: none exists — but **`wd_id` (Wikidata QID) is retained for every single row (126,582/126,582)**. This corrects the premise in [People source: Pantheon](../issues/01-people-source-pantheon.md) that the QID would be lost entirely — it isn't; Pantheon just doesn't use it as the primary key. The existing `reigns.ts` Q-ID-batch SPARQL query could still run unmodified as a secondary enrichment pass keyed on `wd_id`, meaning `reignPeriods` isn't automatically lost by this switch.
- **License: CC BY-SA 4.0** (Attribution-**ShareAlike**), confirmed from Pantheon's own permissions page — not a generic "CC" license as assumed at charting time. ShareAlike is a copyleft term: a derived/transformed subset (like this app's `people.json`) likely counts as "Adapted Material" under CC BY-SA 4.0 Section 3(b), which would need to carry a compatible CC BY-SA 4.0 notice of its own. This is a real constraint, not yet decided.
- **Download**: no account/API key needed — direct anonymous download from a public GCS bucket.
