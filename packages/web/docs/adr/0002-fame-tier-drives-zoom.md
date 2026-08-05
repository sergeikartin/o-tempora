---
status: accepted
---

# Fame Tier gates entity density automatically by zoom, not a manual selector

## Context

A `/grilling` session on a proposed tiered-zoom architecture (`.scratch/frame-tier-zoom/spec.md`) needed to decide what should control entity density as the user zooms. The data-pipeline already defines three named, nested Fame Tiers per lane (`generalPublic` ⊂ `educated` ⊂ `specialist`, in `packages/data-pipeline/src/transform/score.ts`), keyed off a `fameScore` field (Pantheon HPI for People, Wikidata sitelinks for Wars/Discoveries) that every `TimelineEntry` already carries end-to-end into the shipped JSON. That system was built for exactly this density-control problem but was never wired to a UI — the pipeline currently ships only the `generalPublic`-floor subset, "with no frontend tier selector built yet" per the code's own comment, and Unit 9 (`features/filter-by-fame-tier`, unspecced) was the planned manual selector for it.

The grilling session decided the zoom level itself should drive Fame Tier automatically, replacing Unit 9's manual filter outright rather than coexisting with it.

## Decision

Three viewport bands, keyed off `pixelsPerYear`, are bound to the three existing Fame Tier values — CORE (500↔150y) = `generalPublic` floor, NOTABLE (150↔50y) = `educated` floor, EXHAUSTIVE (50↔10y) = `specialist` floor — reusing `FAME_TIER_MIN_HPI`/`FAME_TIER_MIN_SITELINKS_WARS`/`FAME_TIER_MIN_SITELINKS_DISCOVERIES` as-is (CORE/NOTABLE/EXHAUSTIVE are the UI's display labels for those three values). The data-pipeline's output floor widens from `generalPublic`-only to `specialist` (the full superset), and the frontend filters client-side by each entry's existing `fameScore` field against the active tier's threshold.

## Why

`score.ts` already has the exact nested-subset property this needs ("no re-ranking needed when the tier changes," per its own comments) and its thresholds are already calibrated against the real dataset (e.g. People: hpi≥90 → 108 people, hpi≥85 → 423, hpi≥75 → 3,840). Inventing a parallel threshold scheme would duplicate real, tested domain logic — that a UI for it didn't exist yet doesn't mean the underlying model was wrong, just unwired.

## Considered Options

**Independent zoom-tier thresholds**, decoupled from Fame Tier. Rejected: no data-driven reason to pick different cutoffs, and it would leave two parallel three-tier density systems with different values but the same shape and purpose — confusing for no benefit. (An earlier draft of this decision introduced a separate "Frame Tier" name for the zoom-coupled viewport bands; dropped in favor of one term, since the two were 1:1 anyway — see `CONTEXT.md`'s "Fame Tier" entry.)

## Consequences

- The pipeline's output stage changes from filtering to `generalPublic` only to filtering to `specialist` (the loosest floor) — a larger dataset ships to the frontend than today, with `fameScore` load-bearing for client-side filtering rather than just informational.
- Unit 9 (`features/filter-by-fame-tier`) as originally scoped — a manual, user-facing fame selector — is superseded and should be closed/removed from `docs/active-context.md`'s Next Up rather than implemented separately.
