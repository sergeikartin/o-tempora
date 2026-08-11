# 04 — Wire the Wikipedia extract through as the new optional `description` field

**What to build:** The actual user-facing payoff of this whole effort. The Wikipedia extract data produced by ticket 03 is threaded through the pipeline's transform and output stages, the shared type definitions, and the web app's detail panel — so that opening any person, war, or discovery in the running app shows a real paragraph of prose beneath its short tagline, wherever a Wikipedia article was found. `description` is optional throughout: its absence never causes an entity to be dropped, and the UI never shows a broken or empty section when it's missing.

**Blocked by:** 01 — Rename `description` → `tagline` everywhere; 03 — Wikipedia lead-extract fetch infrastructure

**Status:** resolved

- [x] Every entity in the published dataset carries an optional `description` field, populated with its Wikipedia lead-paragraph extract when one was resolved, and simply absent otherwise.
- [x] No entity is ever dropped from the published output solely because it lacks a `description` — only a missing `tagline` still causes a drop.
- [x] The detail panel shows `tagline` as a short subtitle under the entity's name, and — when present — `description` as a full paragraph of body text below it.
- [x] When `description` is absent, the panel shows the subtitle alone, with no empty, broken, or placeholder body section.
- [x] No truncation or length cap is applied to `description` anywhere in the pipeline or the UI.
- [x] Demoable end-to-end: opening a person, a war, and a discovery in the running app each shows the beefier body text where a Wikipedia article was available for that entity.
- [x] Tests cover both the "description present" and "description absent" rendering cases, and the pipeline-side pass-through, for all three lanes (including new coverage for People, which currently has none at this seam).

## Answer

- **shared-types**: `TimelineEntry` gains `description?: string`, documented as independent from `tagline` (no fallback either direction), never a drop condition.
- **Transform** (`transform/index.ts`): new `loadWikipediaExtractsFile()` reads `wikipedia-extracts.raw.json` (ticket 03's output), keyed by `wdId` for People (matching `loadPeopleEnrichmentMap`'s existing key) and by the curated row's own id for Wars/Discoveries. All three `Tagged*` types gained `description?: string`, populated from this map in `transformPeople`/`transformWars`/`transformDiscoveries`.
- **Output** (`write-datasets.ts`): `description` passed through in `buildPeople`/`buildWars`/`buildDiscoveries` via the same `...(row.description ? { description: row.description } : {})` spread convention `image`/`imageAttribution` already use — so a missing value is an absent key, not an `undefined`-valued one, and (unlike `tagline`) never gates a drop.
- **Web**: `DrawerContent` gains `description?: string`, threaded through all three `build-drawer-content.ts` builders. `DetailPanel.tsx` now renders `tagline` in a new `.tagline` style (13px, italic, secondary color — the short subtitle) and conditionally renders `description` (`{content.description && <p className={styles.description}>...}`) reusing the *existing* `.description` CSS class's body-text style (14px/1.5) for the new field, exactly as planned when that class was deliberately left unrenamed in ticket 01 (Rename `description` → `tagline` everywhere). No truncation anywhere — `.panel` already has `overflow-y: auto`.
- **Real data**: ran the full live `fetch-wikipedia-extracts.ts` pass (ticket 03's infrastructure) — 3,827/3,840 people, 153/154 wars, 121/121 discoveries resolved an extract (a few hundred ms shy of 100%, expected — some entities' English Wikipedia titles don't resolve to a summary, e.g. redirects/disambiguation). Rebuilt and published `people.json`/`wars.json`/`discoveries.json`; drop counts unchanged from before this ticket (missing `description` never drops anything).

Verified live in the running app (not just tests): opened Muhammad (person), World War II (war), and Electromagnetic induction (discovery) — each shows its tagline as a subtitle and a full Wikipedia-sourced paragraph below it. No console errors.

New tests: `transform/index.test.ts` gained description present/absent coverage for Wars and Discoveries, plus entirely new `transformPeople` coverage (previously untested at this seam) for both tagline and description pass-through. `build-drawer-content.test.ts` and `DetailPanel.test.tsx` gained description present/absent cases per lane, including a DOM-level check that no empty `<p>` renders when `description` is absent. Full suite: `data-pipeline` 157/157, `web` 133/133 (8 new), both typechecks and `web` lint clean.
