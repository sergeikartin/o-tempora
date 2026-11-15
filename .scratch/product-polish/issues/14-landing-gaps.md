Type: task
Status: ready-for-agent
Blocked by: 06

What the original landing spec asked for that the Curiosity-based landing page (06) does not yet do.

## Do

- Build-time test, run after each dataset regeneration: every Curiosity mark's slug resolves in the shipped data at `Mainstream`, or the build fails. Today `curiosities.test.ts` resolves slugs in the detail files at any depth and only compares dates.
- Check RU lengths in the chips, stepper and footer at 360 px.
- Have the owner review the EN and RU Curiosity copy.

## Docs

`docs/product-scope.md` (landing description).

## Comments

Tracker reconciliation (2026-11-15): Still open: `curiosities.test.ts` imports all four Detail Levels and compares dates; it does not enforce Mainstream availability. RU-at-360px and owner copy review have no completion record here. The Profile-led handoff in `d6c9960` supersedes the original first-mark CTA; validate the current lead and retained figure marks rather than restoring per-mark links.
