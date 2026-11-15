Type: task
Status: resolved
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

## Comments

Tracker reconciliation (2026-11-15): Implemented in `705a9b6` and integrated into the Top Bar in `a5047ca`. `HelpPanel.tsx` and its tests cover visitor-controlled opening, Escape/close, About and the locale switch. The current six-point copy and shared ModalPanel replace the original three-point/popover proposal. The remaining accessibility sweep is [ticket 12](12-accessibility-and-touch-sweep.md).
