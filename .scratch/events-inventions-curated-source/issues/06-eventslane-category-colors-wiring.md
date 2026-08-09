# 06 — Wire DiscoveryCategory colors into EventsLane

Type: task
Status: resolved
Blocked by: 01, 03

## Question

Update `CATEGORY_COLORS` (`packages/web/src/widgets/timeline-canvas/options.ts:108-117`) to key off the locked palette from ticket "01 — Prototype: DiscoveryCategory color palette" for the 10 `DiscoveryCategory` values, and drop the old `"invention"` entry (Wars & Conflicts keeps its 7 remaining `Category` colors, from ticket "03 — Split Category into Category (Wars) + DiscoveryCategory").

`EventsLane.tsx` already reads `CATEGORY_COLORS[item.category]` (line 66) generically — confirm the type change from `Category` to `DiscoveryCategory` flows through `map-to-items.ts`'s `mapDiscoveries` cleanly with no other code assuming the old shared type.

## Answer

Added a new `DISCOVERY_CATEGORY_COLORS: Record<DiscoveryCategory, string>` in `options.ts` (separate table, not a merge into `CATEGORY_COLORS`) with ticket 01's locked hexes; dropped `invention` from `CATEGORY_COLORS`. `EventsLane.tsx` now imports and reads `DISCOVERY_CATEGORY_COLORS` instead. `map-to-items.ts`'s `DiscoveryItem.category` retyped to `DiscoveryCategory` — flowed through cleanly, `WarsLane.tsx`/`WarItem` untouched (still `Category`). Verified visually in the running app: all 121 points render in distinct colors.
