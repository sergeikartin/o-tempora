Labels: ready-for-agent

# Profile Pipeline Throughput: Prefetch, Preflight, Russian Glossary, and Subject-Index Caching

## Problem Statement

Measured trials in `.scratch/full-profile-coverage/issues/01-baseline.md` show that producing one bilingual Profile currently consumes **22–25 minutes**, **5.0M–8.1M input tokens**, and **4%–6% of weekly plan quota**—putting the remaining ~290 Legendary and Mainstream Profiles at 12–18 weeks of continuous quota burn. Four avoidable architectural bottlenecks drive a large share of this waste without adding verification rigor:

1. **Cold dataset rebuild on every CLI call.** Every one-shot Profile CLI invocation (`finalize`, `verify`, `audit`, `translate`, `english-adversarial`, `english-audit`, `english-repair`, `russian-translation`, `russian-audit`) calls `loadSubjects()`, synchronously parsing the 39 MB `people-pantheon.raw.csv` plus all raw enrichment and Wikipedia extract JSON files. Across dozens of CLI calls per Profile, this adds recurring cold-start latency and blocks fast local checks.
2. **Serial trial-and-error source discovery inside the writer loop.** Research and writing consumes 2.0M–5.0M input tokens because the writer discovers candidate URLs one at a time via 25–53 `evidence` CLI calls, repeatedly hitting HTTP 403/410/timeout failures (16 of 39 URLs failed on Einstein) while replaying a growing 100K+ token conversation history on every turn. Starting with a curated shortlist on Elizabeth I cut writer input tokens by 2.4x.
3. **Mechanical and citation defects discovered only after finalization and audit dispatch.** Writers cannot run a fast, zero-network local verification check before staging/finalizing, so unpaired markup, anchor mismatches, missing corroboration, or mismatched quotes trigger an entire audit-and-repair round (~500K–1M tokens and ~3–5 minutes).
4. **100% first-pass Russian fidelity hold rate and non-cacheable translation prompts.** Every measured Russian translation failed its first fidelity audit on canonical Russian proper names, declensions, historical work titles, or institutional terminology—even though the dataset already commits Russian Wikidata labels, Russian taglines, and Russian Wikipedia lead paragraphs (`*-wikipedia-extracts.ru.raw.json`). Additionally, `translationPrompt` and `russianAuditPrompt` splice variable JSON mid-template via `.replace()`, breaking static-prefix prompt caching across batch runs.

## Solution

Add four deterministic, zero-LLM throughput improvements to `packages/data-pipeline/src/profiles/` that preserve every existing factual verification, adversarial check, Russian fidelity, and fail-closed receipt gate:

1. **Self-healing subject-index cache (`subjects.ts` + `output/index.ts`).** Cache the built `ProfileSubject[]` list (enriched with optional Russian dataset metadata `nameRu`, `taglineRu`, and `descriptionRu`) under gitignored `data/output/profile-subjects.cache.json`, validated against raw input file sizes and modification timestamps. Refresh automatically on miss/staleness and during `build-data`.
2. **Zero-network local `preflight` CLI command (`preflight.ts`).** Run all deterministic local checks (assessed-Profile schema, subject type/dates, bold-only markup, year-zero/reversed dates, passage coverage, normalized quote matching against cached snapshots, citation URL/`#anchor` presence, and corroboration host/origin/kind rules) on a staged or raw draft in milliseconds before `finalize` or audit dispatch.
3. **Deterministic source prefetching with heading maps and compact reads (`prefetch.ts` + `sources.ts`).** Before launching the writer, fetch the subject's Wikipedia article and up to 5 ranked, distinct-host institutional/scholarly reference URLs into the existing `evidence/` snapshot cache, skipping a TTL-backed cache of blocked hosts and emitting a compact Source Map (`id`, `url`, `title`, `chars`, `headings`). Add `--outline` and `--length=<chars>` options to `profiles evidence` so agents jump straight to relevant sections instead of pulling 8,000-character blocks blindly.
4. **Russian Wikipedia terminology glossary injection and cache-friendly prompt layout (`translation.ts` + prompts).** Inject canonical Russian names, taglines, and bounded Russian Wikipedia lead excerpts for the subject and its Connections from already-committed raw data as a non-factual terminology reference, and move all variable JSON strictly to the end of translation and translation-audit prompts so static prefixes cache cleanly across batches.

