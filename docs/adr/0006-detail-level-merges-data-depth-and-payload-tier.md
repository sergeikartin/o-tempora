---
status: accepted
supersedes: 0004-payload-tier-split-defers-low-fame-data.md
---

# Detail Level merges Data Depth and Payload Tier into one mechanism

## Context

Data Depth (the client-side UI preset, `Mainstream`/`Deep Cut`) and Payload Tier (the pipeline-side network-loading split, `tier0`/`tier1`) were deliberately kept independent — `0004-payload-tier-split-defers-low-fame-data.md` explicitly rejected naming Payload Tier's files after Data Depth's presets, reasoning that Data Depth was a UI convenience that shouldn't be conflated with the pipeline-side loading boundary. That independence held only because the two ranges happened to line up: Data Depth's deepest preset (`Deep Cut`) always sat inside Payload Tier's `tier1` file.

Redesigning Data Depth from 2 presets to 4 reopened that alignment. With 4 client-side floors instead of 2, keeping the loading boundary fixed at 2 files means either eagerly shipping every visitor everything down to the deepest level regardless of what they select, or trusting that future retuning of the new levels' floors keeps landing inside the existing 2-file split by coincidence — the exact drift risk ADR 0004 was written to avoid.

## Decision

Data Depth and Payload Tier become one mechanism: **Detail Level**, 4 numbered levels (`Legendary` / `Mainstream` / `Specialized` / `Deep Cut`), each with a fixed per-lane Fame Score floor and a matching pipeline-output delta file — the file for a level holds only the entities newly added versus the previous level, not a self-contained cumulative file. Level 2 is pinned to today's exact `Mainstream` floors and stays the default; level 4 is pinned to today's exact `Deep Cut` floors. Levels 1 and 3 are new, their floors derived by a constant per-lane multiplicative step on entity count (not on fame-score points), continuing the count-ratio drift the original two presets already had between them rather than picking arbitrary numbers.

Levels 1+2's delta files load eagerly (byte-identical cost to today's `Mainstream`/`tier0` load). Level 3 idle-prefetches in the background, same as today's deferred `tier1`. Level 4 loads strictly on demand, only once a user actually selects it. Once fetched, a level's data stays in memory even if the user dials back to a shallower level — client-side re-filtering is free; the goal is fewer network bytes, not less memory.

The manual `FameScoreFilters` numeric UI (introduced by `packages/web/docs/adr/0003-manual-fame-filter-replaces-zoom-tier.md`) is removed from production; its underlying continuous-floor mechanism is untouched, but its only remaining entry point is a dev-console-only function, stripped from the production bundle. With no manual UI path left, the "custom/unmatched" switch state that mechanism produced has no remaining production code path.

## Why

With 4 client-side floors instead of 2, a decoupled loading boundary now has twice as many points that could silently drift out of alignment, and no longer has a spare "it happens to fit" file to fall back on for level 3. Making the UI selector and the loading boundary the same 4-level concept keeps the boundary correct by construction — the same reasoning ADR 0004 used to justify reusing Fame Score as Payload Tier's boundary in the first place, just extended to admit that the UI selector and the loading boundary are now explicitly one thing, not a coincidence to keep in sync by hand.

## Considered Options

**Keep Payload Tier as a fixed 2-file split**, with all 4 Detail Levels narrowing client-side inside it. Rejected: works today only because `Deep Cut`'s numbers happen to fit inside `tier1`; any future retuning of level 1/3/4's floors could silently exceed that boundary with no error, and it still eagerly ships `Deep Cut`'s ~1,150 extra People rows to every visitor who never asks for them.

**Self-contained cumulative files per level** (e.g. level 3's file holds everything down to level 3's floor, level 1 and 2's entities included again). Rejected: re-transfers entities the client already has every time a user goes one level deeper; delta files avoid that at the cost of a cheap client-side merge.

## Consequences

- `packages/shared-types/src/data/` gains 4 delta files per lane per locale (e.g. `people.detail1.json` … `people.detail4.json`), replacing the `<lane>.tier0.json`/`<lane>.tier1.json` pairs.
- `packages/web/CLAUDE.md`'s "Payload Tier's Tier 0/Tier 1" framing and `docs/config-variables.md` need updating to the 4-level loading scheme when this is implemented.
- `packages/web/docs/adr/0010-search-stays-inside-active-filters-and-payload-tiers.md` pre-dates this merge and still uses "Payload Tier" — its substance (Search never reaches past what's loaded) is unchanged, but its framing of that as a race between two independent mechanisms no longer applies now that they're one.
