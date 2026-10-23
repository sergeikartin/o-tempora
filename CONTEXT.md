# O Tempora

An interactive timeline of world history — People, Conflicts, and Milestones lanes, hardcoded ahead of time.

## Language

**Conflict Category**:
The curator-assigned classification of a Conflicts entry (`Conflict`/`ConflictEvent.category`) — `war, war-of-independence, revolution, rebellion, coup-d-etat, military-operation`. Set when the curated list (`data/raw/conflicts-curated.raw.json`) is authored, not derived from Wikidata. Conflicts-only; Milestones has its own **Milestone Category**. Drives no color: every Conflict renders in the flat `CONFLICT_COLOR` (`packages/web/src/shared/config/conflict-color.ts`; shared with the sidebar filter swatch, see `packages/web/docs/design-tokens.md`). Does not determine `Conflict` vs. `ConflictEvent` shape — see **Container**. Conflicts have no equivalent of **Milestone Category Group**: in the sidebar's Conflicts & Milestones filter, "Conflicts" is one pill alongside the 2 Milestone Category Group pills.
_Avoid_: Category (bare — ambiguous with Milestone Category), occupation domain, tag, type (for this specific field)

**Container**:
A top-level, parent-less curated `Conflict` that other Conflicts rows nest under via the optional `parentId` (on both `Conflict` and `ConflictEvent`, always resolving to a `Conflict` row's `id`) — e.g. the Napoleonic Wars containing the Peninsular War as its own curated entity. Nesting is capped at 3 levels (Container → level 2 → level 3), validated at Output (`buildConflicts` in `write-datasets.ts`); a violating row is dropped. `Conflict` vs. `ConflictEvent` shape is independent of **Conflict Category** and curator input: Output makes it a `Conflict` when Wikidata enrichment resolved both a start and an end date, a `ConflictEvent` when only one, and drops the row when none. See `.scratch/wars-curated-source/spec.md` and `packages/data-pipeline/docs/adr/0009-wars-sourced-from-curated-list-plus-container-nesting.md`.
_Avoid_: parent war, umbrella war/conflict (for this specific mechanism — use Container)

**Tagline**:
A Person/Conflict/ConflictEvent/Milestone's short Wikidata `schema:description` (`TimelineEntry.tagline`) — one line, e.g. "American physicist". Live-fetched per QID for all three lanes, with no curated-text fallback. Required for publish: an entity with no resolvable Tagline is dropped (`write-datasets.ts`). Rendered in `DetailPanel` as the subtitle under the entity name.
_Avoid_: Description (a different field), subtitle, blurb

**Description**:
A Person/Conflict/ConflictEvent/Milestone's Wikipedia lead-paragraph prose (`TimelineEntry.description`) — the `extract` of Wikipedia's REST summary API, fetched per **Locale** from `en.wikipedia.org` / `ru.wikipedia.org`, uncapped length. Optional: absent when no article resolves, in which case `DetailPanel` renders **Tagline** alone. Separate from Tagline, not a fallback for it.
_Avoid_: Summary, extract, blurb (bare — ambiguous with Tagline)

**Milestone Category**:
Milestones' own curator-assigned taxonomy — 22 leaf values (e.g. `science-theory`, `medicine-health`, `public-health`, `commerce-finance`; full list in `packages/shared-types/src/index.ts`'s `MilestoneCategory`). Disjoint from Conflict Category in source and values. Every value belongs to exactly one **Milestone Category Group**.
_Avoid_: Category (bare), conflict category (for this specific field), Discovery Category

**Milestone Category Group**:
The 2-value grouping above Milestone Category's 22 leaf values, driving the Milestones lane's color: `science-innovation` ("Science & Innovation": science-theory, medicine-health, communication, transportation, everyday-technology, food-agriculture, energy-industry) and `social-culture` ("Society & Culture": the other 15). Defined as `MilestoneCategoryGroup` + `MILESTONE_CATEGORY_TO_GROUP` in `packages/shared-types`, the one source read by both the lane's color mapping (`packages/web/src/widgets/timeline-canvas/options.ts`) and the sidebar's Conflicts & Milestones filter. That filter is one multi-select pill list (`ConflictsMilestonesFilterValue` in `packages/web/src/shared/config/conflicts-milestones-filter.ts`) spanning the 2 groups plus a UI-only `'conflicts'` value — the same "flat list, empty means unfiltered" shape as Region/Occupation Domain. See `docs/adr/0002-milestone-category-group-conflicts-blanket-toggle.md`.
_Avoid_: Category Group (bare — Milestones-only), Milestone Group

