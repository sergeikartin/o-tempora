---
status: accepted
---

# Rename lanes to People, Conflicts, and Milestones — one canonical name per lane, everywhere

The display names "Wars & Conflicts" and "Events & Inventions" had drifted from their own internal naming: `ConflictCategory` (not `WarCategory`) already lived on the `War`/`WarEvent` types, and the pipeline's canonical internal name for the third lane was `discoveries` (`Discovery`, `discoveries.json`, `--lane=discoveries`) while its fetch stage and curated source file still said `events` (`fetchEventsEnrichment`, `events-curated.raw.json`, ADR 0012) — a rename that effort deliberately deferred to `.scratch/discoveries-file-rename/spec.md`.

Rather than layer another display-only rename on top of that inconsistency, this consolidates on three canonical, single-word lane names — People (unchanged), Conflicts, Milestones — used identically everywhere: UI copy, the `fetch --lane=<people|conflicts|milestones>` CLI selector, TypeScript types (`War`→`Conflict`, `WarEvent`→`ConflictEvent`, `WarsAndConflictsEntry`→`ConflictEntry`, `Discovery`→`Milestone`, `DiscoveryCategory`→`MilestoneCategory`), curated/enriched/output data files, and every identifier riding along with those (`buildWars`→`buildConflicts`, `fetchEventsEnrichment`→`fetchMilestonesEnrichment`, etc.). `ConflictCategory` itself is unchanged — it was already correctly named — including its `"war"` enum value, which describes a kind of conflict, not the lane.

Executing the full rename in one pass also resolves the `events`-vs-`discoveries` fetch-stage inconsistency ADR 0012 deferred: `events-curated.raw.json` becomes `milestones-curated.raw.json` directly, skipping the never-executed intermediate `discoveries-curated.raw.json` name. `.scratch/discoveries-file-rename/spec.md` is superseded by this effort rather than executed.

## Consequences

Every pre-existing ADR (0001–0012) is left as-written — they document decisions made under the vocabulary of their time, and rewriting them would erase that record. Readers hitting `War`/`Discovery`/`wars.json` in an old ADR should treat those as historical names for what this ADR renames to `Conflict`/`Milestone`/`conflicts.json`. `.scratch/*` specs and issues predating this rename are left as-written for the same reason — historical record, not living documentation.

The `ConflictCategory` value `"war"` and historical Wikidata entity names in code comments (e.g. "Wars of the Roses", "War of the Austrian Succession") are unaffected — they're domain data and proper nouns, not the renamed lane vocabulary.

This is a breaking change to the pipeline's own CLI and file layout (`--lane=wars`/`--lane=discoveries` no longer valid; `wars.json`/`discoveries.json` no longer produced). No backward-compatible aliases were added — the pipeline has no external consumers beyond this monorepo, and every call site was updated in the same change.
