# Same Sky

A read-only, continuously zoomable visualization of world history — People, Wars & Conflicts, and Events & Inventions lanes, hardcoded ahead of time.

## Language

**Category**:
The Wikidata-derived classification for Wars & Conflicts and Events & Inventions entries — `science, politics, art, philosophy, war, invention, exploration, religion`. Drives the Occupation Category Palette in `packages/web/docs/design-tokens.md`.
_Avoid_: Occupation domain, tag, type (for this specific field)

**Occupation Domain**:
Pantheon 2.0's own occupation grouping for People entries — `sports, institutions, arts, humanities, science-technology, business-law, public-figure, exploration`. A separate enum from `Category`, sourced from Pantheon rather than Wikidata; not interchangeable with it even though one value (`exploration`) happens to share a name. Drives the Occupation Domain Palette in `packages/web/docs/design-tokens.md`.
_Avoid_: Category, occupation category (for this specific field)

**Lifespan** (rendering context):
A Person's birth-death range bar on the People lane's timeline — the visual object built from `Person.startYear`/`endYear` in `map-to-items.ts`'s `mapPeopleToItems`. Distinct from `TimelineEntry`'s general start/end range shape, which every lane (People, Wars & Conflicts, Events & Inventions) shares.

**Reign Period**:
A sub-segment of a Person's lifespan bar marking a qualified position held (Wikidata P39 with dated qualifiers) — monarchs, elected heads of state/government, etc. Rendered as an overlay inside the parent lifespan bar (shared `subgroup`), not a separate timeline row. A person can have more than one (e.g. deposed and restored).
_Avoid_: Reign, position (on its own, when the timeline-rendering sense is meant)
