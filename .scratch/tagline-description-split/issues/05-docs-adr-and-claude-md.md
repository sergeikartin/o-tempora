# 05 — Docs: new ADR + CLAUDE.md updates

**What to build:** Bring the data pipeline's documentation and architecture decision record history up to date with the sourcing changes made in tickets 02 and 04, so a future reader understands why `tagline` is now live-fetched for all three lanes and why a second live external dependency (Wikipedia's REST API) was deliberately added on top of the existing Wikidata-only sourcing.

**Blocked by:** 02 — Discoveries: live-fetch `tagline` instead of curated text; 04 — Wire the Wikipedia extract through as the new optional `description` field

**Status:** resolved

- [x] The data pipeline's own top-level documentation accurately describes `tagline` being live-fetched for all three lanes (no remaining mention of Discoveries as a curated-only exception) and the new Wikipedia extract dependency behind `description`.
- [x] A new architecture decision record captures: the field split itself (`tagline` required/Wikidata-sourced vs. `description` optional/Wikipedia-sourced); the addition of Wikipedia's REST API as a second live dependency and why that supersedes the earlier "no new live dependency" decision for this one field; and Discoveries' tagline sourcing moving from curated to live-fetched.
- [x] The earlier "no new live dependency" decision record is left intact as historical record, with a short pointer note added noting it's superseded for this field specifically.

## Answer

`packages/data-pipeline/CLAUDE.md`: fetch script description updated ("Pantheon CSV + taglines, Wikidata SPARQL enrichment, Wikipedia extracts"); Stack table's SPARQL row now says "including `tagline`, live-fetched for all three lanes" and gained a new "Article prose" row for the Wikipedia REST summary API, pointing at the new ADR; the Fetch stage's numbered description now explicitly states Discoveries' `tagline` is live-fetched with no curated fallback (only `year` remains curator-authored) and describes the new sequentially-paced Wikipedia REST pass as "this pipeline's second live external dependency, alongside Wikidata SPARQL".

New ADR: `docs/adr/0011-tagline-description-split-and-wikipedia-rest-dependency.md` — covers the field split itself, the two sourcing-change decisions bundled into it (Discoveries' `Tagline` going live-fetched; Wikipedia's REST API becoming a second live dependency), why a REST API rather than more SPARQL (no lead-paragraph-equivalent Wikidata claim exists, no batching primitive so pacing is deliberately sequential), per-lane title resolution, and consequences (fetch volume/timing observed on the real run, no caching, no truncation, the CSS-reuse decision for `.description`/`.tagline`).

`0006-descriptions-via-batched-sparql-not-new-dependency.md` (the earlier "no new live dependency" decision) is left as originally written, with a pointer blockquote appended noting it's superseded for the new `Description` field specifically — its own reasoning still holds for `Tagline`, which stays SPARQL-sourced exactly as it decided.

Also cleaned up `.playwright-mcp/` (leftover browser-verification artifacts from ticket 04's manual testing, not part of the intended change set).

Final verification across all five tickets: `data-pipeline` typecheck clean, 157/157 tests passing; `web` typecheck clean, 133/133 tests passing, lint and `lint:boundaries` clean.
