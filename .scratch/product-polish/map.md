# Product polish

## Destination

A spec — `spec.md` in this directory — for the pre-launch pass that makes otempora.info read as a polished product instead of a pet project, centered on making it understandable to a cold first-time visitor. Sized at roughly 1–2 weeks of part-time work (~8–12 high-leverage changes), ready to be sliced into implementation issues afterward; this map does not execute the build itself.

## Notes

- Primary audience: cold visitors arriving from a shared link (HN/Reddit/social) who decide within ~10 seconds whether to stay. Recruiters/portfolio viewers are a free side effect, not a design driver.
- The "aha" every cue serves: **see who lived at the same time as whom, and what else was happening.**
- Identity stays: "O Tempora" name and the "Ledger & Ink" parchment look (`packages/web/docs/design-tokens.md`) are refined, not replaced. No rebrand, no re-theme.
- Scope guard: presentation, UX, and trust work only — no new product features beyond the in-scope list below. `docs/product-scope.md` is the baseline; where this effort changes it (landing page, shareable URL state), the spec says so and the living doc is updated at implementation time.
- Default skills: `/grilling` + `/domain-modeling`. Prototype tickets additionally use `/prototype`.
- Settled during charting (direct scope calls, not tickets):
  - First-time experience is a **landing page** that explains the product with a call-to-action into the timeline — not an onboarding pop-up or coach marks.
  - Route structure: landing at `/` and `/ru/`, timeline at `/timeline/` and `/ru/timeline/`; no auto-redirect for returning visitors (SEO and link previews). Reverses `docs/adr/0003-english-served-from-domain-root.md`, so the spec requires a superseding ADR. Details are ticketed.
  - Landing page is short and product-led: one screen (promise, preview of the real timeline, three plain "how it works" points, 3–4 example starting points deep-linking into the timeline, primary "Explore the timeline" button) plus a light footer (about, data credits, language switch). No marketing sprawl.
  - In-app wayfinding is in scope too, for deep-link arrivals and returning visitors: plainer lane/Detail Level labels, a persistent "?" help affordance, self-explanatory empty/zero-result states.
  - Shareable URL state (viewport + selected entity) is in scope as polish.
  - Live-site audit ran on 2026-10-22 (ticket 08); findings in `research/live-site-audit.md`. It confirmed the first-time-understanding direction and added the first-view-frame ticket.

## Decisions so far

<!-- one line per closed ticket: [title](issues/NN-slug.md) — gist -->

- [Audit the live site](issues/08-audit-live-site.md) — performance is already strong, identity is cohesive; the pet-project tells are no on-arrival explanation, a bare phone first screen, the desktop sidebar clipping the timeline, a blank/slow detail-panel image, `http://` image URLs and the stock 404 (see `research/live-site-audit.md`).
- [Landing narrative and content](issues/01-landing-narrative-and-content.md) — keep "Every life in context." with a one-sentence "aha" subhead, three plain points (time axis, one shared timeline, tap for the story), one "Explore the timeline" CTA, a light summary footer linking to the About panel, no domain jargon.
- [Routes and URL state](issues/03-routes-and-url-state.md) — landing at `/` and `/ru/`, timeline at `/timeline/` and `/ru/timeline/`, no redirects; the only URL state is `?e=<id>` (an Entity Link) resolved by progressive delta loading; language switch carries it across locales; four self-canonical pages with hreflang pairs; two ADRs (root route split superseding 0003, web entity URL state) plus living-doc updates.
- [Example starting points](issues/04-example-starting-points.md) — four static Entity Links (Cleopatra `60827`, Columbus `5635`, French Revolution `Q6534`, Titanic `Q25173`) with one-line teasers, a post-regeneration test that the ids still resolve, same set on `/ru/`.
- [Plain-language labels](issues/05-plain-language-labels.md) — Detail Level names kept with a "how much to show" hint; "People" heading → Occupation; "Institutions" → Politics & Religion; "Public Figure" → Public Figures; "Social & Human Culture" → Society & Culture; landing says "conflicts", not "wars".

## Settled for the spec (decided in grilling, no ticket)

- **Feedback path:** one "Report a problem or suggest an entry" link to GitHub Issues, in the About panel only (the footer links to About and carries no contact link of its own). No email, no form. Privacy line (Umami) is in the footer.
- **Landing build:** each locale's landing is its own small prerendered HTML entry with no datasets and no timeline JS. The timeline bundle is prefetched on CTA hover, focus or touch only. The default-viewport prerender stays on `/timeline/` and `/ru/timeline/`. `docs/deployment.md`'s build-plugin description updates to two entries per locale.
- **Russian parity:** landing copy, Starting Point teasers and renamed labels ship in Russian in the same release; the cryptic slider stops (`Профи`, `Детали`) get full level names. Claude drafts, the owner reviews before the strings land. Inconsistently cased Wikidata-sourced Russian labels are a data issue, deferred.
- **Image defects and depictions:** a curated denylist of entity ids in the data pipeline drops `image` (Muhammad `18934` to start). The same pass rewrites `http://` image URLs to `https://`, resolves the Commons redirect chain to the final thumbnail URL at pipeline time, and reserves the image slot's height in `DetailPanel`.
- **404:** one branded, bilingual `404.html` in the parchment style with links to `/` and `/ru/`, no timeline JS.
- **Defects with an obvious fix** (axe contrast, scrollable-region focus, touch-target sizes) go straight into the spec.
- **Per-state share previews:** none; entity links share the page's one OG image (see ticket 03).

## Not yet specified

None outside the open tickets: the hero preview (02), the first-view frame (09), and in-app help (06) are all ticketed prototypes.

## Out of scope

Future-version ideas, ruled out of this effort (new features, not polish):

- **Who overlapped** — select a person, highlight everyone whose life overlapped theirs (the deferred "connections" / "comparison mode").
- **Curated tours** — guided stories (e.g. "Age of Revolutions") that pan/zoom the timeline with narration. (Landing-page example links are the lightweight precursor and are in scope.)
- **Era bands** — shaded background periods (Renaissance, Bronze Age) as timeline landmarks.
- **Map view** — the deferred geographic view linked to the timeline.
- **Share cards** — export a viewport or entity as an image.
- **More languages**, and a **dark mode** second theme.
- **"On this day"** — a daily return hook.
- **Embeddable widget** for blogs/classrooms.
- **Rich entry content** — images, sources, related entries (see `.scratch/dynamic-tooltips/spec.md` for the in-flight image work).
- **Offline / PWA**.
- Any rebrand, renaming, or re-theme.
