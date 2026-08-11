Labels: done

# Rename lanes to People, Conflicts, Milestones

## Problem Statement

Lane naming was inconsistent across the codebase: the display name "Wars & Conflicts" coexisted with a `ConflictCategory` field (not `WarCategory`) on the `War`/`WarEvent` types; the display name "Events & Inventions" coexisted with `discoveries` as the pipeline's canonical internal name (`Discovery`, `discoveries.json`, `--lane=discoveries`) while the fetch stage and curated source file still said `events` (`fetchEventsEnrichment`, `events-curated.raw.json`) — itself tracked as a separate pending rename (`.scratch/discoveries-file-rename/spec.md`).

## Decision

Consolidate on three canonical, single-word lane names used everywhere — UI copy, CLI, types, files, identifiers:

- **People** (unchanged)
- **Conflicts** (was "Wars & Conflicts" / `wars` / `War`)
- **Milestones** (was "Events & Inventions" / `discoveries` / `events` / `Discovery`)

Settled via a grilling session (see decisions below); executed in the same session rather than deferred.

## Scope

Full rename, not vocabulary-only:

- CLI: `--lane=wars`→`--lane=conflicts`, `--lane=discoveries`→`--lane=milestones`
- Types: `War`→`Conflict`, `WarEvent`→`ConflictEvent`, `WarsAndConflictsEntry`→`ConflictEntry`, `Discovery`→`Milestone`, `DiscoveryCategory`→`MilestoneCategory`. `ConflictCategory` unchanged (already correctly named), including its `"war"` enum value — that's a taxonomy value describing a kind of conflict, unrelated to the type/lane rename.
- Files: curated/enriched/output data files, React lane components, fetch stages, query builders, transform modules — all renamed following the same pattern (see commit for the full mapping).
- Identifiers riding along with the file renames: `buildWars`→`buildConflicts`, `mapWars`→`mapConflicts`, `CuratedEvent`/`EnrichedEvent`/`fetchEventsEnrichment`→ their `Milestone` equivalents, the `'war'` entity-type discriminator string → `'conflict'`, etc.

## Out of Scope

- **History stays as-written**: the 12 pre-existing ADRs are not edited — they document decisions made under the vocabulary of their time. This effort adds one new ADR instead (`packages/data-pipeline/docs/adr/0013-rename-lanes-to-conflicts-and-milestones.md`) recording the consolidation.
- Other historical `.scratch/*` specs/issues are left as-written for the same reason, **except** `.scratch/discoveries-file-rename/spec.md`, which is superseded by this effort (its target rename never executed, and this effort supersedes it with the `milestones` name directly rather than the intermediate `discoveries` name).

## Further Notes

Grilled via `/mattpocock-skills:grill-with-docs` — see conversation for the full decision tree (six questions: execution scope, `War`→`Conflict`/`WarEvent`→`ConflictEvent` cascade, `Discovery`→`Milestone` cascade, ampersand-alias retirement, ADR historical treatment, `WarsAndConflictsEntry`→`ConflictEntry` union naming).
