# Same Sky

A read-only, continuously zoomable visualization of world history — People, Conflicts, and Milestones lanes, hardcoded ahead of time.

## Language

**Conflict Category**:
The curator-assigned classification for Conflicts entries (`Conflict`/`ConflictEvent.category`) — `war, war-of-independence, revolution, rebellion, coup-d-etat, military-operation`. Assigned by the curator at `data/raw/conflicts-curated.raw.json` authoring time, not derived from a Wikidata `?type` claim (see **Container** below for how the lane is sourced). Conflicts-only; Milestones has its own separate `Milestone Category` (below). No longer drives a color — the timeline's merged Conflicts+Milestones lane renders every Conflict in one flat color instead (`CONFLICT_COLOR` in `packages/web/src/widgets/timeline-canvas/options.ts`; the old Conflict Category Palette this field used to drive is retired, see `packages/web/docs/design-tokens.md`), so a Conflict still reads as one visual group next to Milestones' own multi-color palette. Does not determine `Conflict` vs. `ConflictEvent` shape — see **Container**.
_Avoid_: Category (bare — ambiguous with Milestone Category), occupation domain, tag, type (for this specific field)

**Container**:
A top-level, parent-less curated `Conflict` that other Conflicts rows nest under via the optional `parentId` field (on both `Conflict` and `ConflictEvent`, always resolving to another row's `id`, which is always a `Conflict`) — e.g. the Napoleonic Wars containing the Peninsular War as a real, independently-curated entity rather than a free-text label. Nesting is capped at 3 levels (Container → level 2 → level 3) and validated at Output (`buildConflicts` in `write-datasets.ts`); a violation drops the offending row rather than publishing it. `Conflict` vs. `ConflictEvent` shape is itself decoupled from `Conflict Category` and from curator input — decided at Output by whether the row's Wikidata enrichment resolved both a start and an end date (`Conflict`) or only one (`ConflictEvent`); a row resolving no date at all is dropped. See `.scratch/wars-curated-source/spec.md` and `packages/data-pipeline/docs/adr/0009-wars-sourced-from-curated-list-plus-container-nesting.md`.
_Avoid_: parent war, umbrella war/conflict (for this specific mechanism — use Container)

**Tagline**:
A Person/Conflict/ConflictEvent/Milestone's short Wikidata `schema:description` claim (`TimelineEntry.tagline`) — one line, e.g. "American physicist". Required for publish: an entity with no resolvable Tagline is dropped (`write-datasets.ts`). Live-fetched per-QID via Wikidata SPARQL for all three lanes, including Milestones (previously curator-authored only) — no curated-text fallback, the same convention People/Conflicts already used. Rendered in `DetailPanel` as the subtitle under the entity name.
_Avoid_: Description (this field's old, pre-split name), subtitle, blurb

**Description**:
A Person/Conflict/ConflictEvent/Milestone's Wikipedia lead-paragraph prose (`TimelineEntry.description`) — fetched live from Wikipedia's REST summary API `extract` for the entity's English Wikipedia article, English-only, uncapped length. Optional: absent when no English Wikipedia article resolves, in which case `DetailPanel` renders **Tagline** alone. Distinct from Tagline, which is a short Wikidata subtitle, not prose — the two are separate fields, not a fallback pair.
_Avoid_: Summary, extract, blurb (bare — ambiguous with Tagline)

**Milestone Category**:
Milestones' own curator-assigned taxonomy — `science-theory, medicine-health, communication, transportation, infrastructure, everyday-technology, food-agriculture, exploration, energy-industry, society-administration`. A separate enum from Conflict Category — disjoint source (hand-curated, not a Wikidata `?type` claim) and disjoint values, even where a name happens to coincide (`exploration` appears in both, independently).
_Avoid_: Category (bare), conflict category (for this specific field), Discovery Category (this field's old, pre-rename name)

**Occupation Domain**:
Pantheon 2.0's own occupation grouping for People entries — `sports, institutions, arts, humanities, science-technology, business-law, public-figure, exploration`. A separate enum from both Conflict Category and Milestone Category, sourced from Pantheon rather than Wikidata; not interchangeable with Milestone Category even though one value (`exploration`) happens to share a name with it. Drives the Occupation Domain Palette in `packages/web/docs/design-tokens.md`.
_Avoid_: Category, occupation category, conflict category, milestone category (for this specific field)

**Lifespan** (rendering context):
A Person's birth-death range bar on the People lane's timeline — the visual object built from `Person.startYear`/`endYear` in `map-to-items.ts`'s `mapPeopleToItems`. Distinct from `TimelineEntry`'s general start/end range shape, which every lane (People, Conflicts, Milestones) shares.

**Fame Score**:
`TimelineEntry.fameScore` — the numeric field driving each lane's manual UI filter floor (`FAME_SCORE_BOUNDS`/`FameScoreFilters`) and each lane's vertical row position (`assignRows` in `map-to-items.ts`, processed fame-descending rather than chronologically): the highest-fame items land in row 0, which each lane then places at whichever of its edges sits against the shared Year Axis — the bottom of People, the top of the merged Conflicts+Milestones lane — so importance radiates outward from that axis in both directions. Computed independently per lane, never blended across lanes: People uses raw Pantheon HPI (0–100); Conflicts & Milestones use a log-normalized blend of Wikidata sitelinks and Wikimedia pageviews, one shared 0–100 scale across both lanes (`packages/data-pipeline/docs/adr/0010-blend-sitelinks-and-pageviews-for-wars-discoveries-fame-score.md`) — that shared scale is what lets Conflicts and Milestones compete directly for the same rows in the merged lane. Still never drives zoom or marker size, and row position is a distinct concern from z-order (which element paints on top when two things visually overlap at the same spot) — see Fame Tier below.
_Avoid_: Importance score, significance score, popularity score

**Lane**:
One of the three top-level content tracks — People, Conflicts, Milestones — each with its own fetch/score/tag/output path (`packages/data-pipeline/docs/adr/0001-wars-discoveries-people-separate-lanes.md`). Consolidated from the earlier "Wars & Conflicts"/"Events & Inventions" display names and their mismatched internal names (`wars`/`discoveries` CLI values, `events-curated.raw.json`, `fetchEventsEnrichment`) onto one canonical name per lane, used everywhere — UI copy, `fetch`'s `--lane=<value>` CLI selector (`people`/`conflicts`/`milestones`), types, and file names (`packages/data-pipeline/docs/adr/0013-rename-lanes-to-conflicts-and-milestones.md`). The timeline's display layer renders Conflicts and Milestones together in one mixed, fame-ranked visual row (`ConflictsMilestonesLane`) — a rendering-only grouping, not a fourth Lane or a merge of the two: each keeps its own fetch/score/tag/output path above unchanged.
_Avoid_: track, Wars & Conflicts, Events & Inventions, wars, discoveries, events (as a lane name)

**Fame Tier**:
Named threshold levels on Fame Score — `generalPublic` (narrowest/most-famous-only) ⊂ `educated` ⊂ `specialist` (broadest). Now exists only in the pipeline, as `FAME_TIER_MIN_HPI` gating which People rows ship at all (specialist floor, hpi≥75); Conflicts & Milestones have no floor-filtering, every curated row ships. Not zoom-coupled and not surfaced as discrete tiers in the UI — that automatic mechanism (`packages/web/docs/adr/0002-fame-tier-drives-zoom.md`) was replaced by a continuous per-lane manual filter slider (`packages/web/docs/adr/0003-manual-fame-filter-replaces-zoom-tier.md`).
_Avoid_: Fame filter, frame tier, zoom tier
