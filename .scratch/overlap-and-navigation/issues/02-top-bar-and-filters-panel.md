Status: resolved
Blocked by: 01

# Top Bar and Filters Panel replace the sidebar

Spec: `../spec.md` section 3. Blocked by 01 because the detail-panel and framing work in 01 defines the uncovered canvas the new chrome must respect.

## Scope
- Top Bar: Search, Detail Level, Filters button (active-filter count badge), Help. About and language switch stay in Help.
- Filters Panel: Occupation Domain, Region, Conflicts & Milestones; popover on desktop, bottom sheet at ≤960px.
- Remove the floating sidebar, left drawer, scrim and drawer toggle; zoom +/- stay overlaid on the Viewport Range strip for non-touch pointers.
- Check People labels still pin correctly now that the canvas is full width.
- Web ADR (supersedes the drawer parts of `0008`). Update `DESIGN.md`, `CONTEXT.md` (remove stale sidebar wording), `docs/design-tokens.md` if tokens change.

## Acceptance
- [x] Search and Detail Level are reachable without opening anything, at 360px too.
- [x] Filtering behaves exactly as before (OR within a filter, AND across).
- [x] Russian string lengths checked in the bar and the panel.
- [x] Keyboard: Filters panel opens, traps focus, closes on Escape; `?` still opens Help.
- [x] axe clean at 1440×900, 768×1024, 390×844 in both locales.

## Comments

- `typecheck`, `test`, `lint`, `lint:boundaries` and `build` pass. axe (`npm run a11y --workspace packages/web`) reports only `region` (sr-only `h1`) and `scrollable-region-focusable` (scroll containers), both listed in `scripts/a11y-baseline.json` and present before this ticket; nothing comes from the Top Bar or panel. Keyboard focus for the scroll regions belongs with ticket 04.
- One Top Bar widget (`widgets/top-bar`) holds both the bar and the Filters Panel, since widgets can't import each other and the popover is anchored to the bar's button. Layout is CSS-only; at ≤960px it wraps to two rows (Search, Filters, Help / Detail Level full width) and the wordmark is dropped. Russian checked at 1440, 360: no overflow in the bar, the panel or the level labels.
- Detail Level lost its two visible helper lines to fit the bar; they remain as screen-reader description (Help still explains the levels).
- The desktop detail panel now starts below the Top Bar so Search, Filters and Help stay reachable with a Selection open; Escape closes an open modal before the detail panel.
- Pressing in the Top Bar while a Selection is open still dismisses the detail panel (a press outside it, as with the old sidebar). Left as is; say if it should be exempt.
- People labels checked after scrolling at 1440: still pinned to the left edge.
- Shared `useModalFocus` extracted from `ModalPanel` for the panel's focus trap. ADR `0017` written; `0008` marked partially superseded. `DESIGN.md`, `CONTEXT.md` and the living docs updated; `docs/design-tokens.md` only had stale wording.
