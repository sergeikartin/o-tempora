# Same Sky

A read-only, continuously zoomable visualization of world history — People, Wars & Conflicts, and Events & Inventions lanes, hardcoded ahead of time.

## Language

**Conflict Category**:
The Wikidata-?type-claim-derived classification for Wars & Conflicts entries (`War`/`WarEvent.category`) — `war, battle, siege, military-operation, revolution, rebellion, coup-d-etat, war-of-independence, peace-treaty`. Wars & Conflicts-only; Events & Inventions has its own separate `Discovery Category` (below). Drives the Conflict Category Palette in `packages/web/docs/design-tokens.md`.
_Avoid_: Category (bare — ambiguous with Discovery Category), occupation domain, tag, type (for this specific field)

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

**Fame Tier**:
One of three nested named density thresholds on an entry's `fameScore` — `generalPublic` (narrowest/most-famous-only) ⊂ `educated` ⊂ `specialist` (broadest), one threshold table per lane in `packages/data-pipeline/src/transform/score.ts`. Also the zoom-coupled concept driving the viewport: zooming out/in crosses Fame Tier thresholds automatically (CORE/NOTABLE/EXHAUSTIVE are the UI's display labels for `generalPublic`/`educated`/`specialist` respectively, at 500↔150y/150↔50y/50↔10y — `packages/web/docs/adr/0002-fame-tier-drives-zoom.md`), not user-selected.
_Avoid_: Fame filter, frame tier, zoom tier
