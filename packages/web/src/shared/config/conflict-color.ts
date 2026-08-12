// Conflicts no longer key their fill off ConflictCategory — the merged
// Conflicts+Milestones lane needs every Conflict to read as one visual
// group at a glance (Milestones keep their own multi-color category
// palette, see milestone-category-group.ts), so the old per-category
// Conflict Category Palette is retired in favor of this single flat color.
// "Ledger & Ink" rhymes this with the People-domain Institutions hue
// (--color-domain-institutions), stepped darker — Conflict deepens state
// power the same way each Milestone Category Group color deepens its own
// People-domain counterpart. Validated (OKLCH lightness/chroma bounds, CVD
// separation under simulated protanopia/deuteranopia, a normal-vision
// floor, contrast vs. the parchment surface) against the 3 milestone-group
// hexes as one 4-color set, all pairs, not just neighbors — see
// docs/design-tokens.md. Lives in shared/config, not
// widgets/timeline-canvas/options.ts, since both the Conflicts+Milestones
// lane (marker fill) and the sidebar's Conflicts pill (swatch) need it —
// mirrors occupation-domain-colors.ts's DOMAIN_COLORS and
// milestone-category-group.ts's MILESTONE_CATEGORY_GROUP_COLORS.
export const CONFLICT_COLOR = '#8C2D2B';
