# Dynamic tooltips — spec

Status: ready to hand to `/implement`. Produced by the "Dynamic tooltips" map (`.scratch/dynamic-tooltips/map.md`) — this file is the map's destination, not a ticket answer; the three tickets under `issues/` hold the decision trail this spec was assembled from.

## 1. What's being replaced

Today, every rendered mark in all three lanes (`packages/web/src/widgets/timeline-canvas/{PeopleLane,WarsLane,EventsLane}.tsx`) carries one precomputed `tooltip: string` field (built in `map-to-items.ts`) rendered via a native SVG `<title>` element — a plain-text browser hover tooltip, no images, no links, no layout. This spec replaces that mechanism entirely with a custom React-rendered side drawer.

## 2. Interaction model

**Trigger**: click (not hover). Settled by live comparison of three prototype variants — see `issues/02-prototype-tooltip-interaction.md`'s `## Answer` for the full rejection rationale (hover was fastest to scan but crowds multi-reign-period content and needs a still-undecided intent delay; click-to-pin-at-the-mark goes stale the moment the user pans).

**Presentation**: a panel docked to the right edge of the viewport, fixed height (full viewport height), scrollable if content overflows. It does **not** anchor to the clicked mark's screen position — no `getBoundingClientRect()` coordinate math, no repositioning logic on scroll/pan/zoom. This is a deliberate simplification, not just a UX preference: it means the real implementation never needs to solve "what happens to an open tooltip when the user pans/zooms the timeline underneath it," because the drawer's position is entirely independent of the timeline's scroll state.

