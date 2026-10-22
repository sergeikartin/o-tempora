Type: prototype
Status: resolved
Blocked by: 01

## Answer

Three variants compared on mock data with the real tokens and fonts (`../wireframes/landing/`: `A-`, `B-`, `C-` × `desk`/`phone`). Chosen: **A, a stacked layout with a static screenshot of the real timeline**.

| Area | Decision |
|---|---|
| First screen | Nav (logo, About, GitHub, language switch), centered `h1` "Every life in context.", subhead, primary "Explore the timeline" button, then the preview |
| Preview | A framed, non-interactive screenshot of the real timeline at roughly 1740–1873, showing both lanes and the Year Axis. It is an image, so the landing ships no datasets and no timeline JS, and a missing image never blocks the CTA |
| Three points | One row of three numbered points under the preview; stacked on phone |
| Starting Points | Four cards (era, title, teaser, kind) in one row on desktop, two columns on tablet, one on phone. Each is an Entity Link |
| Footer | The light footer from ticket 01, in three columns on desktop and stacked on phone |
| Phone | The CTA goes full-width and the preview starts inside the first screen under it, so the product shows without scrolling |

Rejected: **B** (split, looping preview) because on phone the three points push the preview below the fold; **C** (full-width live miniature) because it needs the timeline JS and datasets on the landing, against the landing-build decision in the map, even though it gives the strongest "aha".

Left for the spec:
- The screenshot is captured from the real app at build time or by hand; the prototype's hand-drawn SVG is a stand-in. Either way it needs a Russian capture and an alt text.
- Whether to replace the image with a short muted loop (screenshot as poster, static under `prefers-reduced-motion`) without changing the layout.
- Marks cut off at the preview's right edge look odd; the capture should choose a window where they do not.
- Russian string lengths in the three-point row and the cards are unchecked.

Prototype source (`index.html`, mock data) is kept on a throwaway branch, not main.

## Question

How should the landing page show the product in its first screen, and how should it look and feel overall? Make cheap, rough, side-by-side variants to react to — at minimum: a static screenshot of the real timeline, a looping recorded pan/zoom, and a live read-only miniature timeline rendered from the real dataset. Judge them on first-paint cost, clarity of the "aha", fidelity to the "Ledger & Ink" identity, and phone-width behavior. Also settle the first-screen layout (hero, preview, three points, example links, CTA) at desktop and phone widths.
