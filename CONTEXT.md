# Same Sky

A read-only, continuously zoomable visualization of world history — People, Wars & Conflicts, and Events & Inventions lanes, hardcoded ahead of time.

## Language

**Conflict Category**:
The curator-assigned classification for Wars & Conflicts entries (`War`/`WarEvent.category`) — `war, war-of-independence, revolution, rebellion, coup-d-etat, military-operation`. Assigned by the curator at `data/raw/wars-curated.raw.json` authoring time, not derived from a Wikidata `?type` claim (see **Container** below for how the lane is sourced). Wars & Conflicts-only; Events & Inventions has its own separate `Discovery Category` (below). Drives the Conflict Category Palette in `packages/web/docs/design-tokens.md`. Does not determine `War` vs. `WarEvent` shape — see **Container**.
_Avoid_: Category (bare — ambiguous with Discovery Category), occupation domain, tag, type (for this specific field)

**Container**:
A top-level, parent-less curated `War` that other Wars & Conflicts rows nest under via the optional `parentId` field (on both `War` and `WarEvent`, always resolving to another row's `id`, which is always a `War`) — e.g. the Napoleonic Wars containing the Peninsular War as a real, independently-curated entity rather than a free-text label. Nesting is capped at 3 levels (Container → level 2 → level 3) and validated at Output (`buildWars` in `write-datasets.ts`); a violation drops the offending row rather than publishing it. `War` vs. `WarEvent` shape is itself decoupled from `Conflict Category` and from curator input — decided at Output by whether the row's Wikidata enrichment resolved both a start and an end date (`War`) or only one (`WarEvent`); a row resolving no date at all is dropped. See `.scratch/wars-curated-source/spec.md` and `packages/data-pipeline/docs/adr/0009-wars-sourced-from-curated-list-plus-container-nesting.md`.
_Avoid_: parent war, umbrella war/conflict (for this specific mechanism — use Container)

**Discovery Category**:
Events & Inventions' own curator-assigned taxonomy — `science-theory, medicine-health, communication, transportation, infrastructure, everyday-technology, food-agriculture, exploration, energy-industry, society-administration`. A separate enum from Conflict Category — disjoint source (hand-curated, not a Wikidata `?type` claim) and disjoint values, even where a name happens to coincide (`exploration` appears in both, independently).
_Avoid_: Category (bare), conflict category (for this specific field)

**Occupation Domain**:
Pantheon 2.0's own occupation grouping for People entries — `sports, institutions, arts, humanities, science-technology, business-law, public-figure, exploration`. A separate enum from both Conflict Category and Discovery Category, sourced from Pantheon rather than Wikidata; not interchangeable with Discovery Category even though one value (`exploration`) happens to share a name with it. Drives the Occupation Domain Palette in `packages/web/docs/design-tokens.md`.
_Avoid_: Category, occupation category, conflict category, discovery category (for this specific field)

**Lifespan** (rendering context):
A Person's birth-death range bar on the People lane's timeline — the visual object built from `Person.startYear`/`endYear` in `map-to-items.ts`'s `mapPeopleToItems`. Distinct from `TimelineEntry`'s general start/end range shape, which every lane (People, Wars & Conflicts, Events & Inventions) shares.

**Reign Period**:
A sub-segment of a Person's lifespan bar marking a qualified position held (Wikidata P39 with dated qualifiers) — monarchs, elected heads of state/government, etc. Rendered as an overlay inside the parent lifespan bar (shared `subgroup`), not a separate timeline row. A person can have more than one (e.g. deposed and restored).
_Avoid_: Reign, position (on its own, when the timeline-rendering sense is meant)

**Fame Score**:
`TimelineEntry.fameScore` — the numeric field driving each lane's manual UI filter floor (`FAME_SCORE_BOUNDS`/`FameScoreFilters`). Computed independently per lane, never blended across lanes: People uses raw Pantheon HPI (0–100); Wars & Discoveries use a log-normalized blend of Wikidata sitelinks and Wikimedia pageviews, one shared 0–100 scale across both lanes (`packages/data-pipeline/docs/adr/0010-blend-sitelinks-and-pageviews-for-wars-discoveries-fame-score.md`). Never drives zoom, marker size, or z-order — see Fame Tier below.
_Avoid_: Importance score, significance score, popularity score

**Fame Tier**:
Named threshold levels on Fame Score — `generalPublic` (narrowest/most-famous-only) ⊂ `educated` ⊂ `specialist` (broadest). Now exists only in the pipeline, as `FAME_TIER_MIN_HPI` gating which People rows ship at all (specialist floor, hpi≥75); Wars & Discoveries have no floor-filtering, every curated row ships. Not zoom-coupled and not surfaced as discrete tiers in the UI — that automatic mechanism (`packages/web/docs/adr/0002-fame-tier-drives-zoom.md`) was replaced by a continuous per-lane manual filter slider (`packages/web/docs/adr/0003-manual-fame-filter-replaces-zoom-tier.md`).
_Avoid_: Fame filter, frame tier, zoom tier
