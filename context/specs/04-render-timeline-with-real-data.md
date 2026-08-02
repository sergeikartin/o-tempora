# Spec: Render Timeline With Real Data — Unit 4

## Goal

Render a real, pannable/zoomable vis-timeline canvas — People lane (range
bars) and Events & Inventions lane (point markers) — bounded to a 10–250
year zoom window, panning bounded to 2750 BCE–today, and defaulting to
the 1800s, populated directly from
`packages/shared-types/src/data/people.json` / `events.json` (344 people,
693 events), so `npm run dev` shows real history instead of the Unit 3
placeholder heading.

## Assumptions flagged (per `ai-workflow-rules.md`, stated rather than silently decided)

1. **"Centered on the 1800s, 100-year window" = the literal window
   `[1800-01-01, 1900-01-01)`**, not `[1750, 1850)` centered on the value
   1800. `project-overview.md` calls the 1800s "a deliberate default
   (data-dense, broadly familiar **era**)," which reads as "show the
   1800s era" rather than "center the viewport on the year 1800" — but
   both readings are grammatically valid, so flagging the one I built.

2. **`app/App.tsx` owns raw dataset loading for now, not
   `widgets/timeline-canvas`.** Neither `architecture.md` nor
   `code-standards.md` pins down which file performs the
   `people.json`/`events.json` import. I put it in `App.tsx`, passing
   `people`/`events` down as props, because Unit 7's
   `features/filter-timeline-entities` is described as "exposes the
   resulting visible-entities list to **widgets**" — i.e. the long-term
   shape is a features-layer hook feeding filtered data into the widget
   as props. Loading raw data in `App.tsx` today and swapping the prop's
   *source* (not its *shape*) in Unit 7 means `TimelineCanvas`'s props
   interface (`{ people: Person[]; events: HistoricalEvent[] }`) never
   has to change.