**Occupation Domain**:
Pantheon 2.0's occupation grouping for People entries — `sports, institutions, arts, humanities, science-technology, business-law, public-figure, exploration`. Separate from Conflict Category and Milestone Category; sourced from Pantheon, not Wikidata. Drives the Occupation Domain Palette in `packages/web/docs/design-tokens.md`. English display names: the sidebar section is "Occupation"; pills read Politics & Religion (`institutions`), Public Figures (`public-figure`), Arts, Business & Law, Science & Technology, Exploration, Humanities, Sports. The pills double as the filter: clicking one toggles that domain in/out of the People lane (multi-select, OR within the filter; none active means unfiltered).
_Avoid_: Category, occupation category, conflict category, milestone category (for this specific field), Legend (the pills are a filter, not a color key)

**Region** (filter):
The UN M49 geoscheme's 22 sub-regions (`northern-europe, southern-europe, eastern-europe, western-europe, eastern-asia, south-eastern-asia, southern-asia, central-asia, western-asia, northern-africa, western-africa, middle-africa, eastern-africa, southern-africa, northern-america, central-america, caribbean, south-america, australia-and-new-zealand, melanesia, micronesia, polynesia`) — one taxonomy shared by all three lanes (`Region[]` on every entity type). Conflicts and Milestones carry it as `regionTags`, resolved at enrichment time from each entity's country Q-ID(s), historical-polity-aware (a historical polity maps to the sub-region its territory is in today). People's tags come from Pantheon's birth/death country, i.e. present-day location rather than historical nationality. One control across all lanes. Multi-select, OR within the filter; none selected means unfiltered. An entity with no region tags (some Conflicts ship `regionTags: []`) is excluded whenever any region is selected.
_Avoid_: geography filter, area filter, macro-region/sub-region

