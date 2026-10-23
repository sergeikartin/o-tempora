Type: task
Status: ready-for-agent

See **Empty Lane** in `CONTEXT.md`. Shown per lane, only when the lane is completely empty in the current Viewport Range, never for a merely sparse one.

## Messages

| Cause | Message | Action |
|---|---|---|
| Filters hide everything | "Nothing matches these filters" | "Clear all filters" |
| Nothing at the current Detail Level in this period | "Nothing at this Detail Level in this period" | "Show more · <next level>" |
| Already at `Deep Cut` | "Nothing recorded in this period" | none |

## Do

- Render inside the lane in parchment style; the action buttons use existing controls. Works on phone.
- EN and RU strings drafted together; check RU lengths.
- Tests for each cause, including a sparse-but-not-empty lane showing nothing extra.

Docs: `docs/product-scope.md`, `CONTEXT.md` if wording changes.
