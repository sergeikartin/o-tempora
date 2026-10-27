# Panel loads shipped Profiles

Type: task
Status: resolved
Blocked by: 10

## What to build

Replace the prototype's `sample-profiles.ts` with the real per-entity fetch (`05-shipped-data-shape.md`). Behaviour: `spec.md` (Behaviour).

- [x] Selecting an entity whose row has `hasProfile` opens the panel at once at the wide Profile width (440px; the 80vh sheet on a phone) with name and tagline pinned and a quiet body placeholder, then fetches `profiles/<locale>/<slug>.json` and shows the Profile.
- [x] A failed fetch swaps in the Description and Tagline in the same wide panel.
- [x] Entities without `hasProfile` keep the Description panel.
- [x] `**bold**` renders as elements, never HTML.
- [x] `profiles/` is copied into `dist`; `docs/deployment.md` gains its cache headers.
- [x] `sample-profiles.ts` and its fixtures are removed.
- [x] A `web` ADR records the runtime fetch of static JSON on our own server; `packages/web/CLAUDE.md` no longer says there is no runtime data fetching.
- [x] Component tests cover placeholder, success and failure; `web` typecheck, lint and tests pass.
