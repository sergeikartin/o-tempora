Type: grilling
Status: resolved

## Question

Should the Output stage keep writing one merged `events.json` (Wars & Conflicts + Events & Inventions, as it does today), or split into two separate output files?

## Answer

Split into two files: `wars.json` (Wars & Conflicts) and `discoveries.json` (renamed from Events & Inventions / `events.json` — the lane itself is now called "Discoveries & Inventions", since "events" no longer distinguishes it once wars have their own file). Both continue to use the same `HistoricalEvent` type — this is an Output-stage file-splitting-and-renaming decision, not a type split; `partOfWarName` simply stays unpopulated for Discoveries & Inventions entries as it already does today.

This simplifies the Transform stage: wars and inventions/events no longer merge at all, at any stage — each lane's raw snapshot flows through Score/Tag/Output independently. It also cleanly removes any risk of CDB90-sourced wars ever touching Events & Inventions data, since the two lanes never share a file or a merge step.

**Downstream impact flagged, not resolved here**: `packages/web` currently reads one `events.json`; it will need to read two files instead. That's a `packages/web` change, out of scope for this data-pipeline-focused map, same as the `OccupationDomain`/`UnRegion` filter UI and attribution credit page already flagged. `CLAUDE-decisions.md`'s documented storage model (`people.json`/`events.json`) also needs updating to reflect the new `wars.json` file, per the project's "update docs in the same unit of work" rule.

## Context

Raised directly against the spec after charting completed — not part of the original breadth-first frontier, but backed by the same map for traceability.