## User Stories

1. As a maintainer running `profiles` CLI commands repeatedly across a batch, I want `loadSubjects()` to serve from a validated disk cache in milliseconds when raw inputs have not changed, so that one-shot commands stop re-parsing the 39 MB Pantheon CSV on every call.
2. As a maintainer who edits a raw dataset file or runs `fetch`, I want the subject-index cache to detect input file changes automatically and rebuild itself transparently, so that Profile commands never read stale dates, URLs, or Russian labels.
3. As a maintainer running `build-data`, I want the build step to write the subject-index cache from the rows it already transformed, so that subsequent Profile batches start warm with zero extra work.
4. As a Profile writer or repair agent, I want to run `profiles preflight --qid=<QID>` locally with zero network calls before finishing my task, so that I can catch and fix broken quotes, missing `#anchor` fragments, invalid markup, date mismatches, or missing corroboration inside my warm context instead of wasting a full audit cycle.
5. As a coordinator preparing a Profile for verification, I want `preflight` to return a structured JSON report with `ok`, checked counts, and actionable `field.path: problem` issues (exiting nonzero when `ok` is false), so that I can gate finalization and audit dispatch deterministically.
6. As a Profile writer starting a new subject, I want to receive a pre-built Source Map listing the cached Wikipedia snapshot plus 3–5 fetched institutional/scholarly snapshots with their `title`, character counts, and `h1`–`h3` heading offsets, so that I spend my turns reading targeted sections and drafting instead of hunting for live URLs.
7. As a maintainer running `profiles prefetch --qids=Q1,Q2,...`, I want outbound Wikipedia references ranked to favor reliable institutional and scholarly hosts and to skip hosts that recently returned HTTP 403/410 or non-HTML responses, so that prefetching wastes neither time nor network requests on paywalled or blocking domains.
8. As a maintainer prefetching batches of subjects, I want Wikimedia requests paced politely and HTTP `429` responses to honor `Retry-After` headers, so that batch prefetching stays safely within Wikimedia rate limits.
9. As a Profile writer or adversarial checker using `profiles evidence`, I want an `--outline` flag that returns only `{ id, url, title, chars, headings }` and an optional `--length=<chars>` flag for narrower query excerpts, so that inspecting page structure and reading specific quotes does not bloat my context window.
10. As a Russian translator translating an approved English Profile, I want a compact terminology glossary containing the canonical Russian name, tagline, and Wikipedia lead excerpt for the subject and its Connections, so that I use established Russian spellings, declensions, and historical titles on the first attempt.
11. As a Russian fidelity auditor, I want access to the same canonical Russian glossary while auditing strictly against the approved English Profile's facts, so that the translator and auditor agree on standard Russian names without introducing facts absent from the English source.
12. As a maintainer running Russian translation and audit across a batch of Profiles, I want all variable JSON moved to the end of `profile-translation.md` and `profile-translation-audit.md`, so that provider prompt caching reuses the static instruction prefix across every Profile.
13. As a maintainer managing already-published Profiles, I want existing English approvals (policies 2–7) and existing Russian approvals (translation policy 1) to remain valid and publishable without forced regeneration, so that these throughput improvements are strictly additive.

## Implementation Decisions

### 1. Self-Healing Subject-Index Cache (`subjects.ts`, `output/index.ts`, `paths.ts`)

- **Cache location:** Store the cache at `packages/data-pipeline/data/output/profile-subjects.cache.json` (already gitignored by `packages/data-pipeline/.gitignore`).
- **Enriched `ProfileSubject` shape:** Extend `ProfileSubject` with optional Russian reference fields populated from the already-loaded `TaggedPerson`, `TaggedConflict`, and `TaggedMilestone` rows:
  ```ts
  export interface ProfileSubjectRu {
    name?: string;
    tagline?: string;
    description?: string;
  }

  export interface ProfileSubject {
    qid: string;
    lane: ProfileLane;
    name: string;
    dateSpan: DateSpan;
    wikipediaUrl: string;
    ru?: ProfileSubjectRu;
  }
  ```
  `subjectBrief()` continues returning only `{ qid, lane, name, dates, wikipediaUrl }`, keeping English prompts unchanged.
