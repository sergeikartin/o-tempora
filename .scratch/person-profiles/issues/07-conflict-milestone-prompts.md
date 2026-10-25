# Conflict and Milestone prompts

Type: grilling
Status: resolved
Blocked by: 02

## Question

What do the Conflict and Milestone prompts look like, given the revised person prompt (`packages/data-pipeline/prompts/person.md`)? A Conflict's Connections lean to the people involved; a Milestone's to its inventors and the people and events around it. Decide what each lane's overview and Key Moments mean, what inputs each gets, and where the shared output shape must flex.

## Settled so far

Adapt the supplied prompts to these, then factor the shared output shape into one partial:

- Every lane also receives the **Tagline**. A Conflict or ConflictEvent gets a human-readable period (a single date for a point event), its Conflict Category and its **Container** name if any. A Milestone gets a date label (with "ca." when approximate) and its Milestone Category.
- Conflict: overview says what, who and why, where, and the outcome; 3 to 5 Key Moments are turning points in order; a ConflictEvent uses the same prompt with Key Moments covering the lead-up and the day.
- Milestone: one prompt for every shape (invention, institution, place, work, religion); overview says what it is, who made it or where it began, and why it mattered; 2 to 4 Key Moments run origin, turning points, consequences; the person-only "breakthrough" rule is dropped.
- Connections may target any lane, cap 15, `importance` orders only. A Conflict leans to its leaders and key figures and its causes and consequences; a Milestone to its inventors and founders and its predecessors, successors and surrounding events.
- Conflict and Milestone categories output only `themes`, with no `roles`.
- Three lane prompts plus one shared partial for the output shape; `prompt_hash` is taken from the assembled text; one shared validator checks every lane.

## Answer

No separate Conflict and Milestone prompts. The user's unified prompt (`packages/data-pipeline/prompts/profile.md`, v2.1.0) is good enough for people, conflicts and milestones, and branches on `{type}` inside one text. The "Settled so far" list above is superseded: no Tagline input, no categories, a single prompt file and no shared partial.
