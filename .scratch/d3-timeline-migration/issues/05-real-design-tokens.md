# Wire real design tokens

Type: task
Status: open
Blocked by: 01, Unit 5 (design-tokens.md decisions not yet finalized)

## Task

Replace the D3 rendering core's provisional inlined colors (Occupation Domain palette, reign-period stripe color) with real CSS custom properties once Unit 5 lands them as tokens — `packages/web/docs/design-tokens.md` documents the palette but nothing in the codebase wires it as CSS custom properties yet (per `docs/active-context.md`).

Also resolve, as part of this ticket, the two specifics `docs/active-context.md`'s Next Up flags as still open from the paused Unit 5 grilling session:

- The reign-period marker's real token (tentatively `color-accent-selected`, not yet decoupled into its own `color-marker-reign-period` token).
- The lifespan-bar name-label font-size/padding at the finalized 16px bar height.
