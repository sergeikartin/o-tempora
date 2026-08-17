Type: task
Status: done

# Rename Mountain Profile to Minimap

## What to build

"Mountain Profile" is renamed to "Minimap" project-wide (resolved via `/grill-with-docs`, reversing the earlier naming decision in ADR 0004 — see `CONTEXT.md`'s Minimap entry for the current-truth definition). This is a mechanical rename, not a behavior change.

- [x] `packages/web/src/widgets/timeline-canvas/MountainProfile.tsx` → `Minimap.tsx`, `MountainProfile.module.css` → `Minimap.module.css`, `mountain-profile.ts` → `minimap.ts`, and their test files (`MountainProfile.test.tsx`, `mountain-profile.test.ts`).
- [x] Internal identifiers renamed (e.g. `MOUNTAIN_PROFILE_BUCKET_COUNT` → `MINIMAP_BUCKET_COUNT`), CSS class names, and all in-repo references in `TimelineCanvas.tsx`, `map-to-items.ts`, `TimelineCanvas.module.css`, `global.css`, and their tests.
- [x] Remaining doc references updated: `docs/product-scope.md` ("Mountain Profile omitted" on mobile), `.scratch/mobile-responsive-layout/spec.md`, `.scratch/zoom-filter-transitions/spec.md` and its `03-reduced-motion-and-final-verification.md` issue, `.scratch/pre-launch-readiness/issues/01-hover-indicator-redesign.md`, `packages/web/docs/adr/0006-css-animation-scope-and-detail-panel-always-mounted.md`, `0007-static-row-assignment-replaces-live-per-render-packing.md`, `0008-mobile-layout-reuses-zoom-animation-and-splits-breakpoint-from-input-capability.md`.
- [x] `CONTEXT.md` and ADR 0004 are already updated (done in the grilling session that produced this ticket) — no further doc changes needed there.
- [x] `npm run typecheck --workspace packages/web`, `npm run test --workspace packages/web`, and `npm run lint --workspace packages/web` pass after the rename.

Implemented. Also fixed an incidental staleness found along the way: ADR 0004's "Consequences" section cited `PAN_MIN_DATE = -2750`, but the real value in `packages/web/src/shared/config/viewport.ts` is `-801` — corrected to point at the source file instead of hardcoding a number that will drift again.