- **Invalidation fingerprint:** Record `{ schema_version: 1, inputs: Record<relativePath, { size: number; mtimeMs: number }>, subjects: ProfileSubject[] }` covering every raw file read by `transformPeople()`, `transformConflicts()`, and `transformMilestones()`, plus `src/transform/person-date-corrections.ts`.
- **Synchronous read/write path:** `loadSubjects()` remains synchronous so existing call sites need no signature change. On cache hit with matching `schema_version` and `inputs` stats, return `cache.subjects` directly. On miss, corruption, or stat mismatch, run the existing transforms/builders, write atomically (`writeFileSync` to `.tmp` + `renameSync`, swallowing read-only/ENOSPC cache-write errors gracefully), and return the fresh list. Allow disabling or overriding the cache path in tests via an optional parameter.
- **`build-data` integration:** `packages/data-pipeline/src/output/index.ts` writes the same cache file from its already-computed rows so running `build-data` refreshes the cache for free.

### 2. Zero-Network Local `preflight` CLI Command (`preflight.ts`, `coordinator.ts`, `index.ts`)

- **Command signature:** `profiles preflight --qid=<QID> [--file=<path>]` (added to `runCoordinatorCommand` and `USAGE` in `index.ts`). When `--file` is omitted, default to `path.join(profilesDir, 'incoming', `${qid}.json`)`.
- **Supported input formats:** Automatically detect whether the JSON is a staged **assessed Profile** (`incoming/<QID>.json`, parsed with `extractAssessedProfile`) or a finalized raw draft with `meta.pending_assessment` / sidecar report (`parseModelProfile` + `readPendingAssessment`), so both writers (pre-finalize) and repair agents (post-finalize) can use the same command.
- **Deterministic checks (strictly zero network, zero LLM):**
  1. Schema validity (`extractAssessedProfile` / `parseModelProfile`, `parseAssessment`).
  2. Subject type alignment (`profile.type === SUBJECT_TYPE[subject.lane]`) and Connection URL syntax validity (`titleOfArticleUrl` check for every Connection URL, flagging malformed/anchor/query Wikipedia links locally without calling MediaWiki).
  3. Passage markup (`assertBoldOnlyMarkup` across `passages(profile)`).
  4. Key Moment date sanity (`yearRange` backwards-range and historical year-zero checks from `mechanical.ts`).
  5. Dataset boundary years (`evidenceChecks` against `subject.dateSpan`) and displayed `source` URL / `#anchor` match against locally cached snapshots in `data/raw/profiles/evidence/`.
  6. Coverage and finding completeness: every visible passage in `covered` once, non-title passages have at least one finding, all findings `supported`, exact normalized quote match (`checkEvidence`), reliable source kinds (`kind !== 'other'`, Wikipedia host check), and `corroborate` rules ($\ge 2$ distinct hosts, $\ge 2$ distinct origins, $\ge 1$ `primary`/`scholarly` source).
- **Output contract:** Emit JSON `{ ok, qid, file, checked_passages, checked_findings, checked_sources, issues }` to stdout. Set `process.exitCode = 1` when `ok` is `false` (via coordinator `emit`).
- **Shared logic:** Extract pure, network-free helper functions from `mechanical.ts` and `policy.ts` as needed rather than duplicating validation rules.

### 3. Deterministic Source Prefetching, Blocked-Host Cache, and Compact Evidence Reads (`prefetch.ts`, `sources.ts`, `coordinator.ts`, `index.ts`)