**Mark**:
One entity's rendered visual item on the timeline, regardless of lane or date shape. A `Period` (`start`/optional `end`, e.g. `Person.lifespan`, `Conflict.period`) renders as a rounded-cap line; a `PointInTime` (`at`, e.g. `ConflictEvent`, a point-shaped `Milestone`) renders as a dot (`PERIOD_LINE_HEIGHT`/`POINT_RADIUS` in `packages/web/src/widgets/timeline-canvas/options.ts`). Both shapes share the same mechanics — a padded invisible hit area, a larger selected size, a selection/search-jump ring drawn as a wider duplicate underneath — and are targeted identically: `data-entity-id`/`data-entity-type` attributes for the delegated click listener (`TimelineCanvas.tsx`), and Search's "clicking its rendered mark". Which shape an entity gets is decided once at Output by what dates resolved (see **Container**), never by lane.
_Avoid_: Lifespan (that is `Person.lifespan`'s field name, not the rendered shape), marker (bare — reserved for the label-gap constants that use it literally, e.g. `MILESTONES_MARKER_LABEL_GAP`), item (too generic)

**Fame Score**:
`TimelineEntry.fameScore` — the numeric field behind each lane's fame floor (`FAME_SCORE_BOUNDS`/`FameScoreFilters`) and each lane's vertical row order (`assignRows` in `map-to-items.ts`, processed fame-descending): the highest-fame items land in row 0, which each lane places against the shared Year Axis (bottom of People, top of the merged Conflicts+Milestones lane), so importance radiates outward from the axis. Computed per lane, never blended across lanes: People use raw Pantheon HPI (0–100); Conflicts and Milestones use one shared 0–100 log-normalized blend of Wikidata sitelinks and Wikimedia pageviews (`packages/data-pipeline/docs/adr/0010-blend-sitelinks-and-pageviews-for-wars-discoveries-fame-score.md`), which lets them compete for the same rows. Never drives zoom or mark size; row position is distinct from z-order.
_Avoid_: Importance score, significance score, popularity score

**Lane**:
One of the three top-level content tracks — People, Conflicts, Milestones — each with its own fetch/score/tag/output path (`packages/data-pipeline/docs/adr/0001-wars-discoveries-people-separate-lanes.md`). One canonical name per lane everywhere: UI copy, `fetch`'s `--lane=<people|conflicts|milestones>`, types, file names (`packages/data-pipeline/docs/adr/0013-rename-lanes-to-conflicts-and-milestones.md`). The display layer renders Conflicts and Milestones together in one mixed, fame-ranked visual row (`ConflictsMilestonesLane`) — a rendering-only grouping, not a fourth Lane.
_Avoid_: track, Wars & Conflicts, Events & Inventions, wars, discoveries, events (as a lane name)

**Minimap**:
The log-scaled, mirrored-ridge area sparkline that replaces the timeline's scrollbar — People's **Row Depth** curve above a center baseline, Conflicts+Milestones' inverted below it, across the full pannable range (`PAN_MIN_YEAR` to present), so users see ahead of panning where a region needs many rows. Computed client-side from loaded lane data and recomputed as the fame floors change. Also the pan/zoom control: click jumps, dragging the viewport rectangle pans, hovering shows exact per-series Row Depth in a tooltip. A thin non-interactive strip of century ticks runs along its top edge, labels thinned once they would collide (`packages/web/docs/adr/0004-density-minimap-replaces-scrollbar.md`).
_Avoid_: Mountain Profile, density chart, sparkline (bare)

**Row Depth**:
The number of vertical rows a lane needs at a given point in time to render without overlap — `max(row index) + 1` among items covering it. Each item's row (`TimelineEntry.row`) is computed once by the pipeline's Output stage (`row-assignment.ts`'s `assignRows`) against the entire lane and shipped as data, not derived client-side (`docs/adr/0005-row-assignment-moves-to-the-pipeline.md`); `packages/web`'s `compactRows` only narrows it to what is currently visible. Drives both a lane's rendered height and, at the **Reference Scale**, the Minimap's per-series height.
_Avoid_: lane height (the pixel consequence), row count, stack depth

**Reference Scale**:
The fixed `pixelsPerYear` (`defaultPixelsPerYear()`, derived from `DEFAULT_VISIBLE_YEARS`) that Row Depth is packed against — decoupled from live zoom, so the Minimap reflects the default opening view rather than a worst case. Pipeline and web use the same scale: data-pipeline imports `REFERENCE_SCALE_PIXELS_PER_YEAR` from `packages/shared-types`; web derives its own copy via `defaultPixelsPerYear()`, with `options.test.ts` asserting the two are equal (`docs/adr/0005-row-assignment-moves-to-the-pipeline.md`).
_Avoid_: default zoom (the opening viewport itself), base scale

**Viewport Range**:
The span of years currently visible — from the year at the canvas's left edge to the one at its right edge — shown as the screen's primary heading (e.g. "1750 – 1850") and updated live while panning and zooming. The Minimap's viewport rectangle is this same span drawn over the full pannable range.
_Avoid_: current year, center year, hero year

**Locale**:
Which of the app's two languages — English (base, default) or Russian — a page load renders, resolved at runtime from the URL: `/` and `/timeline/` for English, `/ru/` and `/ru/timeline/` for Russian (Paraglide's `url` strategy, `packages/web/docs/adr/0009-runtime-locale-switch-replaces-per-locale-builds.md`). One build and one JS/CSS bundle serve both; the Locale selects the UI string catalog (`packages/web/messages/{en,ru}.json`) and which dataset files load (`people.detail1.json` vs. `people.detail1.ru.json`, see **Field Fallback** and **Detail Level**) via a locale-keyed dynamic import in `src/app/locale-datasets.ts`. No inline bilingual display. The two locales cross-link through the `Sidebar`'s language-switcher link, a full navigation to the sibling's same page kind that carries only the open **Entity Link**.
_Avoid_: language build, language mode, translation (bare)

**Field Fallback**:
The per-field rule the pipeline applies at Output when building a lane's Russian dataset files (`people.detail<N>.ru.json`, siblings of the English `people.detail<N>.json`): use the Russian `name`/`tagline`/`description` if the Wikidata/`ru.wikipedia.org` fetch resolved one, else the English value (`write-datasets.ts`'s `resolveField`/`resolveOptionalField`). Baked into the Russian file — `packages/web` never resolves a fallback. Row *inclusion* is decided earlier, once, off the English fetch results, so both language files always share the identical entity set; Field Fallback only changes which language's text fills an included row.
_Avoid_: translation fallback, default language, English fallback (as the primary term — the mechanism is per-field and general)

