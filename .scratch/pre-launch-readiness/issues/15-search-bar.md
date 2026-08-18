Type: task
Status: open

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
