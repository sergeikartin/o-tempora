Type: prototype
Status: resolved

## Question

Build a throwaway prototype (via `/prototype`) of the sidebar to react to, covering:

- **Placement & structure**: where the sidebar sits relative to `TimelineCanvas` (left/right, fixed width), and how the Legend and Filters sections are arranged within it.
- **Legend pills**: visual treatment of the 8 `OccupationDomain` pills (color swatch + label), styled so a later click-to-filter pass is a cheap addition (see the map's "Not yet specified" — not built now, just not precluded).
- **Filter controls**: control type per lane for setting the raw-`fameScore` floor — slider vs. stepper vs. plain number input — and how bounds/step/default are surfaced to the user. Use the map's Notes table (real min/max/median per lane) to pick realistic ranges; default should render today's CORE-tier values (90 / 100 / 200).
- Whether/how the removed `fameTierIndicator` real estate next to the zoom buttons is repurposed or just goes away.

Output: a working rough UI (per `/prototype`'s usual artifact), linked as an asset from this ticket's resolution.

## Answer

Not built as a throwaway `/prototype` — the user redirected straight to `/implement` (skipping this ticket and ticket 02's `/grilling` session both) after being asked whether to prototype first or grill without one. Implemented directly instead, deciding these open questions inline without a reactable artifact:

- **Placement/structure**: fixed 220px-wide `<aside>` to the left of `TimelineCanvas`, full viewport height, own `overflow-y: auto`; Legend section above Filters section.
- **Legend pills**: rounded-full chip (`border-radius: var(--radius-full)`) containing a small circular color swatch + label text, `<li>` not `<button>` (no click handler yet, but the shape is the one a future click affordance would reuse).
- **Filter controls**: plain `<input type="number">` per lane (not slider/stepper) — most direct read of "directly settable... numeric floor." `min`/`max` from the map's real per-lane ranges, `step={1}`, defaulting to the CORE-tier values (90/100/200).
- **Removed `fameTierIndicator` real estate**: goes away, nothing repurposed it.

See `packages/web/src/widgets/sidebar/` (Legend + composition), `packages/web/src/features/filter-by-fame-score/` (filter state + controls), and `packages/web/docs/adr/0003-manual-fame-filter-replaces-zoom-tier.md`.

## Comments
