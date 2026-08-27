# 03 — Retire manual fame-score inputs from production UI

**What to build:** Remove the raw per-lane numeric Fame Score floor inputs from the production sidebar UI — with the 4-level Detail Level switch from ticket 02 in place, they're no longer the only way to reach a non-default floor and are kept only as a dev convenience. Replace them with a function callable from the browser dev console that sets the same raw per-lane floors directly, for local debugging/QA. The console function must not ship in the production bundle.

Since there is no longer any production UI path to an off-preset value, the segmented control's "custom/unmatched" display state (shown today when a hand-edited value doesn't match any preset) has no remaining production code path and should be removed rather than kept dead.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Manual numeric floor inputs are no longer present anywhere in the production UI
- [ ] A dev-console-callable function sets arbitrary per-lane Fame Score floors and immediately re-filters the rendered dataset, available in local/dev builds
- [ ] The console function and any code that exists solely to support it are excluded from the production bundle (verify via a production build, not just dev server behavior)
- [ ] The segmented control never renders a "custom/unmatched" state in production — it always shows one of the 4 levels
- [ ] The 4 levels remain fully reachable via the production UI after this change (no regression from ticket 02)
