Type: task
Status: resolved

# Accessibility: baseline pass

## Question

Launch-readiness audit found no accessibility tooling anywhere in the repo: no `eslint-plugin-jsx-a11y`, no `axe-core`/`@axe-core/*` in `packages/web/package.json`, no a11y rules in `eslint.config.js`, and no a11y-debt ADR (the only related mention is an incidental `inert`-attribute detail in `packages/web/docs/adr/0006-css-animation-scope-and-detail-panel-always-mounted.md:15`, not a documented gap).

Sergei chose a baseline pass, not a full WCAG audit (chart-the-map grilling session): "not a full WCAG audit, but not ignored either."

Do:
- Add `eslint-plugin-jsx-a11y` to the lint config and fix whatever it flags.
- Run one manual/axe pass over the core interactions (pan/zoom, sidebar filters, detail panel, and the mobile drawer/bottom-sheet from commit `0b07b26`) and fix obvious issues — contrast, missing labels, focus handling, keyboard reachability.
- Record what was fixed vs. explicitly deferred (if anything) as this ticket's resolution, so deferred items can graduate into a future effort rather than being silently dropped.

## Answer

**Lint tooling**: Added `eslint-plugin-jsx-a11y` (`flatConfigs.strict`) to `packages/web/eslint.config.js`. It flagged nothing against the existing codebase — lint is clean with the new ruleset active.

**Manual/axe pass** (Lighthouse a11y audit + accessibility-tree/keyboard inspection via Chrome DevTools, desktop and a 390×844 mobile-viewport emulation), score went 90 → 96:

Fixed:
- **Missing `<main>` landmark** — `App.tsx` now wraps `TimelineCanvas` in a `<main>` (`display: contents` in `App.module.css` so it doesn't disturb the existing flex layout).
- **Invalid ARIA usage on the Minimap track** (`aria-prohibited-attr`) — a bare `<div aria-label>` has an implicit `generic` role, which doesn't support an accessible name. Gave it `role="img"` (`Minimap.tsx`).
- **Mobile filter drawer didn't trap or move focus** — it renders behind a full-screen backdrop (reads as modal) but Tab from the toggle button escaped straight into the visually-hidden canvas underneath, since the drawer sits earlier in DOM order than the toggle that opens it. `Sidebar.tsx` now moves focus to the drawer's close button on open, traps Tab/Shift+Tab inside while open, restores focus to the toggle on close, and closes on Escape.
- **About panel declared `aria-modal="true"` but didn't behave like one** — same fix as the drawer: focus moves in on open, is trapped while open, and is restored to the "About" button on close (`AboutPanel.tsx`). Escape-to-close already existed.
- Stale test assertion (`App.test.tsx` still expected the pre-rebrand tagline "World History Timeline") — unrelated pre-existing bug, fixed in passing since it blocked a clean test run.

Checked and found passing (no change made):
- Century-strip label contrast (Lighthouse flagged `.centuryLabel` in `Minimap.module.css`) — computed against its actual resolved background, `--color-text-secondary` (#6b6046) on `--color-bg-surface` (#fbf6e9) is 5.75:1, comfortably above the 4.5:1 AA threshold for that font size. Verified both by the WCAG relative-luminance formula and visually. Reads as a Lighthouse/axe false positive for the transparent-background, absolutely-positioned label; left the token alone.
- Detail panel, filter pills, spinbuttons, zoom buttons, region/domain filter buttons — all already properly labeled, keyboard-operable native controls with no findings.

Explicitly deferred (flagged for a future effort, not silently dropped):
- **Individual timeline entity marks (people/conflicts/milestones lines, dots, labels) are pointer/touch-only** — no `tabindex`, `role`, or keyboard handler exists on any of the ~800 D3-rendered SVG marks across the three lanes; the click-to-open detail drawer has no keyboard equivalent. This is the single biggest remaining gap, and deliberately out of scope for a baseline pass: a real fix needs a roving-tabindex/arrow-key navigation model that accounts for the viewport-relative row-stacking, live filtering, and zoom — a design effort of its own, not a lint-and-patch job.
- **Minimap click/drag-to-scrub-to-position is also pointer/touch-only** — same underlying gap as above, same reasoning for deferring.

Also fixed as a build-blocking side issue (unrelated to accessibility, discovered while trying to run lint): `npm run lint` was already broken on `dev` before this ticket — root `typescript` is `^7.0.2`, which `typescript-eslint` doesn't support yet (the existing `ts-api-utils`/`cosmiconfig` overrides in root `package.json` were an earlier, incomplete attempt at the same workaround). No override reliably forced a compatible `typescript` version for `typescript-eslint`'s own peer resolution under this repo's npm version, so this was left as-is rather than patched with something fragile — the jsx-a11y verification above was done via a temporary local `typescript@6.0.3` downgrade (not committed). Worth its own ticket if the team wants `npm run lint` runnable without a workaround.