**Dismiss**: any of —
- the drawer's own close (×) button
- `Escape`
- clicking anywhere outside the drawer (added after the prototype's initial x/Escape/click-a-different-mark set, once Variant C won — see ticket 02's `## Answer`)
- clicking a different mark (swaps the drawer's content in place rather than closing-then-reopening)

**Single global instance**: one drawer, app-wide — not one per entity. Clicking a new mark while the drawer is open replaces its content; it never stacks multiple drawers.

**Click-wiring architecture**: one delegated `click` listener attached to `TimelineCanvas`'s scroll container, not three separate listeners wired individually into `PeopleLane`/`WarsLane`/`EventsLane`. Each Lane's D3 join gets two additional `.attr()` calls on its mark elements (`.d3-line` / `.d3-dot`) — `data-entity-id` and `data-entity-type` (`"person" | "war" | "discovery"`) — and the delegated listener resolves a click via `event.target.closest('[data-entity-id]')`. This is a real architecture decision, not just a prototype convenience: it keeps all click-handling logic in one place instead of duplicating near-identical D3 `.on()` wiring three times over, and it composes cleanly with the existing drag-to-pan `pointerdown`/`pointermove` handlers already on that same container. The prototype (`prototype/dynamic-tooltips-tooltip-interaction`, commit `0a21ce3`) demonstrates this mechanism working end-to-end and is a legitimate starting point for the real implementation, though its inline styles and hardcoded sample images should not be — see §7.

**On-demand rendering**: nothing about tooltip content is precomputed for the full filtered dataset up front, unlike today's `tooltip: string` field. The drawer looks up the clicked entity's full object (already in memory — `people`/`wars`/`discoveries` are already loaded as props into `TimelineCanvas`/`App.tsx`) by id only at click time, and builds its display content then. `map-to-items.ts`'s `PersonItem`/`WarItem`/`DiscoveryItem` interfaces drop their `tooltip: string` field entirely — it has no remaining reader once the drawer ships.

## 3. Content templates

All four entity shapes (`Person`, `War`, `WarEvent`, `Discovery` — see `packages/shared-types/src/index.ts`) render into the same drawer chrome (image banner → name → date line → body → Wikipedia button), but which body rows appear depends on entity type.

### 3.1 Common to every type

| Row | Source | Notes |
|---|---|---|
| Image banner | `image` (new field, §4) | Full-width, top of drawer. **Omitted entirely** (no placeholder) when the entity has no `image` — either no P18 claim, or the `<img>` fails to load at runtime (Commons hotlinks aren't guaranteed stable — see `research/image-sourcing.md` §2). A plain `onError` handler that unmounts/hides the image element (not a broken-image icon) covers the runtime-404 case; the "no `image` field at all" case just never renders the slot to begin with. |
| Credit line | `imageAttribution` (new field, §4) | Small caption directly under the image, shown **only** when present. Present only when the image's Commons license requires attribution (§4.2) — most images (public domain) carry no credit line at all. |
| Name | `name` | |
| Date line | type-specific, see below | |
| Description | `description` | Already short in the published data (avg 44–55 chars, max 245 — no truncation needed, confirmed during charting) |
| Wikipedia button | `wikipediaUrl` | Styled as a button (not a bare link) per the prototype's `VariantC.tsx`, `target="_blank"` |

### 3.2 Person

- Date line: `${formatYearMonth(lifespan.start)} – ${lifespan.end ? formatYearMonth(lifespan.end) : 'present'}` — reuses the existing `formatYearMonth` (`shared/lib/format-year.ts`), same "present" fallback `map-to-items.ts`'s current `mapPeople` already uses for `endLabel`.
- Reign periods (`reignPeriods?: ReignPeriod[]`): when present, a bulleted list between the description and the Wikipedia button, one line per period: `${title ?? 'Reign'}: ${formatYearMonth(start)} – ${end ? formatYearMonth(end) : 'present'}`. Ordered as given (`reignPeriods` is already sorted ascending by start year per its shared-types doc comment). No line-count cap — the drawer's roominess (vs. a hover popover) was specifically chosen so a person with several reign periods (Napoleon: 5, verified live in the prototype) never crowds. This is `reignPeriods`' first real frontend usage anywhere in the app.
- Image: from `image` (People P18 coverage: 99.02%, `research/image-sourcing.md`).

### 3.3 War (always a `Period`, i.e. has `period.start`/`period.end?`)

- Date line: `${formatYearMonth(period.start)} – ${period.end ? formatYearMonth(period.end) : 'present'}` (an ongoing war, e.g. the currently-open Russo-Ukrainian war entry, renders "present" the same way an ongoing lifespan does).
- Part-of-war line: when `partOfWarName` is present, its own row: `Part of: ${partOfWarName}` — carried forward from today's plain-text tooltip (`map-to-items.ts`'s current `mapWars`: `` `${entry.name} — part of ${entry.partOfWarName}` ``), just laid out as a separate row instead of concatenated into one string.
- **No image** — Wars & Conflicts is explicitly out of scope for images (`map.md`'s Out of scope; user decision made mid-effort). The image banner and credit-line rows never render for a `War`, full stop, regardless of what a future `image` field might contain.

### 3.4 WarEvent (always a `PointInTime`, i.e. has `at`)

- Date line: `formatYearMonth(at)` — a single point, not a range.
- Part-of-war line: same as War, `partOfWarName` when present.
- No image, same reason as War.

### 3.5 Discovery (always a `PointInTime`)

- Date line: `formatYearMonth(at)`. In practice this is always year-only — the hand-curated source (`data/raw/events-curated.raw.json`) has no month field, so `at.month` is never populated for Discoveries even though the type permits it.
- No reign periods, no part-of-war line (Discovery has neither field).
- Image: from `image` (Discoveries & Inventions P18 coverage: 89.26%).

## 4. Data model changes

### 4.1 `image` field

Add to `TimelineEntry` (`packages/shared-types/src/index.ts:135-141`, alongside the existing `description`/`wikipediaUrl`):

```ts
export interface TimelineEntry {
  id: string;
  name: string;
  fameScore: number;
  description: string;
  wikipediaUrl: string;
  image?: string;
  imageAttribution?: string;
}
```

- `image`: the raw Wikidata P18 `Special:FilePath` URI, stored **exactly as SPARQL returns it** — no pipeline-side transformation, no width baked in. Same convention `wikipediaUrl` already uses on this interface. Absent means no P18 claim (or, for `War`/`WarEvent`, simply never populated — see §3.3).
- `imageAttribution`: a plain display-ready credit string (e.g. `"Jacques-Louis David, via Wikimedia Commons"`), populated **only** when the image's Commons license requires attribution. Absent both when there's no image and when the image's license doesn't require a credit (the common case for older/historical subjects, which this dataset skews toward).
- The frontend appends `?width=<n>` to `image` at render time (a plain string append, not a URL rebuild) — confirmed live in `research/image-sourcing.md` §2.2 (a `width` query param on the SPARQL-returned `Special:FilePath` URI redirects through to a resized thumbnail; the prototype used `200`, sized for its smaller card variants — for the wider drawer banner, `400` is a better fit for the 340px-wide panel at typical device pixel ratios; not load-bearing, adjust freely at implementation time).

### 4.2 Licensing/attribution wiring

Decided during charting: fetch and store attribution metadata rather than restricting scope to Public-Domain-only images — keeps the full measured coverage (People 99.02%, Discoveries 89.26%) instead of silently dropping the CC-licensed fraction, which skews toward modern/living subjects.

For each entity that resolves a P18 image, a follow-up call to the Commons `imageinfo` API (not Wikidata SPARQL — a separate MediaWiki API, `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata&titles=File:<name>&format=json`, confirmed live in `research/image-sourcing.md` §2) returns `LicenseShortName`, `AttributionRequired`, `Artist`, `Credit`. When `AttributionRequired` is `true`, build `imageAttribution` from `Artist`/`Credit` (whichever the API populates — both were seen live during research); when `false` (the common case), leave `imageAttribution` unset.

This is a **second, per-file API call** distinct from the batched SPARQL enrichment passes — `titles=` accepts multiple `|`-separated filenames per request (standard MediaWiki API batching, up to 50 per call for unauthenticated requests), so it should be batched the same way `batchedSparqlFetch` batches QIDs, not one request per image. This is new pipeline machinery (a new fetch helper alongside `batched-sparql-fetch.ts`, not a reuse of it, since it's a different API/protocol), not just an extra `OPTIONAL` clause on an existing query — heavier than the plain `image` field alone, called out explicitly here so a future `/implement` session doesn't underestimate it.

### 4.3 Fetch-stage wiring, per lane

Mirrors the existing description/reigns/events-enrichment pattern (`packages/data-pipeline/src/fetch/queries/{descriptions,events-enrichment}.ts`, `batched-sparql-fetch.ts`):

- **People** (`fetch-descriptions.ts` / `queries/descriptions.ts`): add `OPTIONAL { ?person wdt:P18 ?image . }` to `buildDescriptionsQuery`'s existing per-QID `VALUES` query (same query that already backfills `description`) — no new SPARQL pass needed for the URI itself.
- **Discoveries** (`fetch-events-enrichment.ts` / `queries/events-enrichment.ts`): same idea, add `OPTIONAL { ?event wdt:P18 ?image . }` to `buildEventsEnrichmentQuery`.
- **Both lanes**: after the SPARQL pass resolves `image` URIs, a new batched Commons `imageinfo` pass (§4.2) resolves `imageAttribution` for every entity that got an `image`. This can run as its own small fetch step (e.g. `fetch-image-attribution.ts`) reading the just-written raw output back off disk, same "raw file is the handoff between fetch steps" pattern `fetch-descriptions.ts`/`fetch-reigns.ts` already use.
- **Wars & Conflicts**: no changes — out of scope, no `image`/`imageAttribution` ever populated for `War`/`WarEvent`.
- Transform/Output stages: no new logic needed beyond passing `image`/`imageAttribution` through — they're optional fields on `TimelineEntry`, same shape-passthrough treatment `description`/`wikipediaUrl` already get.

## 5. Frontend changes, summary

- `packages/shared-types/src/index.ts`: `image?`/`imageAttribution?` added to `TimelineEntry` (§4.1).
- `packages/web/src/widgets/timeline-canvas/map-to-items.ts`: `PersonItem`/`WarItem`/`DiscoveryItem` drop `tooltip: string`. No new fields needed here — the drawer looks up full entities by id directly (§2, "On-demand rendering"), it doesn't consume the mapped render-item shapes at all.
- `PeopleLane.tsx`/`WarsLane.tsx`/`EventsLane.tsx`: each mark gains `data-entity-id`/`data-entity-type` attributes (§2). The existing `.select('.d3-line title')`/`.select('.d3-dot title')` calls and their `<title>` child elements are deleted — no more native tooltips anywhere.
- `TimelineCanvas.tsx`: gains the delegated click listener (§2) and a callback prop to report clicks up to whatever owns the drawer's open/closed state (`App.tsx`, mirroring how `fameScoreValues` is already owned there and threaded down).
- A new drawer component (structure, not exact naming — implementation's call): image banner + credit line + name + date line + body rows (§3) + Wikipedia button, built as real styled components (CSS Modules, per this package's actual convention — the prototype's inline styles were a prototype-only shortcut, not to be carried forward).

## 6. Explicitly not this map's job

- Writing any of the above code — this spec is the deliverable; implementation is a separate, not-yet-started follow-on effort (name/scope it fresh when picked up).
- Wars & Conflicts images (§3.3) — ruled out of scope mid-effort, stays out unless a future effort redraws the destination.
- Coordinating with the in-progress initial-load/progressive-loading performance effort (`docs/active-context.md`) — confirmed independent during charting; different code path (per-click cost, not initial page load).
- Sizing the CC-vs-PD tradeoff quantitatively across the full corpus, or picking the exact `?width=` pixel value — both explicitly left as implementation-time judgment calls, not specified numerically here.

## 7. Reference material for `/implement`

- Prototype (interaction/layout reference only, not production code): branch `prototype/dynamic-tooltips-tooltip-interaction`, commit `0a21ce3`. Demonstrates the delegated-listener mechanism and drawer layout working end-to-end against real data; uses inline styles and hardcoded sample `image` URLs (no such field exists in the published data yet) that should not be copied as-is.
- Research findings (image coverage, URL/thumbnail pattern, licensing evidence): `.scratch/dynamic-tooltips/research/image-sourcing.md`.
- Full decision trail: `.scratch/dynamic-tooltips/issues/01-research-image-sourcing.md`, `02-prototype-tooltip-interaction.md`, `03-finalize-tooltip-spec.md`.
