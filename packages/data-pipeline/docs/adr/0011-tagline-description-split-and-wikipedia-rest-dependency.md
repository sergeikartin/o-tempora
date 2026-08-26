---
status: accepted
---

# Split `description` into `Tagline` + `Description`, adding Wikipedia's REST API as a second live dependency

Every entity's single `description` field held Wikidata's short one-line `schema:description` claim — a terse disambiguating subtitle ("American physicist"), not real prose. `DetailPanel` is a scrollable, uncapped-length drawer built to hold much more, so the field was split in two, per `CONTEXT.md`'s `Tagline`/`Description` glossary entries:

- **`Tagline`** (required) — the old field, renamed. Still Wikidata's `schema:description`, still gates publish: an entity with no resolvable `Tagline` is dropped, unchanged behavior under a new name.
- **`Description`** (new, optional) — Wikipedia's REST summary API `extract`: the entity's English Wikipedia article's lead paragraph, real prose. Absent whenever no English article resolves; never a fallback for `Tagline`, and its absence never drops the entity.

## Two decisions bundled together

**The field split itself** is a rename plus one new optional field — mechanically simple, but two sourcing changes ride along with it:

**Discoveries' `Tagline` moves from curated to live-fetched.** Before this split, Discoveries was the one lane whose short subtitle was curator-typed once and never refetched (`0006-descriptions-via-batched-sparql-not-new-dependency.md`'s rationale predates Discoveries even having enrichment). Now all three lanes source `Tagline` identically — live Wikidata SPARQL, no curated fallback — so there's one mental model for where it comes from, not a lane-specific exception. The cost: an entity whose live lookup can't resolve an English `schema:description` is now dropped, something that could never happen for Discoveries before. In practice this cost 0 of 121 curated entities on the first live run. The old curated text stays on disk in `events-curated.raw.json`, unused rather than deleted — historical curation record, not silently lost.

**A new live dependency: Wikipedia's REST summary API.** `Description` has no equivalent anywhere in Wikidata — it can only come from actual Wikipedia article prose. This directly supersedes `0006`'s "no new live dependency beyond Wikidata SPARQL" stance, but only for this one field; `0006`'s own reasoning (reuse the existing batched-SPARQL machinery rather than add a second kind of live fetch) still holds for `Tagline` itself, which stays Wikidata-sourced. `0006` is left unmodified as historical record, with a pointer note added.

## Why a REST API, not more SPARQL

Wikidata has no lead-paragraph-equivalent claim — this content only exists as real Wikipedia article text, reachable only via `https://en.wikipedia.org/api/rest_v1/page/summary/{title}`. Unlike Wikidata's SPARQL endpoint, this REST API has no `VALUES`-clause batch equivalent: one request resolves one title. `wikipedia-client.ts` mirrors the existing Commons/Pageviews REST clients' shape (courtesy `User-Agent`, 429/502-504 retry-with-backoff, structural response validation) rather than inventing a new client pattern. The pacing layer (`batched-wikipedia-extract-fetch.ts`) is deliberately sequential — one request every ~500ms (~2/sec, Wikimedia's REST courtesy guidance) — rather than reusing the 50-wide concurrent-burst pattern the Commons/Pageviews batch fetchers use for their own (different, higher-tolerance) APIs; bursting this one would risk exceeding a comfortable rate for no batching benefit, since there's nothing to batch.

## Article-title resolution, per lane

- **People**: Pantheon's own `slug` column — already the source `wikipediaUrl` is built from, no extra lookup.
- **Wars/Discoveries**: the curated row's own enrichment-resolved `wikipediaUrl`, via the existing `extractWikipediaArticleTitle` helper (`batched-pageviews-fetch.ts`) — reused, not duplicated.

## Consequences

- Volume: ~4,150 People (everything clearing `MIN_HPI`) plus the much smaller Wars/Discoveries curated lists, at ~2 req/sec — a multi-minute fetch step (~35 min observed on a live run, 3,827/3,840 People + 153/154 Wars + 121/121 Discoveries resolved an extract), dominated by People. Accepted as a one-time cost of an on-demand, never-scheduled pipeline (same acceptance `0010`'s pageviews pass already established for a similarly bounded live-fetch cost).
- No caching across runs — every `npm run fetch` refetches everything, consistent with the pipeline's existing "no incremental fetch" convention.
- No non-English fallback and no length cap on `Description`, anywhere in the pipeline or the UI — an entity with no English article simply shows `Tagline` alone.
- `DetailPanel`'s existing body-text CSS style (`.description` in `DetailPanel.module.css`) was kept for the new `Description` field rather than renamed; a new, visually lighter `.tagline` subtitle style was added instead — the smaller CSS churn, since the existing style was already sized for a full paragraph, not a one-line subtitle.
