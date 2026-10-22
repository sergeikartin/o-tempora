Type: prototype
Status: resolved
Blocked by: 01

## Answer

Two forms compared as static wireframes with real tokens and fonts (`../wireframes/help/`: `popover-`/`modal-` × `desk`/`phone`, plus `filters-` and `period-` for the Empty Lane states). Chosen: **a Help popover on desktop and a bottom sheet on phone**, opened by the "?" at the right end of the top bar.

| Area | Decision |
|---|---|
| Form | Popover anchored under "?" on desktop, bottom sheet on phone. The timeline stays visible behind a light scrim, so a visitor can read a point and look at the marks it describes |
| Content | "How to read this timeline": the Landing Page's three points (same message keys, so they cannot drift), a "Detail Level — how much to show, most famous first." line (also the segmented control's accessible description), and a one-line colour key ending "Conflicts are always red" |
| Footer row | "About & data" (opens the existing About modal, unchanged) and the language switch. These had lived in the removed sidebar. The feedback link stays in About only |
| Behaviour | Always opened by the visitor: no auto-open, no pulsing dot, no persisted "seen" state. `?` opens it and Escape closes it |
| Filters hide everything | Per-lane **Empty Lane** message "Nothing matches these filters" with "Clear all filters" (the same action as the "Showing only" row), shown only when the lane is empty and a filter is active |
| Nothing in the period | Per-lane Empty Lane message "Nothing at this Detail Level in this period" with a "Show more · <next level>" action; at Deep Cut it reads "Nothing recorded in this period" with no action. Only when the lane is completely empty, never for a sparse one |
| Detail Level hint | Stays out of the top bar: the visible per-level helper text carries the live meaning; the general hint lives in Help |

Rejected: **extending the About modal with a "How to read" section** — on phone it becomes a long scroll that hides the timeline, and it mixes how-to-read with licences and credits; **a link back to the landing page** as the only help — it leaves the product and loads a different bundle (kept only as a possible link inside Help, not decided here).

Left for the spec:
- The phone Region button and "?" share the top two rows with the Detail Level control; implementation verifies the "?" stays reachable at 320 px.
- Russian string lengths for the Help content, the colour key and the Empty Lane messages are unchecked.
- Whether the Detail Level hint also appears as a visible line on desktop is left to the implementation, which may add it if the helper text is judged too terse.

Prototype source (`index.html`, mock data) lives in `../wireframes/help/`, not shipped.

## Question

What does in-app wayfinding look and behave like for someone who skipped the landing page (deep link) or comes back later? Prototype, on the real app: the persistent "?" help affordance (placement on desktop and phone, what it opens, how it relates to the landing page's three points), and the empty/zero-result states (filters that hide everything, a viewport with nothing in a lane). Compare at least two forms for the help affordance (e.g. popover vs. drawer reuse vs. link back to the landing page) and pick one.
