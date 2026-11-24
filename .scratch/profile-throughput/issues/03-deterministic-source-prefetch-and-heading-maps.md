# 03 — Deterministic source prefetching with heading maps and compact evidence reads

Status: resolved
**Blocked by:** None — can start immediately (parallel with 01 and 02).

**What to build:** Move initial source discovery out of the multi-turn writer agent loop by adding a deterministic `profiles prefetch` command that caches the subject's Wikipedia article and top ranked institutional/scholarly reference sources into `data/raw/profiles/evidence/`, skips recently blocked hosts, emits a compact heading-map Source Map, and gives agents `--outline` and `--length` options on `profiles evidence` to prevent context bloat.

- **HTML reference extraction & `Retry-After` (`packages/data-pipeline/src/profiles/verification/sources.ts`):**
  - Export `extractReferenceLinks(html: string, baseUrl: string): string[]` using `htmlparser2` to collect deduplicated public HTTPS links from Wikipedia reference and external-link sections (preferring `.references`, `.reflist`, and `#External_links` before general body links), resolving relative URLs, stripping `#` fragments, and filtering out Wikimedia/Wikipedia domains, social/video sites, and binary extensions (`.pdf`, `.jpg`, `.jpeg`, `.png`, `.gif`, `.svg`, `.mp3`, `.mp4`, `.zip`).
  - Update `fetchSource()` so HTTP `429` responses honor numeric `Retry-After` headers (capped at 60 s) before falling back to exponential backoff, and return structured HTTP error detail (status code) so callers can distinguish deterministic blocks (`403`/`410`/`451`/non-HTML) from transient errors (`429`/`5xx`/timeouts).
  - Extend `SourceStore.readExcerpt()` with optional `length` (integer `500`–`8000`, defaulting to `8000` so existing callers and tests stay unchanged) and add `SourceStore.readOutline(url)` returning `{ id, url, title, chars: source.text.length, headings }` without body text.
- **Deterministic prefetch & blocked-host cache (`packages/data-pipeline/src/profiles/prefetch.ts`):**
  - Implement a persistent TTL cache at `<profilesDir>/evidence/blocked-hosts.json` (7-day TTL, gitignored under `evidence/`) recording hosts/URLs that failed deterministically (`403`, `410`, `451`, unsupported content type). Never record transient `429`/`5xx`/timeout failures. `--refresh` bypasses both URL cache and blocked-host cache.
  - Rank extracted candidate URLs deterministically: Tier 1 curated institutional/scholarly allowlist (`plato.stanford.edu`, `britannica.com`, `mathshistory.st-andrews.ac.uk`, `nobelprize.org`, `nationalarchives.gov.uk`, `folger.edu`, `loc.gov`, `bl.uk`, `metmuseum.org`, `britishmuseum.org`, `vangoghmuseum.nl`, `unesco.org`, `nasa.gov`, `who.int`, `*.edu`, `*.ac.uk`, `*.gov`), Tier 2 `.org` hosts, Tier 3 other public HTTPS hosts. Pick at most one candidate per root hostname to preserve source independence.
  - Implement `prefetchSubject(options)`:
    1. Fetch/reuse the subject's `wikipediaUrl` through the shared `evidence/` URL + snapshot cache (keeping raw HTML available in memory when freshly fetched, or extracting links via a lightweight link fetcher if Wikipedia was already cached).
    2. Fetch up to `maxSources` (default `5`, clamped `1`–`8`) ranked distinct-host candidates with bounded concurrency (max 3 concurrent) while pacing `*.wikipedia.org` requests $\ge 1$ s apart across multi-QID batches.
    3. Write the Source Map to `<profilesDir>/evidence/prefetch/<QID>.json` and return `{ qid, subject: subjectBrief(subject), sources: [{ id, url, title, chars, headings }], skipped: [{ url, reason }] }`, filtering headings to levels `1`–`3` (capped at 60 entries per source) for compactness.
- **CLI wiring (`packages/data-pipeline/src/profiles/index.ts`, `coordinator.ts`):**
  - Add `profiles prefetch --qids=Q1,Q2,... [--max-sources=5] [--refresh]` to `index.ts` and `USAGE`.
  - Add `--length=<number>` and `--outline` flags to `profiles evidence` in `coordinator.ts` (rejecting `--outline` combined with `--query`, `--offset`, or `--length`).
- **Living docs:** Update `packages/data-pipeline/docs/profiles.md` and `packages/data-pipeline/docs/profile-coordinator.md` to document `prefetch`, Source Maps, `--outline`, and `--length`.

## Acceptance criteria

- [x] `extractReferenceLinks` prioritizes reference/external-link sections, resolves relative HTTPS URLs, strips fragments, deduplicates, and filters out Wikimedia domains and binary file extensions.
- [x] `fetchSource` respects numeric `Retry-After` headers on HTTP `429` responses.
- [x] `SourceStore.readExcerpt` supports optional `length` (500–8000, default 8000) and `SourceStore.readOutline` returns `{ id, url, title, chars, headings }` with zero body text; `profiles evidence` exposes `--length` and `--outline` with argument validation.
- [x] `prefetchSubject` caches Wikipedia and up to `maxSources` ranked distinct-host institutional/scholarly snapshots in `evidence/` so subsequent `profiles evidence --url=...` calls hit the local cache with zero network requests.
- [x] Deterministic `403`/`410`/`451`/non-HTML failures are stored in `evidence/blocked-hosts.json` and skipped within the 7-day TTL unless `--refresh` is passed; transient `5xx`/`429`/timeout errors are never cached as blocked.
- [x] `profiles prefetch --qids=...` writes `<profilesDir>/evidence/prefetch/<QID>.json` and emits compact Source Map JSON with `h1`–`h3` heading offsets matching `source.text`.
- [x] Unit tests in `packages/data-pipeline/src/profiles/prefetch.test.ts` (and/or `verification.test.ts`) cover link extraction, host-tier ranking, distinct-host deduplication, blocked-host TTL caching/bypass, `prefetch` $\rightarrow$ `evidence` cache reuse, `--outline`, and `--length` clamping.
- [x] Living docs (`profiles.md`, `profile-coordinator.md`) document `prefetch`, `--outline`, and `--length`.
- [x] `npm run typecheck --workspace packages/data-pipeline`, `npm run test --workspace packages/data-pipeline`, and `npm run lint --workspace packages/data-pipeline` all pass.
