**Implemented.** See `progress-tracker.md`'s Completed entry for what actually shipped, including two corrections made during implementation that this file was not updated to reflect line-by-line: Assumption 6's reign-period end-year fallback chain (below) used `person.birthYear + 1` where it should be `reignPeriod.startYear + 1`, and the subgroup-overlap mechanism described in Design used the wrong vis-timeline option (`TimelineOptions.stackSubgroups` instead of `DataGroup.subgroupStack`).

# Spec: Wars & Conflicts Lane (Frontend)

This is the frontend half of the "wars-as-ranges, battle/treaty→war
membership, and ruler reign periods" data-model work already shipped in
the data pipeline (see `progress-tracker.md`'s "Data-pipeline change...
wars-as-ranges" entry — schema additions to `HistoricalEvent`/`Person`
already live in `packages/shared-types`). Per `ai-workflow-rules.md`'s
"pipeline and frontend are always two units, even when related" rule,
that work was deliberately split from this one. This spec covers only
the second half: rendering the third lane in `packages/web`.

It is **not** `00-build-plan.md`'s "Unit 5" — that name is already
reserved there for "Apply visual design tokens." This unit is the
prerequisite `progress-tracker.md`'s Current Goal logged ahead of Unit 5
("styling the final three-lane layout, not a two-lane one that's about
to change shape"). `00-build-plan.md` isn't edited by this spec to
insert it as a formal numbered unit — flagged as a documentation gap
worth a small follow-up, not fixed here as a side effect.

## Goal

Add a third synced `Timeline` instance — **Wars & Conflicts** — showing
wars as range bars (start–end) and battles/treaties/sieges/etc. as point
markers linked to their parent war via tooltip text; narrow the existing
**Events & Inventions** lane to `category === "invention"` only; and
render each person's `reignPeriods` as a highlighted overlay segment
inside their existing lifespan bar in the **People** lane — so
`npm run dev` shows the full three-lane structure `project-overview.md`
describes, still with vis-timeline's default (untokenized) look, per
Unit 4's precedent of shipping structure before Unit 5 applies color.

## Assumptions flagged (per `ai-workflow-rules.md`, stated rather than silently decided)

1. **Lane order, top to bottom: People, Wars & Conflicts, Events &
   Inventions.** Matches the literal listing order in
   `project-overview.md`'s Core User Flow and Features sections. No
   document pins this down explicitly as a *rendering* order, so
   flagging the reading used.

2. **Height ratio: People 2 : Wars & Conflicts 1 : Events & Inventions
   1** (CSS `flex: 2 / 1 / 1`), keeping People's existing 2x dominance
   from the post-Unit-4 two-lane change unchanged and splitting the
   freed ratio evenly between the two remaining lanes. No product doc
   specifies a three-lane ratio — this is an arbitrary but easy-to-adjust
   starting point (single CSS Module edit), not a load-bearing decision.

3. **Only the bottom lane (Events & Inventions) renders the shared time
   axis**, same as the existing two-lane convention
   (`orientation: { axis: 'none' }` on People and, now, Wars &
   Conflicts) — the axis moves with whichever lane is visually last, no
   new logic needed.

4. **`partOfWarName` is surfaced via vis-timeline's native `title`
   property** (a plain string → rendered as a browser-native tooltip on
   hover), not a custom tooltip component. This matches
   `progress-tracker.md`'s own "tooltip text, most likely" framing and
   deliberately stays inside this unit's scope — a real interactive
   detail panel is Unit 6 (`features/select-timeline-entity` +
   `widgets/detail-panel`), not this unit.

5. **Zero-width war ranges (e.g. Six-Day War, 1967→1967) get the same
   `+1 year` rendering-only fallback Unit 4 already established for
   Hesiod's missing `deathYear`** — extracted into a small shared helper
   in `map-to-items.ts` since it's now needed twice in the same file
   within this same unit (not a speculative refactor of unrelated code).

6. **Reign-period end-year fallback chain: `reignPeriod.endYear ??
   person.deathYear ?? person.birthYear + 1`.** `ReignPeriod.endYear` is
   optional (Wikidata's P582 qualifier is often missing even when P580
   isn't); a reign can't outlast the person, so falling back to their
   own death year (itself already using Unit 4's `birthYear + 1`
   fallback when absent) is a defensible bound. No document specifies
   this — flagging the chain used.

7. **No cap or merge on `reignPeriods` count.** `progress-tracker.md`'s
   Open Questions flagged Julius Caesar's 14 distinct P39 periods as
   "noisy" and explicitly left the render decision ("all 14 tiny
   segments? cap/merge somehow?") to this unit. Rendering every period
   Wikidata records, however small, is the literal reading of the data
   and requires no new heuristic; a merge/cap rule is a real design call
   with no existing product guidance, so it's deliberately **not**
   invented here. Flagging for review rather than building speculative
   merge logic.

8. **A minimal, non-token visual marker is applied to reign-period
   overlay items now** — a neutral dashed border, not a
   `ui-context.md` category color — so this unit has an actual *visible*
   result (`00-build-plan.md`'s stated rule for every unit) rather than
   a reign overlay that's pixel-identical to the base bar and invisible
   until Unit 5. This is the same pattern Unit 4 used for
   `className: category-${category}` (added inert, styled later); Unit
   5 is expected to replace this marker with real tokens, not add a new
   one from scratch.

9. **`mapEventsToItems` is renamed `mapInventionsToItems`** to match its
   narrowed filter (`category === "invention"` only) — a rename
   required by this unit's actual behavior change, not adjacent cleanup.

## Design

### Lane / group definitions

Three vis-timeline groups, extending the table from Unit 4's spec:

| Group id | Label | Item shape(s) | Source | Axis |
|---|---|---|---|---|
| `people` | People | `range` (lifespan) + overlaid `range` (reign periods, same subgroup) | `Person[]` | none |
| `wars` | Wars & Conflicts | `range` (wars with `endDate`) or `point` (everything else) | `HistoricalEvent[]`, `category !== "invention"` | none |
| `events` | Events & Inventions | `point` | `HistoricalEvent[]`, `category === "invention"` | shown |

`HistoricalEvent.category` is constrained today to exactly
`"war" | "politics" | "invention"` (see `progress-tracker.md`'s
Architecture Decisions — `event-type-categories.ts` never maps a
historical-event type to `"invention"`, and `tagInvention` never assigns
anything else), so `category !== "invention"` for the `wars` group and
`category === "invention"` for the `events` group are exact complements
of the same field — no new lane-membership field needed, matching the
pipeline unit's existing design note.

### Wars lane: range vs. point

`HistoricalEvent.endDate` is only ever populated for `wd:Q198` ("war")
entries (gated in `output/write-datasets.ts`, per
`progress-tracker.md`). So within the `wars` group:

- `endDate` present → `type: 'range'`, `start = date`, `end = endDate`
  (or `date + 1 year` if `endDate === date`, see Assumption 5).
- `endDate` absent → `type: 'point'`, `start = date` — covers battles,
  treaties, sieges, revolutions, rebellions, military operations, and
  generic historical events, i.e. everything in the `wars` group that
  isn't itself a dated war.
- `item.title = event.partOfWarName ? `${event.name} — part of ${event.partOfWarName}` : undefined`
  (see Assumption 4). Only set when `partOfWarName` exists — items
  without it get no custom tooltip, same as today's Events lane.

### People lane: reign-period overlay

vis-timeline has no native "sub-range within a range item" concept, but
its `subgroup` mechanism gets the same visual result: items sharing a
`group` **and** a `subgroup` id are laid out in the same row instead of
being stacked apart, when `stackSubgroups: false` is set on that group's
options. So:

- Every person's own lifespan item keeps its existing shape (`type:
  'range'`, `group: 'people'`) but additionally gets `subgroup:
  person.id` **only when `person.reignPeriods` is non-empty** — people
  without reign data are untouched, unaffected by subgroup stacking.
- Each entry in `person.reignPeriods` becomes its own `DataItem`:
  `type: 'range'`, `group: 'people'`, `subgroup: person.id` (same value
  as the parent), `start = reignPeriod.startYear`, `end` per Assumption
  6's fallback chain, `content: ''` (no duplicate label), `className:
  'reign-period'`, `title: `Reign: ${startYear}–${endYear ?? '(end unknown)'}``.
- **Ordering matters**: each person's reign items must appear
  immediately after their own lifespan item in the array passed to
  `setItems()`, so they paint on top of (not underneath) the base bar —
  vis-timeline renders items in array/DataSet order within a shared
  stacking position.
- `buildPeopleTimelineOptions()` gains `stackSubgroups: false`. This
  option's exact name and per-group scoping must be confirmed against
  the installed `vis-timeline@8.5.2` type declarations before relying on
  it — flagged the same way Unit 4 flagged its jsdom/`Timeline`
  behavior: verified empirically, not assumed from memory of the API.
- `.reign-period` gets a minimal CSS marker (Assumption 8) — starting
  point: a dashed border and a slightly reduced height/vertical
  centering within the row, e.g.

  ```css
  .container :global(.vis-item.reign-period) {
    border: 2px dashed rgba(46, 43, 34, 0.55);
    background: transparent;
  }
  ```

  The exact selector/positioning needed to make the overlay read as "a
  segment inside the bar" rather than "a second bar" depends on
  vis-timeline's actual rendered DOM for subgrouped, non-stacked items —
  confirm visually in the browser and adjust before calling this unit
  done; don't assume the first CSS pass is correct.

### Three-way lane sync

The existing two-instance sync (`rangechange` listener on each,
guarded by a shared `isSyncing` flag, calling `setWindow({animation:
false})` on the other — see `code-standards.md`'s Timeline Rendering
section) extends to three instances sharing **one** `isSyncing` ref: each
lane's `rangechange` handler, when not already syncing, sets the flag,
calls `setWindow()` on the *other two* instances, then clears the flag.
Same reentrancy concern as the two-lane version (calling `setWindow` on
a target re-fires that target's own `rangechange`), just guarded across
three instances instead of two.

### What's explicitly out of scope

- No color/typography tokens from `ui-context.md` (Unit 5's job) beyond
  the one minimal, non-token reign-period marker (Assumption 8).
- No click handling, selection state, or detail panel (Unit 6).
- No filtering by occupation/region/fame-tier (Units 7–9) — this unit
  changes what a lane *shows structurally*, not what's eligible to
  render.
- No pipeline changes — `packages/data-pipeline` and
  `packages/shared-types` are untouched; the schema this unit consumes
  already shipped.

## Implementation

Build in this order, all inside `packages/web/src/widgets/timeline-canvas/`
unless noted:

1. **`map-to-items.ts`** — add a shared helper (Assumption 5):
   ```ts
   function ensureMinimumRangeWidthYears(start: number, end: number): number {
     return end <= start ? start + 1 : end;
   }
   ```
   Rewire the existing Hesiod fallback in `mapPeopleToItems` to use it
   instead of its inline `birthYear + 1` check, so both call sites share
   one implementation.

2. **`map-to-items.ts`** — rename `mapEventsToItems` →
   `mapInventionsToItems` (Assumption 9), add the `category ===
   "invention"` filter (it may already implicitly be true today since
   the `events` group only ever received invention-flavored data before
   the pipeline's wars change added `category: "war" | "politics"`
   entries to the same `HistoricalEvent[]` pool — confirm via a quick
   check of current `events.json` category distribution before assuming
   the filter is a no-op today).

3. **`map-to-items.ts`** — new `mapWarsAndConflictsToItems(events:
   HistoricalEvent[]): DataItem[]`, filtering `category !== "invention"`,
   building range/point items per the Design section above (including
   the `title` tooltip for `partOfWarName` and the zero-width fallback
   from step 1). Covered by `map-to-items.test.ts` additions: a war with
   `endDate` → range item; a war with `date === endDate` → range item
   with `end = date + 1`; a battle with `partOfWarName` → point item
   with the expected `title` string; a battle without it → point item
   with no `title`; a politics-category event with no `endDate` → point
   item (confirms the lane isn't accidentally war-only).

4. **`map-to-items.ts`** — extend `mapPeopleToItems` to append reign
   sub-items per the Design section (subgroup assignment, ordering,
   fallback chain from Assumption 6). Covered by new
   `map-to-items.test.ts` cases: a person with two `reignPeriods` →
   their own item plus two reign items immediately following it in the
   returned array, all three sharing `subgroup: person.id`; a person
   with `reignPeriods: []` or `undefined` → no `subgroup` field on their
   own item and no extra items emitted; a reign period missing
   `endYear` on a person who also has a `deathYear` → falls back to the
   death year, not `startYear + 1`.

5. **`options.ts`** — add `WARS_GROUPS: DataGroup[]` (id `wars`, content
   `"Wars & Conflicts"`) and `buildWarsTimelineOptions()` (same shared
   `buildSharedOptions()` base as People/Events, `orientation: { axis:
   'none' }`, no subgroup options — those are people-only). Add
   `stackSubgroups: false` to `buildPeopleTimelineOptions()` (verify the
   option name against `vis-timeline@8.5.2`'s type declarations first,
   per the Design section's flagged uncertainty). `options.test.ts`
   additions: `buildWarsTimelineOptions()` returns the same
   `zoomMin`/`zoomMax`/`min`/`max`/`start`/`end` values as the other two
   builders (shared bounds, per Invariant 5); `buildPeopleTimelineOptions()`
   includes `stackSubgroups: false`.

6. **`TimelineCanvas.tsx`** — add a third `useRef` + mount effect
   constructing the `wars` `Timeline` instance (same pattern as the
   existing two); extend the sync effect to a single shared `isSyncing`
   ref checked/set across all three `rangechange` listeners, each
   calling `setWindow()` on the other two; extend the data effect to
   call `setItems()` on the wars instance with
   `mapWarsAndConflictsToItems(events)`, and update the events instance
   call to use the renamed `mapInventionsToItems(events)`. Render order
   in JSX matches the Design section's lane order (people container,
   wars container, events container, top to bottom).

7. **`TimelineCanvas.module.css`** — add a third `.warsContainer` (or
   equivalent) with `flex: 1` (Assumption 2), adjust the existing
   `.peopleContainer`/`.eventsContainer` flex values to `2`/`1` if they
   aren't already exactly that ratio post-Unit-4; add the `.reign-period`
   marker rule from the Design section (subject to visual adjustment per
   step 9 below).

8. **`TimelineCanvas.test.tsx`** — extend the `vis-timeline/standalone`
   mock to expect **three** `new Timeline(...)` constructions (was two);
   assert the third instance receives `WARS_GROUPS` and an `items` array
   built from `mapWarsAndConflictsToItems`; extend the existing
   reentrancy-guard test (three-way `rangechange` → `setWindow` on the
   other two, no infinite loop) to cover the third instance, reusing the
   established "model `setWindow()` as re-firing that instance's own
   `rangechange`" mock technique from the post-Unit-4 change.

9. **Verify locally, in this order**: `npm run typecheck`, `npm run
   lint`, `npm run lint:boundaries`, `npm run test`, `npm run build`,
   then `npm run dev` for a manual browser pass — confirm three lanes
   render in the People / Wars & Conflicts / Events & Inventions order
   with real data; a known war with a real `endDate` (e.g. Korean War,
   1950→1953, per `progress-tracker.md`'s spot-check) renders as a range
   bar; a battle with a `partOfWarName` shows the parent war name on
   hover; the Events & Inventions lane no longer shows any war/politics
   entries; a person with multiple `reignPeriods` (Julius Caesar is a
   good stress case — 14 periods, per the Open Questions note) shows a
   visually distinct overlay inside their lifespan bar without visually
   replacing it; panning/zooming all three lanes stays in sync with no
   drift or runaway `rangechange` loop; zoom/pan bounds are unchanged
   (still 10–250 years, still 2750 BCE–today). Adjust the `.reign-period`
   CSS from step 7 based on what's actually visible before calling this
   done.

10. **`code-standards.md`** — update the Timeline Rendering section's
    "two synced `Timeline` instances" description to three, and note
    the People lane's `subgroup`/`stackSubgroups` reign-overlay
    mechanism as a standing convention (same "Units 5+ need to know
    about this" framing already used there for the two-lane sync).

11. **`progress-tracker.md`** — mark this unit complete under
    Completed; move it out of Current Goal; log the real
    `stackSubgroups` (or whatever the confirmed option name turns out to
    be) finding, the CSS approach that actually worked for the
    reign-period overlay, and any category-distribution finding from
    step 2. Update Next Up to point at Unit 5 (visual design tokens) as
    the immediate next piece of work, now unblocked.

## Dependencies

None. This unit uses `vis-timeline@8.5.2`'s existing `subgroup` /
`stackSubgroups` API, already installed since Unit 4 — no new package,
no version bump. `packages/shared-types`' schema additions
(`HistoricalEvent.endDate`/`partOfWarName`, `Person.reignPeriods`) were
already added in the prior (unnumbered) pipeline unit and are consumed
here as-is, not modified.

## Verification Checklist

Per `ai-workflow-rules.md`'s standing 9-item checklist, checked
explicitly, plus unit-specific items:

1. FSD layer direction respected — all changes stay inside
   `widgets/timeline-canvas/`; no new import from `features/` (still
   untouched, Unit 6+) or upward.
2. Every date value is `Temporal.PlainDate` until the existing
   `toLegacyDate()` adapter boundary inside `widgets/timeline-canvas/`
   — confirm no new `new Date(` call was introduced anywhere else via
   `grep -rn "new Date(" packages/web/src`.
3. Filters: N/A — still no filtering feature exists (Units 7–9);
   genuinely not-yet-applicable, not silently skipped.
4. No runtime fetch introduced — Invariant 6 trivially holds, same as
   Unit 4.
5. Nothing outside the pipeline's Output stage writes to
   `packages/shared-types/src/data/*.json` — confirm via `git status`/
   `git diff` scoped to `packages/shared-types` and
   `packages/data-pipeline` (both zero changes).
6. Steiger (`npm run lint:boundaries`) passes with no new violations.
7. TypeScript strict mode clean, no `any` introduced.
8. `code-standards.md` updated in this same unit (Implementation step
   10) — not deferred.
9. Every invariant in `architecture.md` checked one by one: Invariant 4
   (single `Date` adapter) — item 2 above; Invariant 5 (10–250yr zoom) —
   unchanged, confirm live; the new pan/zoom bounds on the `wars`
   instance match the People/Events instances exactly (all three share
   one `buildSharedOptions()` base).
10. Three lanes render, in the People / Wars & Conflicts / Events &
    Inventions order, all populated with real data (`npm run dev`).
11. Wars with a real `endDate` render as range bars; everything else in
    the `wars` group renders as points; `partOfWarName` is visible on
    hover for entries that have it.
12. The Events & Inventions lane shows only `category === "invention"`
    entries — spot-check that no war/politics entry leaked through.
13. At least one multi-`reignPeriods` person (Julius Caesar) renders a
    visually distinct overlay inside their lifespan bar, not a second
    stacked bar and not an invisible identical-looking one.
14. All three lanes stay in sync while panning/zooming, with no visual
    drift and no runaway `rangechange` loop (watch the console for
    excessive re-renders during a long drag).
15. `npm run test` green, including the new/updated
    `map-to-items.test.ts`, `options.test.ts`, and `TimelineCanvas.test.tsx`
    cases listed in Implementation.
16. `progress-tracker.md` updated in this same unit (step 11) — phase,
    completed list, the real `stackSubgroups` finding, and Next Up
    pointing at Unit 5.
