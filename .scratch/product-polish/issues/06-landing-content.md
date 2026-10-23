Type: task
Status: done

Content and layout of the **Landing Page** (see `CONTEXT.md`), in our parchment identity. Built as a switchable set of **Curiosities** rather than the originally planned screenshot, stats strip and story cards.

## Built

- Nav: logo and language switch (links to the sibling landing and keeps the chosen Curiosity in the hash).
- Centred `h1` "Every life in context.", a one-line pitch, and the active Curiosity's sentence as the lede.
- One call-to-action, "See them on the timeline", opening the shown Curiosity's first mark as an **Entity Link**. The timeline is prefetched on pointer, focus or touch intent.
- Nine Curiosities, picked from chips (stepper on phone). Each is drawn as marks over a short axis (`CuriosityFigure`) with Entity Links to every mark. The choice lives in the URL hash. Same ids on `/ru/`.
- Every mark's dates are asserted against the published dataset to the month (`curiosities.test.ts`).
- Footer colophon: data credits, link to the data license, link to the source repo.
- No Lane, Detail Level, Fame Score or Container on the page; says "conflicts". Responsive from 360 px.

Commits `3ff5423`, `324f451`, `04c0174`, `43e8b70`.

## Dropped from the original plan

Screenshot of the real timeline, stats strip, Starting Point cards. The Curiosity figure replaces all three. See 14 for what is still owed.