3. **`shared/index.ts` and `widgets/index.ts` (the Unit 3 layer-root
   placeholders) are deleted, not populated.** Real FSD doesn't use a
   single barrel file for an entire layer — only slices get an
   `index.ts` public API. Unit 3's `steiger.config.ts` comment already
   called these placeholders temporary, "to be removed once Unit 4+
   replaces the placeholders with real slices." This unit does that:
   `shared/` gets real segments (`types/`, `lib/`, `config/`), each
   imported directly by path, no layer-wide barrel; `widgets/` gets one
   real slice (`timeline-canvas/`) with its own `index.ts`. The
   `fsd/no-layer-public-api` override in `steiger.config.ts` shrinks to
   cover only `src/features/index.ts` (still a real placeholder —
   `features/` isn't touched until Unit 6).

4. **No jsdom test renders a real `vis-timeline` `Timeline` instance.**
   Verified empirically, not assumed: constructing a real `Timeline`
   against a bare jsdom document (via a manual `jsdom` + `vis-timeline`
   reproduction outside this repo) never resolves — the process hung
   past a 2-minute timeout with no error, rather than throwing. So
   `TimelineCanvas`'s test mocks `vis-timeline/standalone` (see
   Implementation step 8) instead of rendering the real library, and the
   one true end-to-end check ("does it actually draw in a browser") is
   manual, via `npm run dev` — the same gap Unit 3 already flagged for
   its own placeholder ("no headless browser was available... rests on
   the jsdom render assertion... rather than a literal screenshot").

5. **A visually-hidden `<h1>World History Timeline</h1>` stays in
   `App.tsx`**, above the timeline, instead of disappearing along with
   the Unit 3 placeholder text it replaces. This is a one-line
   accessibility/landmark minimum (a page with a full-bleed canvas and
   no heading has nothing for a screen reader to announce), not new
   product scope — flagging it since it's easy to read as scope creep.
   No visual design (Unit 5's job) is attached to it beyond the standard
   sr-only clip pattern.

6. **Items get a `className` of `category-${category}` now, even though
   no CSS matches that class until Unit 5.** Zero behavior change today
   (no such CSS rule exists yet), but it means Unit 5 ("People bars get
   solid occupation-category fills") edits only CSS, not
   `map-to-items.ts` again. Flagging in case you'd rather keep this unit
   strictly inert and add the className in Unit 5 instead.

## Design

### What renders

Two vis-timeline groups, defined once as a module constant per
`code-standards.md`'s Timeline Rendering rules:

| Group id | Label | Item shape | Source |
|---|---|---|---|
| `people` | People | `range` bar, start = birth year, end = death year | `Person[]` |
| `events` | Events & Inventions | `point` marker, single date | `HistoricalEvent[]` |

No color, typography, or `ui-context.md` tokens are applied in this unit
— that's Unit 5 (`00-build-plan.md` splits "render structurally correct
timeline" from "apply visual design tokens" into two separate units with
two separate visible results). This unit ships with vis-timeline's
default look: default bar/point styling, default fonts, default
axis/label rendering.

**Missing-death-year handling:** 1 of 344 people (Hesiod) has no
`deathYear`. Rather than drop him or special-case the People lane into
sometimes-point-sometimes-range (which would break the "person = bar,
event = point" shape rule from `ui-context.md`), `map-to-items.ts` falls
back to `birthYear + 1` as the range end — a rendering-only stand-in,
same convention as `code-standards.md`'s existing month/day placeholder
rule ("treated as such anywhere displayed," not a real claim about the
data).

**Stacking:** `stack: true` in `TimelineOptions`, satisfying
`project-overview.md`'s "automatic stacking of overlapping
people/events" requirement — this is a built-in vis-timeline behavior,
not custom logic.

**Zoom (window size):** `zoomMin`/`zoomMax` set to 10 and 250 years
respectively (converted to milliseconds — vis-timeline's own option, not
a `Temporal` value, since it's a *duration* for a legacy API, not a
calendar date). Mouse-wheel zoom, drag-to-pan, and touch pinch-zoom are
all vis-timeline defaults — no custom event handling needed to satisfy
"pan/zoom the way you would on a map."

**Pan (absolute range): bounded to 2750 BCE – today**, via vis-timeline's
`min`/`max` options — a separate constraint from `zoomMin`/`zoomMax`
above (that pair bounds the *window's size*; `min`/`max` bounds how far
the window's edges can ever travel). Invariant 5 in `architecture.md`
only speaks to window size, so this doesn't touch it; there's no
existing invariant for absolute pan range, so this is the first place
it's pinned down.

- **Floor: 2750 BCE**, not the round 2500 BCE first proposed. Checked
  both against the actual dataset before picking one: at -2500, the
  floor would have silently clipped **Khufu** (birthYear -2700, deathYear
  -2565) — a real top-344 person, not a data quirk — out of reach. -2750
  keeps his full bar reachable while still excluding every genuine
  outlier below it: `miniskirt` (-5000, the nearest of the three),
  `neolithic revolution` (-9000), and `Lascaux` (-16000).
- **Ceiling: today**, computed at runtime via `Temporal.Now.plainDateISO()`
  — a new `today()` export in `shared/lib/dates.ts` (a `Temporal.Now`
  read, not a `Date` construction, so Invariant 4 doesn't apply to it) —
  not a hardcoded year. This also excludes the one future-dated outlier,
  `Russo-Ukrainian war` (2100), without a separate special case: it's
  simply never before "today," whatever today is.
- The four outliers aren't deleted from the data or filtered out of what
  reaches `map-to-items.ts` — they still exist in the `DataSet`, just
  permanently outside the pannable window, so they're never reachable.
  This matches "limit timeline scroll... omitting the outliers"
  literally: the scroll limit *is* the omission mechanism, not a
  separate data filter.

**No click/selection/tooltip behavior** — `features/select-timeline-entity`
and `widgets/detail-panel` are Unit 6. Items are inert beyond
hover/zoom/pan in this unit.

### BCE date correctness (Invariant 4)

`Person.birthYear`/`deathYear` and `HistoricalEvent.date` are plain
integers using astronomical year numbering (e.g. Pericles' birth year is
stored as `-493`) — this already matches `Temporal.PlainDate`'s own ISO
calendar convention 1:1 (confirmed against `progress-tracker.md`'s note
that the pipeline emitted `-0493-01-01` for Pericles), so no sign
conversion happens anywhere in the frontend; the integer is passed
straight into `Temporal.PlainDate.from({ year, month: 1, day: 1 })`.

`toLegacyDate()` (the sole `Date`-construction point, confined to
`widgets/timeline-canvas/` per Invariant 4) uses **local**, not UTC,
setters:

```ts
function toLegacyDate(date: Temporal.PlainDate): Date {
  const legacy = new Date(0);
  legacy.setFullYear(date.year, date.month - 1, date.day);
  legacy.setHours(0, 0, 0, 0);
  return legacy;
}
```

This is deliberate, not an oversight: vis-timeline reads/displays
`Date`s in the browser's local timezone. Constructing via UTC setters
(`setUTCFullYear`) would put midnight Jan 1 UTC on the calendar, which
renders as **Dec 31 of the previous year** in any timezone behind UTC —
a real off-by-one-year bug for exactly the kind of correctness success
criterion 6 in `project-overview.md` calls out ("BCE and CE dates render
correctly... without errors or visual glitches"). Using local setters
throughout keeps the legacy `Date`'s local-calendar reading identical to
the source `Temporal.PlainDate`, regardless of the visitor's timezone.

### `Temporal` global installation

`code-standards.md` specifies "`Temporal.PlainDate` (from the `Temporal`
global, polyfilled)" — so the polyfill is installed as a global, once,
rather than imported per-file as a local ponyfill:

- `main.tsx` gets `import 'temporal-polyfill/global';` as its **first**
  line (before the `react-dom/client` and `./app` imports) — ES module
  import order guarantees this side-effecting module evaluates before
  anything that transitively references the ambient `Temporal` global.
  `temporal-polyfill`'s own `package.json` explicitly lists
  `global.esm.js` in its `sideEffects` array, so Rollup's production
  build won't tree-shake this import away.
- `tsconfig.app.json`'s `lib` array gains `"esnext.temporal"` (per
  `temporal-polyfill`'s own README, TS ≥ 6.0 ships ambient `Temporal`
  types under that lib name — worth double-checking this resolves
  cleanly against the repo's `typescript@^7.0.2`, given Unit 3 already
  hit two other TS7-compat surprises with unrelated tooling).
- Vitest doesn't execute `main.tsx`, so a `src/setup-tests.ts` file
  (wired via `vite.config.ts`'s `test.setupFiles`) re-installs the same
  global for the test environment — see Implementation step 8.

### File shape

```
packages/web/src/
├── main.tsx                          # + temporal-polyfill/global import
├── setup-tests.ts                    # new — Vitest global setup
├── shared/
│   ├── types/
│   │   └── index.ts                  # re-exports Person, HistoricalEvent, Category, Region
│   ├── lib/
│   │   ├── dates.ts                  # yearToPlainDate(), toLegacyDate()
│   │   └── dates.test.ts
│   └── config/
│       └── viewport.ts               # ZOOM_MIN/MAX_YEARS, DEFAULT_VIEWPORT_START/END
│   [shared/index.ts deleted — see Assumption 3]
├── features/
│   └── index.ts                      # untouched — Unit 6+
├── widgets/
│   └── timeline-canvas/
│       ├── index.ts                  # export { TimelineCanvas }
│       ├── TimelineCanvas.tsx
│       ├── TimelineCanvas.module.css
│       ├── TimelineCanvas.test.tsx
│       ├── options.ts                # GROUPS, buildTimelineOptions()
│       ├── options.test.ts
│       ├── map-to-items.ts           # mapPeopleToItems(), mapEventsToItems()
│       └── map-to-items.test.ts
│   [widgets/index.ts deleted — see Assumption 3]
└── app/
    ├── index.ts                      # unchanged
    ├── App.tsx                       # loads datasets, renders heading + TimelineCanvas
    ├── App.module.css                # new — visually-hidden heading utility
    ├── App.test.tsx                  # rewritten — see Implementation step 8
    └── global.css                    # unchanged (Unit 5's job)
```

## Implementation

Build in this order:

1. **`shared/types/index.ts`** — re-export `Person`, `HistoricalEvent`,
   `Category`, `Region`, `CATEGORIES`, `REGIONS` from
   `@same-sky/shared-types`. Compile-time-only, same pattern as
   `data-pipeline`'s existing `import type { Person, HistoricalEvent }
   from "@same-sky/shared-types"`.

2. **`shared/lib/dates.ts`** — three exports, all operating on the
   ambient `Temporal` global (no import of `Temporal` itself, per the
   global-installation design above):
   - `yearToPlainDate(year: number): Temporal.PlainDate` —
     `Temporal.PlainDate.from({ year, month: 1, day: 1 })`. Usable
     anywhere a raw year field needs a calendar-date representation;
     not confined to `timeline-canvas`.
   - `today(): Temporal.PlainDate` — `Temporal.Now.plainDateISO()`. A
     system-clock read, not a `Date` construction and not a network
     call, so neither Invariant 4 nor Invariant 6 applies to it.
   - `toLegacyDate(date: Temporal.PlainDate): Date` — the sole
     `Date`-construction point (Invariant 4), local-time setters as
     specified in Design. **Document at the top of the file, and in
     `code-standards.md`, that this function must only be called from
     `widgets/timeline-canvas/`.**
   `dates.test.ts` covers: `yearToPlainDate` on a CE year (e.g. 1800)
   and a BCE year (e.g. -493, asserting `.year === -493`); `toLegacyDate`
   round-tripping both, asserting `.getFullYear()` matches and
   `.getMonth()/.getDate()` are `0`/`1`; `today()` asserting its `.year`
   matches `Temporal.Now.plainDateISO().year` called independently in
   the test (comparing against the same live call, not a hardcoded
   year, so the test doesn't rot).

3. **`shared/config/viewport.ts`** — `ZOOM_MIN_YEARS = 10`,
   `ZOOM_MAX_YEARS = 250`, `DEFAULT_VIEWPORT_START` /
   `DEFAULT_VIEWPORT_END` as `Temporal.PlainDate` values for
   1800-01-01 / 1900-01-01 (see Assumption 1), and `PAN_MIN_DATE` as
   `Temporal.PlainDate.from({ year: -2750, month: 1, day: 1 })` (see the
   Pan boundary section in Design). No `PAN_MAX_DATE` constant here —
   the ceiling is `today()`, a runtime value, not configuration; it's
   computed directly in `options.ts` (step 6).

4. **`tsconfig.app.json`** — add `"esnext.temporal"` to the `lib` array;
   add `"resolveJsonModule": true` (needed for the direct
   `people.json`/`events.json` imports in step 7).

5. **Install dependencies** — `vis-timeline` and `temporal-polyfill` in
   `packages/web`'s `package.json` (see Dependencies table below). Both
   ship their own types; no separate `@types/*` package exists or is
   needed for either.

6. **`widgets/timeline-canvas/options.ts`** — `GROUPS: DataGroup[]`
   (the `people`/`events` group definitions, defined once per
   `code-standards.md`), and `buildTimelineOptions(): TimelineOptions`
   returning `{ stack: true, zoomMin, zoomMax, min, max, start, end,
   height: '100vh' }`:
   - `zoomMin`/`zoomMax` computed from `shared/config/viewport.ts`'s
     `ZOOM_MIN_YEARS`/`ZOOM_MAX_YEARS` via a
     `MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000` local constant
     (Julian-year approximation — sub-day precision is irrelevant to a
     duration bound).
   - `min` via `toLegacyDate(PAN_MIN_DATE)`; `max` via
     `toLegacyDate(today())` — `today()` called once, at options-build
     time (this component's mount), not re-evaluated live while the tab
     stays open, consistent with the rest of the app's state being
     session-static rather than live-updating.
   - `start`/`end` via `toLegacyDate(DEFAULT_VIEWPORT_START/END)`.
   `options.test.ts` covers: `buildTimelineOptions().min`'s legacy-`Date`
   year is `-2750`; `.max`'s year matches `today().year` (called
   independently in the test, same live-comparison pattern as
   `dates.test.ts`'s `today()` test, to avoid a test that goes stale);
   `zoomMin`/`zoomMax` match the expected millisecond values for 10 and
   250 years.

7. **`widgets/timeline-canvas/map-to-items.ts`** — `mapPeopleToItems(people:
   Person[]): DataItem[]` and `mapEventsToItems(events: HistoricalEvent[]):
   DataItem[]`, both using `yearToPlainDate` + `toLegacyDate` per item,
   tagging `group: 'people' | 'events'`, `type: 'range' | 'point'`, and
   `className: `category-${category}`` (see Assumption 6). Covered by
   `map-to-items.test.ts`: a person with both years → correct
   start/end/group/type; the no-`deathYear` case → end falls back to
   `birthYear + 1` without throwing; an event → `point` type with no
   `end` field.

8. **`widgets/timeline-canvas/TimelineCanvas.tsx`** — functional
   component, props `{ people: Person[]; events: HistoricalEvent[] }`.
   Two effects on a `useRef<HTMLDivElement>`:
   - Mount effect (`[]` deps): construct `new Timeline(container, [],
     GROUPS, buildTimelineOptions())` once, store the instance in a
     ref, `timeline.destroy()` on cleanup.
   - Data effect (`[people, events]` deps): `timeline.setItems([
     ...mapPeopleToItems(people), ...mapEventsToItems(events) ])`.
     Splitting these (rather than one effect with `[]` deps) costs
     nothing today, since `people`/`events` never change in this unit,
     but means Unit 7's filtering doesn't require touching this
     component's lifecycle logic, only its inputs.
   Plain arrays are used for both `items` and `groups` (not
   vis-timeline's mutable `DataSet`) — deliberately, since this app
   never mutates its own data at runtime (Invariant 1); there is no
   two-way binding to set up.
   Imports `vis-timeline/styles/vis-timeline-graph2d.css` directly in
   this file — the one place a third-party global stylesheet is
   imported outside `app/global.css`, since it's library-required base
   chrome, not app-authored CSS (`code-standards.md`'s "no global
   stylesheets" rule targets app code, not a vendor library's own
   required styles).
   `TimelineCanvas.module.css`: `.container { width: 100%; }` (height is
   set programmatically via the `height: '100vh'` option, not CSS).

   **`TimelineCanvas.test.tsx`** — per Assumption 4, mocks
   `vis-timeline/standalone`'s `Timeline` export (`vi.mock`) so no real
   DOM-measuring vis-timeline code runs under jsdom. Asserts: rendering
   `<TimelineCanvas people={fixturePeople} events={fixtureEvents} />`
   constructs the mocked `Timeline` exactly once, with an `items` array
   of length `fixturePeople.length + fixtureEvents.length`, the `GROUPS`
   array, and options containing the expected `zoomMin`/`zoomMax`
   millisecond values.

9. **`widgets/timeline-canvas/index.ts`** — `export { TimelineCanvas }
   from './TimelineCanvas';`. Delete `widgets/index.ts` (see
   Assumption 3).

10. **`app/App.tsx`** — imports `peopleData` from
    `@same-sky/shared-types/src/data/people.json` and `eventsData` from
    `.../events.json`, each cast once (`as Person[]` / `as HistoricalEvent[]`
    — a scoped type assertion, not `any`; this is pipeline-generated,
    already-validated build-time data, not unknown runtime input, so no
    runtime validation is warranted here). Renders a visually-hidden
    `<h1>World History Timeline</h1>` (via `App.module.css`, standard
    sr-only clip pattern — see Assumption 5) followed by `<TimelineCanvas
    people={peopleData} events={eventsData} />`. Delete `shared/index.ts`
    (see Assumption 3).

    **`App.test.tsx`** — rewritten: same `vis-timeline/standalone` mock
    as `TimelineCanvas.test.tsx` (each test file declares its own
    `vi.mock`, per Vitest's per-file mock scoping), asserting `render(<App
    />)` doesn't throw and that the hidden heading text is present via
    `screen.getByText('World History Timeline', { selector: 'h1' })`.

11. **`main.tsx`** — add `import 'temporal-polyfill/global';` as the
    first line, before the existing `react-dom/client` and `./app`
    imports.

12. **`src/setup-tests.ts`** — `import 'temporal-polyfill/global';` (so
    `dates.test.ts` and any Temporal-dependent code under test has the
    global installed, mirroring `main.tsx`'s role for the app itself).
    Wire it into `vite.config.ts`'s `test.setupFiles: ['./src/setup-tests.ts']`.

13. **`steiger.config.ts`** — narrow the `fsd/no-layer-public-api`
    override's `files` list to `['src/features/index.ts']` only (see
    Assumption 3); leave `fsd/insignificant-slice: 'off'` as-is, since
    `features/` is still a genuinely empty placeholder layer.

14. **`code-standards.md`** — this unit adds two new top-level
    dependencies (`vis-timeline`, `temporal-polyfill`); confirm both
    already have Stack-table rows (they do, from initial planning) so
    no edit is needed there. Update the File Organization section's
    `shared/`/`widgets/` bullets if implementation reveals the actual
    structure diverges from what's described above.

15. **Verify locally**: `npm install` from repo root, then from
    `packages/web/`: `npm run typecheck`, `npm run lint`, `npm run
    lint:boundaries`, `npm run test`, `npm run build`, and `npm run dev`
    — confirm in an actual browser that two lanes render with real
    entries, mouse-wheel zoom stops at 10/250-year windows, dragging
    pans smoothly, and both BCE (e.g. Pericles, born -493) and CE
    entries land in the visually correct position relative to the axis.

16. **Update `progress-tracker.md`**: mark Unit 4 complete, log the
    real dependency versions installed, the six flagged assumptions,
    and the empirical jsdom/vis-timeline finding (Assumption 4) as a
    session note for future units (Unit 6's click-handler wiring will
    hit the same mocking need).

## Dependencies

New packages for `packages/web` only (`data-pipeline` and
`shared-types` are untouched by this unit). Versions verified against
the npm registry at spec time:

| Package | Version | Why |
|---|---|---|
| `vis-timeline` | `^8.5.2` | Timeline rendering, per `architecture.md`'s Stack table. Standalone build (bundles moment.js + vis-data internally) — import from `vis-timeline/standalone`, not the bare package root (which resolves to the `peer` build, expecting moment as an external peer dependency) |
| `temporal-polyfill` | `^1.0.2` | `Temporal.PlainDate` polyfill, per `architecture.md`'s Stack table. Installed via the `temporal-polyfill/global` entrypoint (see Design) |

**Not installed**: any `@types/vis-timeline` or `@types/temporal-polyfill`
package — both ship their own bundled `.d.ts` files (`vis-timeline`'s
`declarations/index.d.ts`; `temporal-polyfill`'s ambient types come from
TypeScript's own `esnext.temporal` lib, not a package).

## Verification Checklist

1. `npm run typecheck` is clean — strict mode, no `any` anywhere in the
   new files (the two `as Person[]`/`as HistoricalEvent[]` casts in
   `App.tsx` are scoped type assertions, not `any`).
2. `npm run lint` and `npm run lint:boundaries` (Steiger) are clean — no
   upward or sideways FSD imports; `widgets/timeline-canvas/` imports
   only from `shared/` (no `features/` import exists yet, correctly,
   since no feature slice exists until Unit 6+).
3. `npm run test` passes: `dates.test.ts`, `options.test.ts`,
   `map-to-items.test.ts`, `TimelineCanvas.test.tsx`, `App.test.tsx` all
   green.
4. `npm run build` produces a `dist/` bundle with no errors; confirm
   via `npm run preview` that the built (not just dev-served) bundle
   also renders correctly — the `temporal-polyfill/global` sideEffects
   declaration matters specifically for the production Rollup build,
   not the dev server.
5. Manual browser check (`npm run dev`): two lanes visible and
   populated; overlapping lifespans in a dense era (e.g. 1750–1950)
   stack without visual collision; mouse wheel zooms in to a 10-year
   floor and out to a 250-year ceiling and no further; dragging pans
   smoothly; default view on load is the 1800s; a BCE entry (Pericles,
   -493) and a CE entry render in correct relative position on one
   continuous axis with no visual glitch; dragging/zooming toward either
   edge stops exactly at 2750 BCE and today, respectively, and never
   reaches `Lascaux`, `neolithic revolution`, `miniskirt`, or the
   2100-dated `Russo-Ukrainian war`; Khufu (-2700 to -2565) remains
   reachable just inside the floor.
6. Every date value uses `Temporal.PlainDate`; `toLegacyDate()` in
   `shared/lib/dates.ts` is the only place a `Date` is constructed, and
   it is only called from within `widgets/timeline-canvas/` (Invariant 4)
   — confirm via `grep -rn "new Date(" packages/web/src`.
7. Filters: N/A this unit — no filtering exists yet (Units 7–9); noting
   as genuinely not-yet-applicable rather than silently skipped.
8. No runtime fetch of any kind exists in `packages/web` — Invariant 6
   trivially holds; data enters only via the two static JSON imports.
9. Nothing outside the pipeline's Output stage writes to
   `packages/shared-types/src/data/*.json` — confirm via `git status`/
   `git diff` scoped to `packages/shared-types` and `packages/data-pipeline`
   (both should show zero changes).
10. `shared/index.ts` and `widgets/index.ts` are deleted;
    `steiger.config.ts`'s `fsd/no-layer-public-api` override now lists
    only `src/features/index.ts`; Steiger still passes (confirms the
    real `shared/types`, `shared/lib`, `shared/config`, and
    `widgets/timeline-canvas` structure doesn't need that override).
11. The viewport never exceeds 10–250 years regardless of how far the
    user zooms (Invariant 5) — checked live in the browser, not just by
    reading the `zoomMin`/`zoomMax` option values back.
12. The pannable range never exceeds 2750 BCE – today (the new pan
    boundary decision) — checked live in the browser, not just by
    reading `options.min`/`options.max` back; `options.test.ts` and
    `dates.test.ts`'s `today()` tests compare against a live
    `Temporal.Now.plainDateISO()` call rather than a hardcoded year, so
    they don't silently go stale.
13. `progress-tracker.md` updated in this same unit (Implementation
    step 16) — phase, completed list, the six flagged assumptions, the
    2750-BCE-vs-2500-BCE pan-floor decision (and why — Khufu), and the
    jsdom/vis-timeline finding logged for Unit 6 to reuse without
    rediscovering it.
