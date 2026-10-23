Type: task
Status: ready-for-agent

See **Entity Link** in `CONTEXT.md`. Built on the current root first; ticket 05 moves it under `/timeline/`.

## Do

- The only URL state is `?e=<id>`. Panning, zooming, Detail Level and filters never touch the URL.
- Opening an id that isn't in the loaded Detail Levels loads delta files progressively (level 3, then 4), raising the Detail Level only as far as the entity needs. An id that never resolves opens the timeline normally with no panel.
- Selecting an entity `pushState`s (Back closes the panel); closing replaces the entry.
- The language switch carries `e` to the sibling locale.
- The timeline pans to the entity and opens the detail panel exactly as picking it in Search does.

## Acceptance

- Tests: id at Mainstream, id only in level 3 and level 4, unknown id, Back/forward behaviour, locale switch keeps `e`.
- A shared `?e=` link reproduces the same panel in both locales.

ADR: `packages/web/docs/adr/0015-…` — entity-only URL state with progressive loading.
Docs: `docs/product-scope.md` (add Entity Links, drop the language-switcher deep-link exclusion), `CONTEXT.md` if wording changes.
