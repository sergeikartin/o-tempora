Type: prototype
Status: resolved

## Answer

Hi-fi wireframes (static mock data, real tokens and fonts) compared four frames, then four ways to display the filter chips. The chosen frame is a **top bar with labelled lanes, lane chips stacked in the lane gutter, and Region in a top-bar popover**. Wireframes: `../wireframes/first-view/` (`overview.png` shows all six states).

| Area | Decision |
|---|---|
| Top bar | Logo, search, Detail Level as a visible segmented control (Legendary / Mainstream / Specialized / Deep Cut, with the "Show" label), a Region button, and the help affordance at the right end. The sidebar is removed |
| Canvas edge | The canvas starts at the lane gutter's edge, so marks and the axis start no longer clip under a floating card |
| Lane labels | Both lanes are labelled in a left gutter: "People" ("Who lived when. Click a field to show only it.") and "Conflicts & Milestones" ("Bars last years. Dots are moments."). The gutter stays visible while the canvas pans |
| Lane filters | The eight Occupation chips sit stacked in the People gutter and the three group chips in the Conflicts & Milestones gutter, each beside the lane it filters. They double as the colour legend, so each keeps its domain-colour dot |
| Chip state | Nothing selected means "show all" (no "All" chip). Selected chips get a tinted fill, a domain-colour border and a ✓. A "Show all fields" link appears under the People chips once any is selected |
| Region | A top-bar popover, because 14+ chips do not fit a gutter. Options are grouped by continent (Europe, Asia, Africa, Americas, Oceania). The button reads "Region · N" and turns solid when active |
| Active filters | While any filter is on, a "Showing only" row of removable chips plus "Clear all" sits under the top bar |
| Phone first screen | A labelled "Region" button replaces the bare hamburger. Detail Level is a full-width segmented control under the top bar. Lane tags with a ▾ label both lanes, and a visible +/− zoom control stays on screen |
| Phone filters | Tapping a lane tag opens a "Show only…" card of that lane's chips. Region opens as a bottom sheet with a "Show N results" button, and active filters show as chips under the Detail Level control |
| Detail Level hint | The ticket 05 hint ("How much to show, most famous first.") needs a home. The wireframes do not place it; the implementation decides between a tooltip and a line under the control |

Rejected frames: a sentence-style filter bar (reads well, but needs the most new UI and breaks in Russian); a "How to read" strip (the product map rejected onboarding aids); a labelled icon rail (hides filters until opened). Rejected chip placements: a chip strip across each lane (costs about 40 px per lane and cannot absorb more chips), a dropdown per lane (hides the options from a first-timer), and one Filters popover for everything (separates each filter from its lane).

Open for ticket 06 and the spec: where the help affordance opens from and what it shows (the wireframes only reserve its slot in the top bar). The empty bottom third on phone with a sparse Conflicts & Milestones lane is not solved here; the lane label and zoom control are the only additions.

## Question

What should the timeline's first view look like for someone who has just arrived, apart from the landing page's content? Prototype on the real app, at desktop and phone widths:

- **Phone first screen** (audit finding 2): a labelled menu button instead of a bare hamburger, lane labels or other orientation cues, visible zoom affordance, and what fills the empty bottom third when the Conflicts+Milestones lane is sparse.
- **Desktop sidebar overlap** (audit finding 3): the floating Filters card clips marks and the axis start. Compare offsetting the canvas to the card's edge, a collapsed-by-default card, and an opaque pushed layout.
- How the chosen frame coexists with the in-app help affordance (ticket 06) so the two don't compete for the same corner.