**Detail Level**:
A 4-position UI preset — `1 Legendary < 2 Mainstream < 3 Specialized < 4 Deep Cut` — that sets all three lanes' Fame Score floors (`FameScoreFilters`) at once and is also the pipeline's network-loading boundary: the same numbers (`DETAIL_LEVEL_FAME_SCORE_FLOORS` in `packages/shared-types`) drive both. `Mainstream` (People 88/Conflicts 82/Milestones 82) is the launch default; `Deep Cut` is 80/64/55. Floors step by a constant per-lane multiplicative factor on entity count, not on fame-score points. Each level ships as its own delta file per lane per locale, holding only the entities newly added versus the previous level (e.g. `people.detail3.json`). `packages/web` fetches levels 1+2 eagerly (gating first paint), idle-prefetches level 3, and fetches level 4 only on demand; fetched levels stay in memory when the user dials back. The segmented control labels each level by name; a fixed hint, "How much to show, most famous first.", sits under it as its accessible description, and the level's one-line description renders as helper text below. Raw numeric floors are not production UI — a dev-console-only override (`window.__setFameScoreFloors`) is stripped from production builds. See `docs/adr/0006-detail-level-merges-data-depth-and-payload-tier.md`.
_Avoid_: Data Depth, Payload Tier, Tier (bare), Fame Tier / Fame Level (an older zoom-gating mechanism, `packages/web/docs/adr/0003-manual-fame-filter-replaces-zoom-tier.md`), Curated/Expanded/Full and Core/Notable/Exhaustive (retired level names), chunk (bare — ambiguous with a Vite bundle chunk; say "delta file")

**Search**:
A live text query, matched case-insensitively as a substring against an entry's Name and Tagline in the active **Locale**, across all three Lanes. It narrows only within what the current **Detail Level** (floor and loaded data) and the Region, Occupation Domain and Conflicts & Milestones filters already permit — never a broader lookup (`docs/product-scope.md`; `packages/web/docs/adr/0010-search-stays-inside-active-filters-and-payload-tiers.md`, which predates the Detail Level merge and uses its old terms). Picking a result is equivalent to clicking its mark: pans and opens `DetailPanel`.
_Avoid_: filter (bare — Search narrows within the filters, it isn't one), lookup, autocomplete

**Landing Page**:
The short explanatory first page a cold visitor reaches at the root of each **Locale**: what the product is, one **Curiosity** drawn the way the timeline draws it with a row of others to switch between, and one button into the timeline. Separate from the timeline: arriving at the root never drops a visitor onto the timeline, and returning visitors are not redirected past it.
_Avoid_: home page (ambiguous with the language switcher), splash, intro, onboarding

**Slug**:
The readable identifier of one entity (`slug` on every Person, Conflict, ConflictEvent and Milestone), e.g. `cnut-the-great`. Lowercase ASCII derived from the English name, so both **Locale**s share it, and unique across all three lanes: of entities with the same name the most famous keeps the plain form and the rest get their id appended (`packages/data-pipeline/docs/adr/0020-entity-slugs-are-pipeline-assigned-and-unique-across-lanes.md`). It is what an **Entity Link** carries; the entity's `id` stays the internal key.
_Avoid_: permalink, handle, key (bare — ambiguous with `id`)

**Entity Link**:
A timeline URL that identifies one Person, Conflict, ConflictEvent or Milestone. Opening it brings the timeline to that entity and shows its details, as picking it in **Search** does, whichever **Detail Level** the visitor arrives at. Carries only the entity (`?e=<slug>`) — never a viewport, Detail Level or filter. Selecting an entity adds a history entry, closing the panel replaces it, and the language switch carries the slug to the sibling **Locale**. A slug missing from the loaded levels loads level 3, then level 4, raising the Detail Level only as far as that entity's Fame Score needs; a slug no level contains opens the timeline with no panel.
_Avoid_: deep link, permalink, share link, shareable state

**Curiosity**:
One hand-picked overlap the **Landing Page** shows: a sentence stating the coincidence, the lives, conflicts and milestones involved drawn as marks over a short stretch of axis, and an **Entity Link** to each of them the timeline can show. Every date is checked against the published dataset to the month, so a Curiosity never claims more than the data holds.
_Avoid_: starting point, example, demo, tour (curated narrated tours are out of scope), fun fact

**Help**:
The explanation a visitor can open at any time from inside the timeline, for those who skipped the **Landing Page** or are returning. Explains how to read the timeline in three plain points and what the marks mean, and hosts the links to About & data and the language switch. Always opened by the visitor — never appears on its own, and remembers nothing about whether it was seen.
_Avoid_: tutorial, onboarding, tour, coach marks, FAQ

**Empty Lane**:
A lane with no **Marks** in the current **Viewport Range**. Says why: filters hid everything (offers to clear them), or nothing exists at the current **Detail Level** in that period (offers the next level up; at the deepest level, says nothing is recorded). Shown only when the lane is completely empty, never for a merely sparse one.
_Avoid_: no results (that is **Search**'s own empty state), blank lane
