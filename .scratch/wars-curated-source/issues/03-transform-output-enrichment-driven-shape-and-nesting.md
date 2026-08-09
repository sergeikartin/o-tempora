# 03 — Transform/Output: enrichment-driven shape + `parentId` nesting validation

Type: task
Status: open
Blocked by: 02

## Question

**`transformWars` rewrite** (`src/transform/index.ts`): read `data/raw/wars-curated-enriched.raw.json` directly — no `groupRows` step, already one row per conflict, same reasoning `transformDiscoveries`/`transformPeople` document — replacing the old 9-file SPARQL read + `dedupeFirstById` concatenation.

**`buildWars` rewrite** (`src/output/write-datasets.ts`), shape decoupled from `category` and from curator input entirely:

- A row that resolved **both** a start and an end date (ticket 02's enrichment) becomes a `War` (`period: { start, end }`).
- A row that resolved **only one** date (a point-in-time claim, or a start with no end) becomes a `WarEvent` (`at`).
- A row that resolved **no** date at all is dropped with a new `DropReport` reason: `"missing date (enrichment failed)"` — same posture as Discoveries' `"missing sitelinks (enrichment failed)"`.
- This retires `BAR_RENDERED_TYPE_QIDS`-style gating entirely (ticket 04 deletes the constant itself once this lands).
- A Container is simply a `War` (any in-scope category, resolved both dates, no `parentId`) — not restricted to `category: "war"`.

**`parentId` validation**, also in `buildWars`, run after the shape decision above:

- `parentId` must resolve to another row that survived validation (not one dropped for missing date/sitelinks).
- The resolved row must be a `War`, never a `WarEvent`.
- Depth must not exceed 3 levels (Container → level 2 → level 3). A `WarEvent` may not itself be pointed at by another row's `parentId` (no fourth level, no branching off a point).
- Any violation drops the *offending* row (not its parent/children) with a new `DropReport` reason distinguishing the failure mode, e.g. `"parentId not found"`, `"parentId is not a War"`, `"nesting depth exceeded"` — pick reason strings consistent with the existing terse style (`record(reasons, "...")`).

**Tests**:

- `write-datasets.test.ts` — extend with: a row with both dates → `War`; a row with one date → `WarEvent`; a row with no date → dropped; a valid 2-level chain kept; a valid 3-level chain kept; an event-parented-to-event dropped; a parent reference to a nonexistent id dropped; a parent reference to a `WarEvent` dropped; a chain exceeding 3 levels dropped. Each with the correct `DropReport` reason.
- `transform/index.test.ts` — extend with a `transformWars` case reading a small synthetic curated+enriched fixture, mirroring the existing `transformDiscoveries` test.

## Answer
