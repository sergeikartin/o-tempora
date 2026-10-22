Type: grilling
Status: resolved

## Answer

| Current | Proposed | Why |
|---|---|---|
| Detail Level names `Legendary` / `Mainstream` / `Specialized` / `Deep Cut` | unchanged | `Deep Cut` already reads as "dig deeper", matching landing point 3; the audit's problem with this control was visual (equal weight on two levels, 11 px text), handled in ticket 09 |
| Detail Level heading "Detail Level" | unchanged, plus a hint beneath: "How much to show, most famous first." | the heading says nothing about what the switch changes |
| Per-level descriptions | same meaning, tighter wording | — |
| Occupation filter heading "People" | **Occupation** | "People" is also a lane name |
| "Conflicts & Milestones" filter heading, "Region", "Filters" | unchanged | — |
| Pill "Institutions" | **Politics & Religion** | Pantheon's term tells a visitor nothing |
| Pill "Public Figure" | **Public Figures** | plural, consistent with its neighbours |
| Milestone Category Group "Social & Human Culture" | **Society & Culture** | shorter, plainer |
| Landing point 2 "wars" | "conflicts" | the UI says Conflicts, and the data includes revolutions and coups |

Other pills (Arts, Business & Law, Science & Technology, Exploration, Humanities, Sports, Science & Innovation) are unchanged. `CONTEXT.md`'s **Milestone Category Group** entry now uses the new display name. Whether lanes get labelled on the canvas is part of ticket 09's first-view frame. Russian equivalents are flagged for the Russian parity pass, not translated here.

## Question

Which in-timeline labels and terms are unclear to a first-timer, and what replaces them?

- Detail Level positions (`Legendary` / `Mainstream` / `Specialized` / `Deep Cut`) and the one-line descriptions under them: self-explanatory, or do they need renaming or a "what does this change?" hint?
- Lane names (People / Conflicts / Milestones) and the merged Conflicts+Milestones lane: are lanes labelled on the canvas at all, and do they need to be?
- Filter group headings, the "Filters" panel heading, and pill names (e.g. "Public Figure", "Institutions", "Social & Human Culture").
- The same terms in Russian (flag only; translation is fog).

Output is a decided term list (current → proposed → why) that the spec can hand to implementation. Glossary-affecting renames go through `/domain-modeling`.
