// One flat color for every Conflict, whatever its ConflictCategory, so
// Conflicts read as one group next to Milestones' multi-color palette
// (milestone-category-group.ts). Rhymes with the People-domain Politics &
// Religion hue (--color-domain-institutions), stepped darker, and is
// validated against the 2 milestone-group hexes as one 3-color set — see
// docs/design-tokens.md. Lives in shared/config rather than
// widgets/timeline-canvas/options.ts because the lane (mark fill) and the
// sidebar's Conflicts pill (swatch) both need it.
export const CONFLICT_COLOR = '#8C2D2B';