- **Command signature:** `profiles prefetch --qids=Q1,Q2,... [--max-sources=5] [--refresh]` (default `max-sources` = 5, bounded 1–8).
- **Outbound reference extraction (`sources.ts`):** Add a pure HTML link extractor (`extractReferenceLinks(html, baseUrl)`) that collects public HTTPS links from Wikipedia reference and external-link sections (preferring `<ol class="references">`, `.reflist`, and `#External_links` sections before general body links), resolving relative URLs, stripping `#` fragments, deduplicating, and filtering out Wikimedia/Wikipedia hosts, social/video sites, and binary extensions (`.pdf`, `.jpg`, `.png`, `.svg`, `.mp3`, `.zip`).
- **Deterministic host ranking (`prefetch.ts`):** Score candidate URLs by host tier before fetching:
  - Tier 1 (preferred institutional/scholarly allowlist): national archives, major museums, peer-reviewed/academic encyclopedias and archives (e.g., `plato.stanford.edu`, `britannica.com`, `mathshistory.st-andrews.ac.uk`, `nobelprize.org`, `nationalarchives.gov.uk`, `folger.edu`, `loc.gov`, `bl.uk`, `metmuseum.org`, `britishmuseum.org`, `vangoghmuseum.nl`, `unesco.org`, `nasa.gov`, `who.int`, `*.edu`, `*.ac.uk`, `*.gov`).
  - Tier 2 (general `.org` institutional/reference hosts).
  - Tier 3 (other public HTTPS hosts).
  Enforce at most one prefetched candidate per root hostname (in addition to the Wikipedia article) to maximize source independence for corroboration rules.
- **Persistent blocked-host cache:** Store deterministic host/URL failures (`HTTP 403`, `HTTP 410`, `HTTP 451`, `Source is not readable HTML or plain text`) in gitignored `data/raw/profiles/evidence/blocked-hosts.json` with a 7-day TTL (`--refresh` bypasses it). Never cache transient `429`/`5xx`/timeout errors as blocked.
- **Pacing and `Retry-After` (`sources.ts`):** Update `fetchSource()` so HTTP `429` responses honor numeric `Retry-After` headers (capped sensibly, e.g. 60 s) before exponential fallback. In `prefetch`, pace `*.wikipedia.org` fetches at $\ge 1$ s apart while fetching distinct third-party hosts with bounded concurrency (max 3 in flight).
- **Source Map output:** For each QID, cache all fetched snapshots in the existing `data/raw/profiles/evidence/` URL + content-hash store so the writer reuses them with zero extra HTTP requests, save `<profilesDir>/evidence/prefetch/<QID>.json`, and emit the Source Map summary:
  ```json
  {
    "qid": "Q935",
    "subject": { "qid": "Q935", "lane": "people", "name": "Isaac Newton", "dates": "1643–1727", "wikipediaUrl": "..." },
    "sources": [
      { "id": "<64-hex>", "url": "https://...", "title": "...", "chars": 48210, "headings": [{ "level": 2, "text": "Early life", "offset": 1240 }] }
    ],
    "skipped": [{ "url": "https://...", "reason": "HTTP 403" }]
  }
  ```
  Include `h1`–`h3` headings (capped cleanly if an article has excessive headings) so the Source Map stays compact.
- **Compact `evidence` reads (`sources.ts`, `coordinator.ts`):**
  - Add optional `length` (integer 500–8000, default 8000 to preserve existing API behavior) to `SourceStore.readExcerpt()` and `--length=<n>` to `profiles evidence`.
  - Add `--outline` flag to `profiles evidence` (mutually exclusive with `--query`/`--offset`/`--length`) that fetches/loads the snapshot and returns `{ id, url, title, chars, headings }` with no body text.

### 4. Russian Terminology Glossary Injection and Cache-Friendly Prompt Layout (`translation.ts`, `coordinator.ts`, `index.ts`, prompts)

- **Pure glossary builder (`buildRussianGlossary(raw, subjectsByQid)` in `translation.ts`):**
  ```ts
  export interface RussianGlossary {
    subject: { en: string; ru: string; tagline_ru?: string; lead_ru?: string };
    connections: { en: string; ru: string; tagline_ru?: string }[];
  }
  ```
  - Looks up `meta.source.wikidata_qid` and each `connections[].qid` in `subjectsByQid`.
  - Truncates `lead_ru` cleanly at sentence/word boundary to $\le 500$ characters so token overhead stays under ~200 tokens.
  - Omits `subject` or individual `connections` entries when no `ru.name` exists; returns `undefined` when neither subject nor any Connection has Russian metadata.
