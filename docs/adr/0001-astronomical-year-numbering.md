---
status: accepted
---

# Years use astronomical numbering internally; "no year 0" is a display-only rule

## Context

Same Sky spans BCE and CE dates across all three lanes (People, Conflicts, Milestones), stored and computed as a single plain signed integer per year (`YearMonth.year` in `packages/shared-types`). Standard historical BCE/CE (BC/AD) counting has no year 0 — 1 BCE is immediately followed by 1 CE. Astronomical year numbering (the convention `Temporal.PlainDate`'s ISO calendar uses, and the one Wikidata's own date literals use) instead has a year 0, defined as 1 BCE, with 2 BCE = year -1, 3 BCE = year -2, and so on — i.e. `astronomicalYear = 1 - bceYear`.

This distinction is easy to get wrong silently: naively negating a BCE year (`551 BCE -> -551`) matches neither convention. It isn't historical (1 BCE and 1 CE would be two apart, `-1` to `1`, instead of adjacent) and it isn't astronomical (astronomical `551 BCE` is `-550`). It's simply incorrect, and duration/position math built on top of it is off by one for any span crossing the boundary. This is exactly the bug the Pantheon CSV ingestion had: its `birthyear`/`deathyear` columns encode BCE via naive sign-flip, and that value was passed straight through unconverted, publishing every BCE person's year one too early (e.g. Confucius as `-551` instead of the correct `-550`).

This convention was already implicitly in effect before this ADR (see `formatYear`/`isBceYear` in `packages/web/src/shared/lib/format-year.ts`, and comments in `packages/shared-types/src/index.ts` and `packages/data-pipeline/src/transform/wikidata-date.ts`), but it was never written down anywhere durable — those comments referenced an "Invariant 4" in a `docs/architecture.md` that doesn't exist in this repo.

## Decision

Internal storage and computation use astronomical numbering end-to-end: `YearMonth.year` (shared-types), the pipeline's parsed Wikidata dates, and the web app's D3 x-scale/positioning all treat the year axis as one continuous signed-integer number line with a valid `0` (= 1 BCE). True historical "no year 0" counting is applied only at the point data becomes a human-facing label or tick — `formatYear`/`formatYearMonth` in `packages/web/src/shared/lib/format-year.ts` are the only places that perform the BCE conversion (`1 - year`). No other call site re-derives a BCE year from the stored number.

Any source that doesn't natively use astronomical numbering is converted to it at ingestion (fetch/parse) time, not left as its native convention. `pantheon-row-shape.ts`'s `toAstronomicalYear` is the first such conversion: Pantheon's `birthyear`/`deathyear` columns use naive sign-flip rather than astronomical numbering, so they're corrected right after parsing, before anything downstream sees them.

## Why

Astronomical numbering is what makes plain subtraction across the BCE/CE boundary give the correct answer (1 BCE to 1 CE is `1 - 0 = 1` year apart, correctly), which is exactly what a continuous D3 pixel scale and any duration/age calculation need. It's also what `Temporal.PlainDate`'s ISO calendar already uses natively (a project-wide requirement — see `.claude/rules/code-conventions.md`) and what Wikidata's own SPARQL date literals already use, so data flows through the pipeline with no conversion needed at that boundary. Pushing the "no year 0" adjustment to a single display-time conversion, rather than encoding it into storage, keeps exactly one place responsible for it instead of every arithmetic call site.

## Considered Options

**Store years using true historical numbering (no year 0 ever appears in storage; 1 BCE = -1, 1 CE = 1).** Rejected: breaks continuous math everywhere else — every duration, pixel-position, and Wikidata-ingestion computation would need its own boundary-crossing adjustment instead of plain subtraction, and would put storage permanently at odds with `Temporal.PlainDate`'s native (astronomical) calendar, requiring a conversion layer at every Temporal touchpoint.

## Consequences

- Any new code that consumes a stored `year` for arithmetic (duration, position, sorting) can use plain subtraction/comparison with no special-casing — it's already a continuous line.
- Any new code that displays a year to a user must go through `formatYear`/`formatYearMonth` rather than showing the raw stored number or reimplementing the BCE conversion locally.
- A source that doesn't natively use astronomical numbering must be converted at ingestion time — done for Pantheon (`toAstronomicalYear`); any future non-Wikidata source needs the same treatment.
- The Year Axis's tick labels (`isRoundTickYear`/`roundTickYearsInRange` in `format-year.ts`, used by `YearAxis.tsx`) pick round *historical*-numbering positions rather than round astronomical ones, matching the common historical-timeline convention: every tick stays on its normal round-number spacing except the single BCE segment touching the era boundary, which is one tick narrower, absorbing the missing year 0 into a dedicated boundary tick at year 0 itself ("1 BCE") instead of relabeling every BCE tick by one.
- Since the CE-side tick phase (≡ 0 mod step) and the BCE-side tick phase (≡ 1 mod step) genuinely differ, and a single repeating CSS background can only tile one phase, both CSS-gradient-based tick renderings in this codebase — the Year Axis's own tick marks (`YearAxis.tsx`'s `.rulerRow`) and `TimelineCanvas.tsx`'s separate full-height decade gridlines behind the lane content (`.gridlineLayer`) — render as two adjacent, independently-phased regions split at year 0 (`options.ts`'s `phaseOffsetYears`, `BCE_DECADE_TICK_PHASE_OFFSET_YEARS`/`BCE_CENTURY_TICK_PHASE_OFFSET_YEARS`) rather than one continuous background. Any future CSS-gradient-based tick/gridline rendering needs the same split — a single-phase background will silently drift out of alignment with round-historical BCE labels/ticks elsewhere on the page.
