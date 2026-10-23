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
