# Landing hands off to a Profile

Type: task
Status: resolved
Blocked by: 13, 14

## What to build

The Landing Page call-to-action opens a Curiosity's lead entity at an anchored Key Moment or Deep Fact. Decision and rules: `09-landing-without-multi-selection.md`.

- [x] Each Curiosity in `curiosities.ts` gets a `lead` (one of its marks) and an optional `anchor` (`moment` or `fact` plus index).
- [x] The call-to-action links to the lead's Entity Link (`entityLinkSearch`, one slug) plus `#moment-<n>` or `#fact-<n>`; only the landing produces the fragment.
- [x] On arrival the panel scrolls the item into view (instant under `prefers-reduced-motion`) in both the desktop drawer and the mobile sheet, and gives it a persistent accent (no timed fade).
- [x] Opening another entity drops the fragment and clears the accent; Back restores both.
- [x] A fragment with no Profile, an out-of-range index or an unknown kind is ignored and the panel opens normally.
- [x] `curiosities.test.ts` pins each anchor to an expected Key Moment date or Deep Fact phrase in the shipped Profile; Curiosities with no Profile have no anchor.
- [x] The per-mark Entity Links under the figure and the `landing_mark_open` event are removed; marks stay as plain labels. The overlap band stays.
- [x] Component tests cover the fragment, scroll and accent; `web` typecheck, lint and tests pass.