- **Prompt-cache-friendly layout:**
  - Refactor `packages/data-pipeline/prompts/profile-translation.md` (bump to `2.5.0` and update hash) and `packages/data-pipeline/prompts/profile-translation-audit.md` (bump to `2.5.0` and update hash) so all instructions come first and the pipeline appends one JSON object at the end (`{ passages, glossary?, feedback? }` for translation; `{ english, russian, glossary? }` for translation audit).
  - Update `packages/data-pipeline/prompts/profile-translation-repair.md` (bump to `1.1.0` and update hash) to accept optional `glossary` in its appended JSON payload.
  - Explicitly instruct both translator and auditor: use `glossary` for established Russian proper names, declensions, and domain terms, while translating **strictly** the approved English claims—never importing extra facts from `lead_ru`.
- **Receipt compatibility:** Keep `TRANSLATION_POLICY_VERSION = '1'` unchanged. Existing `*.ru.translation.json` artifacts remain valid and skipped by `translate` and `russian-translation`.

## Testing Decisions

- **What makes a good test:** Verify observable behavior at module and CLI seams—cache hit/invalidation behavior, `preflight` JSON reports and exit codes, `prefetch` Source Maps and blocked-host skipping, compact `evidence` outlines/lengths, and assembled Russian prompts—using temporary directories, mocked fetchers, and in-memory fixtures rather than inspecting private helper internals or making live network calls.
- **Agreed test seams:**
  1. **Subject cache seam (`subjects.test.ts`):** Temp-dir cache read/write/hit/invalidation tests verifying identical `ProfileSubject[]` output (including `ru` metadata), zero transform calls on warm hit, automatic rebuild when an input file changes, and graceful fallback on corrupt cache JSON.
  2. **Preflight seam (`verification.test.ts` or `preflight.test.ts`):** `preflightProfile` and `runCoordinatorCommand('preflight', ...)` verifying clean staged assessed Profiles pass with `ok: true`, and malformed markup, backwards dates, dataset date mismatches, uncached/mismatched quotes, missing `#anchor`s, invalid Connection URLs, and missing corroboration each surface clear issues with `ok: false` without invoking any network resolver.
  3. **Prefetch & compact evidence seam (`verification.test.ts` or `prefetch.test.ts`):** `extractReferenceLinks`, `prefetchSubject`, `SourceStore.readExcerpt` (`length` and `--outline`), `Retry-After` handling, host tier ranking, distinct-host selection, blocked-host TTL skipping, and `evidence` cache reuse across `prefetch` $\rightarrow$ `evidence`.
  4. **Russian glossary & prompt seam (`translation.test.ts` + `prompt.test.ts`):** `buildRussianGlossary` (truncation, missing RU metadata omission, Connection lookup), `translationPrompt` / `russianAuditPrompt` / `prepareTranslationCorrection` asserting static prefix stability (byte-identical prefix across different Profiles) and trailing JSON payload with `glossary`, plus verifying existing `TRANSLATION_POLICY_VERSION = '1'` approvals remain valid.
- **Prior art:** Existing `node:test` suites in `packages/data-pipeline/src/profiles/subjects.test.ts`, `translation.test.ts`, `prompt.test.ts`, and `verification/verification.test.ts`.

## Out of Scope

- Changing the coding-agent harness dispatch mechanism (such as moving stateless audits/translations to Batch/Flex APIs or stripping tool access in the host runtime), which is an operational/runtime choice outside `packages/data-pipeline`.
- Scoped diff-only English re-audits (requires a policy/ADR decision on verification rigor before changing audit coverage rules).
- Multi-QID concurrent stage orchestrator inside the CLI (the coordinator already controls concurrency across subagents).
- Changing `shared-types`, `output/profiles.ts`, or `packages/web`.
- Re-verifying or invalidating existing English (policies 2–7) or Russian (policy 1) approvals.

## Further Notes

- Tickets `01`, `02`, and `03` have no mutual dependencies and can be implemented in parallel. Ticket `04` depends only on `01` (for `ProfileSubject.ru` metadata).
- None of the four changes conflict with existing ADRs (`0026`–`0033`); each reinforces the one-shot coordinator protocol (ADR 0030), evidence-first drafting (ADR 0031), assessed-Profile extraction (ADR 0032), and heading-aware snapshots (ADR 0033).
- Update affected living docs (`packages/data-pipeline/docs/profiles.md`, `profile-coordinator.md`, `profile-translation.md`, and `.claude/agents/profile-writer.md` / `.codex/agents/profile-writer.toml`) in the same ticket that introduces each CLI or workflow change.
