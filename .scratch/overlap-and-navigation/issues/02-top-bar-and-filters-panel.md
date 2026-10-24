Status: ready-for-agent
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
- [ ] Search and Detail Level are reachable without opening anything, at 360px too.
- [ ] Filtering behaves exactly as before (OR within a filter, AND across).
- [ ] Russian string lengths checked in the bar and the panel.
- [ ] Keyboard: Filters panel opens, traps focus, closes on Escape; `?` still opens Help.
- [ ] axe clean at 1440×900, 768×1024, 390×844 in both locales.
