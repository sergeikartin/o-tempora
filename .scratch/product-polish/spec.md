# Product polish — spec

The pre-launch pass that makes otempora.info read as a polished product to a cold visitor arriving from a shared link. Presentation, UX and trust work only; every design decision below is locked by the linked ticket. Charting context: [map.md](map.md). Evidence: [research/live-site-audit.md](research/live-site-audit.md).

The "aha" every item serves: **see who lived at the same time as whom, and what else was happening.**

## How to read this spec

- Items are in **implementation order**. Each merges to `main` as it lands and is independently deployable, except 9 and 10, which go live together (the landing page is the switch that changes what `/` shows).
- "Docs" lists the living docs to update in the same unit of work; "ADR" lists the decisions to record. Neither is optional (see `CLAUDE.md`, doc upkeep).
- Russian parity is part of every item that adds or renames a string: Claude drafts, the owner reviews before the strings land.

## Items

### 1. Image and data defects

Audit findings 4, 5, 13 · map "Settled for the spec"

- A curated denylist of entity ids in the data pipeline drops `image` (Muhammad `18934` to start).
- The same pipeline pass rewrites `http://` image URLs to `https://` and resolves the Commons redirect chain to the final thumbnail URL.
- `DetailPanel` reserves the image slot's height so the panel doesn't open on a blank block; the close "×" gets a backing over the image.
- Regenerate datasets and verify no Mixed Content warnings.

Docs: `packages/data-pipeline/docs/` (denylist and URL normalisation).

### 2. Branded bilingual 404

Audit finding 8 · map "Settled for the spec"

One `404.html` in the parchment style, bilingual, with links to `/` and `/ru/`, no timeline JS.

Docs: `docs/deployment.md`.

### 3. Plain-language labels and Russian level names

[Ticket 05](issues/05-plain-language-labels.md) · audit findings 6, 9

