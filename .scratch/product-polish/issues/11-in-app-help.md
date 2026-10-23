Type: task
Status: needs-info
Blocked by: 09

See **Help** in `CONTEXT.md`. Where it lives follows the layout decision; the content is settled.

## Content

- "How to read this timeline", three plain points: **Time runs left to right.** / **Lives, conflicts and milestones share one timeline.** / **Tap anything for the story.** (plus a gesture line: drag to pan, pinch or +/− to zoom).
- A line "Detail Level — how much to show, most famous first."
- A one-line colour key ending "Conflicts are always red".
- A footer row: "About & data" (opens the existing About modal) and the language switch.

## Behaviour

- Always opened by the visitor: no auto-open, no pulsing dot, no persisted "seen" state. `?` opens it, Escape closes it.
- Popover on desktop, bottom sheet on phone (or whatever the chosen layout calls for).
- The About modal stays as is, including its "Report a problem or suggest an entry" link to GitHub Issues.
- EN and RU strings together; check RU lengths.

Docs: `docs/product-scope.md`, `CONTEXT.md` if wording changes.
