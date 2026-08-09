Type: grilling
Status: resolved
Blocked by: 01

## Question

Using the sidebar prototype (ticket 01 in `sidebar-filters-legend`) as the concrete artifact to react to, run a `/grilling` + `/domain-modeling` session to lock the final interaction design:

- Final control type, bounds, step, and default per lane's Fame-floor filter.
- Final legend pill treatment (does anything besides color+label appear, e.g. a count).
- Confirm removal of the zoom-coupled Fame Tier machinery for end users (`fameTierForViewport`, `FAME_TIER_YEAR_BOUNDS`, the `fameTierIndicator` span) — anything from it worth keeping (e.g. the `FAME_TIER_*` numeric tables themselves, as reference/preset values on the new sliders) vs. deleting outright.

Record the outcome as `packages/web/docs/adr/0003-manual-fame-filter-replaces-zoom-tier.md`, following the `0001`/`0002` format, explicitly superseding `0002-fame-tier-drives-zoom.md`.

## Answer

No `/grilling` session run — the user redirected to `/implement` directly (see ticket 01's Answer). The ADR was still written, at `packages/web/docs/adr/0003-manual-fame-filter-replaces-zoom-tier.md`, with `0002-fame-tier-drives-zoom.md` marked `status: superseded`. Its content answers this ticket's three questions:

- Control type/bounds/step/default per lane: settled inline during implementation, not through a grilling session — see ticket 01's Answer.
- Legend pill treatment: color swatch + label only, no count.
- Zoom-coupled Fame Tier machinery: removed outright, not kept as slider presets — `FameTierName`/`FAME_TIER_YEAR_BOUNDS`/`FAME_TIER_MIN_HPI`/`FAME_TIER_MIN_SITELINKS_WARS`/`FAME_TIER_MIN_SITELINKS_DISCOVERIES` and `fameTierForViewport`/`fameTierForVisibleYears` are all deleted from `packages/web`; see the ADR's Considered Options for why.

## Comments
