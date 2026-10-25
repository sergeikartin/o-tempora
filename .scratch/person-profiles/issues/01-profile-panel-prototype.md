# Profile panel prototype

Type: prototype
Status: resolved
Blocked by:

## Question

How should the detail panel present a **Profile** — overview, **Key Moments**, **Deep Facts**, and a **Connections** section that lists every in-dataset target and marks those below the current **Detail Level** with the level they appear at? Prototype it on hand-written sample data (a Legendary cluster such as Newton / Galileo / Copernicus; Drake and the Armada are not at Legendary) at desktop and phone width, with the `**bold**` markup in Key Moments. Judge how the below-level marker reads at Legendary and Mainstream, and how long the panel gets.

## Answer

The design is approved and committed (`72ddbd0`, `packages/web/src/widgets/detail-panel/`), running on hand-written samples for Newton, Galileo and Copernicus (`lib/sample-profiles.ts`, unverified, to be replaced by shipped Profile data).

- **Panel:** the drawer widens from 340px to 440px (about 55 characters a line); on a phone it stays the 80vh sheet. The name and tagline pin to the top of the scroll, with a rule once content passes beneath; the Wikipedia button moves to a sticky footer; the photo slot drops to 200px.
- **Sections:** overview, then Key Moments, Deep Facts, Connections under the existing Eyebrow headings. Key Moments are a thread of lane-coloured marks (a dot for a moment, a round-capped line for a span). Deep Facts are tonal wells, a legend tagged "Legend". Connections are tappable rows (lane swatch, name, dates, reason).
- **Below-level marker:** the Detail Level switch's four pips in Faded Ink plus "Appears at <level>", under the row. It reads clearly at Mainstream (Newton lists Halley at Specialized, Hooke, the Principia and the Scientific Revolution at Deep Cut). At Deep Cut no row is marked. Opening one raises the Detail Level, selects the target and pans to it; a target without a Profile shows its Description.
- **Length:** Newton's panel scrolls about 2,500px at 440px wide (4 Key Moments, 3 Deep Facts, 7 Connections). A real Profile can list up to 15 Connections; a sticky section index is the cheapest fix if that is too long.
- **Prototype shortcuts, not decisions:** Connections name a slug, where shipped data resolves by QID (ticket 05). A hop replaces the history entry rather than adding one. The prototype requests the Specialized and Deep Cut data whenever a Profile is open so the list is complete. Comparison is untouched.
- **Open:** the owner is considering a permanent docked right panel; the prototype keeps the overlay, and a docked panel needs an empty state for no Selection.
- **Docs updated:** `DESIGN.md` (panel width, pinned header, Profile sections), `docs/timeline-rendering.md` (440px drawer).
