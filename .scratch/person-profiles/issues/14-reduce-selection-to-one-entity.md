# Reduce the Selection to one entity

Type: task
Status: open
Blocked by:

## What to build

Retire the date-overlap comparison: a Selection is one entity and the Entity Link carries one `?e=<slug>` (`spec.md`, "Selection becomes one entity").

- [ ] Multi-select is removed (Shift/Ctrl/Cmd-click, the floating "Add to comparison" button).
- [ ] Span Bands, Overlap Bands, `computeOverlap`, the overlap sentence and the Focus Range "Overlap" label are removed; the Focus Range shows the one entity's span.
- [ ] `entityLinkSearch` takes one slug; arrival still fits the viewport to the entity and raises the Detail Level as needed; Back closes the panel in one step.
- [ ] The Landing Page call-to-action opens the Curiosity's first mark until the landing handoff ticket (17) replaces it with `lead`, so the build stays green.
- [ ] A root ADR supersedes `0008-selection-is-a-set-and-overlap-is-drawn-as-bands.md`; a `web` ADR supersedes `0016-url-carries-a-selection-and-arrival-fits-it.md` (frontmatter `status: superseded` / `superseded-by` on the old ones).
- [ ] Tests for the removed behaviour are deleted and one-entity URL tests added; `web` typecheck, lint and tests pass.