- Renames: occupation filter heading "People" → **Occupation**; "Institutions" → **Politics & Religion**; "Public Figure" → **Public Figures**; "Social & Human Culture" → **Society & Culture**. Detail Level names stay, gaining the hint "How much to show, most famous first." (the hint's placement is items 4 and 6).
- Russian equivalents for all renames; the cryptic slider stops `Профи` and `Детали` get full level names.
- Landing copy says "conflicts", not "wars" (item 10).

Docs: `packages/web/docs/design-tokens.md` (renamed palette entries), `CONTEXT.md` (**Occupation Domain**, **Detail Level** display names).

### 4. Timeline desktop frame

[Ticket 09](issues/09-prototype-first-view-frame.md) · wireframes `wireframes/first-view/` · audit findings 3, 6, 7

- Top bar: logo, search, Detail Level as a visible segmented control with the "Show" label, a Region button, and the help affordance slot (filled by item 6). The sidebar is removed.
- The canvas starts at the lane gutter's edge, so marks and the axis start no longer clip under a floating card.
- Both lanes are labelled in a left gutter ("People": "Who lived when. Click a field to show only it."; "Conflicts & Milestones": "Bars last years. Dots are moments."), visible while the canvas pans.
- The eight Occupation chips sit in the People gutter and the three group chips in the Conflicts & Milestones gutter, each keeping its domain-colour dot. Nothing selected means show all; selected chips get a tinted fill, a domain-colour border and a ✓; a "Show all fields" link appears once any is selected.
- Region is a top-bar popover grouped by continent, button "Region · N", solid when active.
- A "Showing only" row of removable chips plus "Clear all" sits under the top bar while any filter is on.
- The Detail Level hint's visible form is left to the implementation: the per-level helper text stays, and a visible desktop hint line may be added.

ADR: `packages/web/docs/adr/` — sidebar replaced by top bar and lane-gutter filters (reverses the sidebar-filters design).
Docs: `packages/web/docs/design-tokens.md`, `packages/web/docs/timeline-rendering.md`, `docs/product-scope.md`, `CONTEXT.md` (sidebar references in **Locale**, **Occupation Domain**, **Milestone Category Group**, **Detail Level**).

### 5. Phone first screen

[Ticket 09](issues/09-prototype-first-view-frame.md) · audit finding 2

- A labelled "Region" button replaces the bare hamburger; Detail Level is a full-width segmented control under the top bar.
- Lane tags with a ▾ label both lanes; tapping one opens a "Show only…" card of that lane's chips.
- Region opens as a bottom sheet with a "Show N results" button; active filters show as chips under the Detail Level control.
- A visible +/− zoom control stays on screen.
- Verify the "?" and Region button stay reachable at 320 px.
- The empty bottom third with a sparse Conflicts & Milestones lane is not solved by a filler; the lane tag and zoom control are the only additions.

Docs: `packages/web/docs/` (mobile layout; check against `adr/0008-mobile-layout-…`).

### 6. Help and Empty Lane states

[Ticket 06](issues/06-prototype-in-app-help.md) · wireframes `wireframes/help/`

- A "?" at the right end of the top bar opens **Help**: a popover on desktop, a bottom sheet on phone. Content: "How to read this timeline" (the landing's three points, same message keys), a "Detail Level — how much to show, most famous first." line (also the control's accessible description), a one-line colour key ending "Conflicts are always red", and a footer row with "About & data" (opens the existing About modal) and the language switch.
- Always opened by the visitor: no auto-open, no pulsing dot, no persisted "seen" state. `?` opens and Escape closes.
- The About modal stays as it is and keeps the "Report a problem or suggest an entry" link to GitHub Issues (the only feedback path).
- **Empty Lane** messages, per lane, only when the lane is completely empty: filters hiding everything → "Nothing matches these filters" with "Clear all filters"; nothing at the current Detail Level → "Nothing at this Detail Level in this period" with "Show more · <next level>"; at Deep Cut → "Nothing recorded in this period" with no action.
- Russian string lengths for Help, the colour key and the Empty Lane messages are checked in the Russian review.

Docs: `docs/product-scope.md`, `CONTEXT.md` (**Help**, **Empty Lane** — added).

### 7. Accessibility and touch-target sweep

Audit findings 10, 11 · map "Settled for the spec". Runs after the frame (items 4–6), since they change most targets.

- Fix axe `color-contrast` (century label), `scrollable-region-focusable` ×3 (timeline scroll container), and `region` (the sr-only `h1` outside a landmark).
- Raise undersized buttons and links to a usable touch size on phone; raise sub-12 px text where it is chrome rather than data.

Docs: `packages/web/docs/design-tokens.md` if any token changes.

### 8. Entity Links

[Ticket 03](issues/03-routes-and-url-state.md)

- The only URL state is `?e=<id>`. Panning, zooming, Detail Level and filters never touch the URL.
- Opening an id that isn't in the loaded levels loads delta files progressively (level 3, then 4), raising the Detail Level only as far as the entity needs. An id that never resolves opens the timeline normally with no panel.
- Selecting an entity `pushState`s (Back closes the panel); closing replaces.
- The timeline's language switch carries `e` to the sibling locale.
- Built on the existing root first; item 9 moves it under `/timeline/`.

ADR: `packages/web/docs/adr/` — entity-only URL state with progressive loading.
Docs: `docs/product-scope.md` (add entity links, drop the language-switcher deep-link exclusion), `CONTEXT.md` (**Entity Link** — added).

### 9. Route split and landing shell

[Ticket 03](issues/03-routes-and-url-state.md) · [ticket 01](issues/01-landing-narrative-and-content.md) · map "Landing build"

- Landing at `/` and `/ru/`, timeline at `/timeline/` and `/ru/timeline/`; no auto-redirect. Old inbound links to `/` and `/ru/` land on the landing page; nothing is preserved.
- Each locale's landing is its own small prerendered HTML entry with no datasets and no timeline JS. The timeline bundle is prefetched on CTA hover, focus or touch only. The default-viewport prerender stays on the timeline routes.
- Four self-canonical pages, `hreflang` pairs landing↔landing and timeline↔timeline with `x-default` → `/`; `?e=` links canonicalize to `/timeline/`; sitemap lists the four URLs; one shared `og-image.png` with its copy corrected for the Milestones rename.
- The landing's language switch goes landing → landing.

ADR: root ADR for the route split, superseding `docs/adr/0003-english-served-from-domain-root.md` (mark 0003 `status: superseded`).
Docs: `docs/deployment.md` (URL structure; two entries per locale in the build-plugin description), `docs/product-scope.md` (landing page), `docs/config-variables.md` if a variable changes.

### 10. Landing content

[Ticket 01](issues/01-landing-narrative-and-content.md) · [ticket 02](issues/02-prototype-landing-hero-preview.md) · [ticket 04](issues/04-example-starting-points.md) · wireframes `wireframes/landing/`

- Layout (variant A): nav (logo, About, GitHub, language switch); centred `h1` "Every life in context."; subhead "See who lived at the same time, and what else was happening."; primary "Explore the timeline" button; a framed, non-interactive screenshot of the real timeline under it; three numbered points in a row (stacked on phone); four Starting Point cards; a light footer. On phone the CTA goes full-width and the preview starts inside the first screen.
- Three points: **Time runs left to right.** / **Lives, conflicts and milestones share one timeline.** / **Tap anything for the story.**, each with its one-line caption (ticket 01).
- Four Starting Points, each an Entity Link with a one-line teaser: Cleopatra `60827`, Columbus `5635`, French Revolution `Q6534`, Titanic `Q25173`. Same ids on `/ru/`. A test run after each dataset regeneration asserts every id still resolves at `Mainstream` and fails the build otherwise.
- The preview is a WebP in EN and RU, captured from the real app by a committed Playwright script run by hand (not in the build), at a window where no marks are cut off at the right edge, with alt text. A missing image never blocks the CTA.
- Footer: one-line about, data credits (Pantheon, Wikidata, Wikipedia, CC BY-SA), GitHub link, language switch, a short privacy line about Umami, a link to the About modal; both read the same message keys so they cannot drift.
- The page uses no Lane, Detail Level, Fame Score or Container; Russian string lengths in the points row and cards are checked in the Russian review.

Docs: `docs/product-scope.md`, `docs/observability.md` if Umami events change, `CONTEXT.md` (**Landing Page**, **Starting Point** — added).

## Launch check

Re-run the live-site audit's method against the result: the same six viewport/locale combinations (1440×900, 768×1024, 390×844 touch × EN and `/ru/`), axe with no serious or moderate violations, LCP and CLS no worse than today (0.7–1.2 s, 0), no Mixed Content warnings, no failed requests.

## Deferred

- Page weight (~3 MB decoded): re-measure compressed on a throttled network during the launch check before treating it as a problem.
- Inconsistently cased Russian Wikidata-sourced labels (a data issue).
- A short muted loop instead of the static landing preview.
- Everything in the map's "Out of scope" list (who-overlapped, curated tours, era bands, map view, share cards, more languages, dark mode, "on this day", embeds, rich entry content, PWA, rebrand).
