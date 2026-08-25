Type: task
Status: resolved

# Search bar

## Question

No search exists anywhere in the app today — all filtering is toggle-pill lists (`RegionFilters`, `OccupationDomainFilters`, `ConflictsMilestonesFilters`, `FameScoreFilters`), composed in `packages/web/src/widgets/sidebar/ui/Sidebar.tsx`. There's no text-input search component to reuse; this would be a new pattern.

`docs/product-scope.md` lists "search outside the current Fame Tier" as out of scope for v1 — implying search *within* the current Fame Tier is plausibly in scope, but this hasn't been spec'd. Open questions before implementation:

- Scope: search by name only, or also by other fields (occupation, conflict/milestone title)?
- Which lanes: People only, or People + Conflicts + Milestones?
- Does it respect (AND with) the existing region/occupation/fame-tier filters, or search independently of them?
- Result behavior: jump/pan the timeline to the match, highlight it in place, or list results for the user to pick from?
- Placement: in the sidebar alongside the filter pills, or elsewhere (e.g. a top bar)?

Tracked as a `task` per the map's Notes since the destination wants an exhaustive punch list, even though the scope questions above need resolving before a spec is implementation-ready.

## Answer

Resolved via `/grill-with-docs`.

**Scope**: Search respects every active filter — Data Depth's fame-score floor, Region, Occupation Domain, and the Conflicts & Milestones category filter — so it only ever surfaces entries already permitted by the current view, never a way to look beyond them (matches `docs/product-scope.md`'s "search outside the current Data Depth/fame-score floor" exclusion). It matches Name + Tagline only (not the long-form Description), as a case-insensitive substring, against whichever text the active Locale displays (i.e. Field Fallback's resolved value, never cross-locale). No entity has an aliases/alternate-name field — "WWII" won't find "World War II" — accepted as a known v1 gap rather than adding curated aliases to the pipeline. Search reads whatever's already loaded (Tier 0 always, Tier 1 only if it's arrived) and never force-triggers the deferred Tier 1 fetch, so results can be incomplete on a slow connection by the same design as `docs/adr/0004-payload-tier-split-defers-low-fame-data.md`.

**Lanes**: One unified search box covers all three lanes at once — People + Conflicts + Milestones — not a per-lane control.

**UI**: New text-input pattern (none exists in the app today), placed inside the Sidebar (desktop) / filter drawer (mobile), above the filter pills. Typing drives a live typeahead dropdown, capped at ~8-10 results total across all three lanes combined (not per lane), ranked purely by Fame Score, each row labeled by Lane with the matched substring bolded. Arrow-up/down + Enter navigate and select; no global keyboard shortcut to focus the box. On mobile, picking a result auto-closes the filter drawer. The input clears after a result is picked.

**Result behavior**: Picking a result is treated exactly like clicking its rendered mark directly — pans the timeline to center it (reusing the existing `handleTrackJump` eased-scroll mechanism in `TimelineCanvas.tsx`, pan-only, current zoom level unchanged — no zoom-to-fit) and opens `DetailPanel`. The mark gets the existing hover-style visual treatment (`--color-accent-selected`), tied to selection state rather than a timer, clearing when a different entity is selected. No URL/permalink change — stays session-only, consistent with the existing `useSelectedEntity` state and `product-scope.md`'s exclusion of deep-linking.
