# 02 — Fix remaining correctness bugs and add build-time Profile parity check

Status: resolved
**Blocked by:** None — can start immediately (parallel with 01 and 03).

**What to build:** Resolve the four remaining correctness bugs identified in the architecture review without changing existing receipt versions or breaking published Profiles.

- **MediaWiki QID lookup retry & `Retry-After` (`packages/data-pipeline/src/profiles/wikipedia-qids.ts` and `verification/sources.ts`):**
  - Update `resolveArticleQids` in `wikipedia-qids.ts` (accepting optional `{ fetch, wait }` injection for testing) to retry each batch up to 3 attempts on HTTP `429`, HTTP `5xx`, or transient fetch errors. Honor numeric `Retry-After` headers (capped at 60 s) on `429`/`503`, falling back to exponential backoff starting at 5 s (`5_000 * 2 ** attempt`). Keep batch concurrency strictly at 1.
  - Update `fetchPage()` in `verification/sources.ts` so HTTP `503` responses also honor numeric `Retry-After` headers (capped at 60 s), and use a 5 s fallback floor for `429`/`503` when `Retry-After` is absent.
- **Connection QID deduplication & self-link pruning (`packages/data-pipeline/src/profiles/finalize.ts`, `assessed-profile.ts`):**
  - In `finalizeFile()`, track seen resolved target QIDs starting with the subject's own `qid`: drop any Connection whose resolved QID equals the subject's `qid` (self-link) or duplicates an earlier kept Connection's QID (e.g., two distinct Wikipedia URLs redirecting to the same entity).
  - Pass the exact list of kept draft connection indices (e.g., `keptIndices: number[]`) into `finalizedAssessment()` (keeping backward compatibility with `draftConnectionUrls` for legacy `--research` files) so `findings`, `covered`, `uncovered`, `issues`, and `subject_dates` remap cleanly even when duplicate URLs or redirecting aliases are pruned.
  - Ensure `meta.validation` (`connections_matched_people`, `connections_matched_events`) counts only the kept deduplicated Connections.
- **Relax Russian translation digit check to a sorted multiset (`packages/data-pipeline/src/profiles/translation.ts`, prompts):**
  - In `parseTranslationFields()`, compare sorted numeric token arrays (`(text.match(/\d+/g) ?? []).sort()`) instead of requiring exact positional order so idiomatic Russian clause reordering passes while dropped, altered, or invented numbers still throw.
  - Keep `TRANSLATION_POLICY_VERSION = '1'` unchanged.
  - Update the digit-order sentence in `packages/data-pipeline/prompts/profile-translation.md` (bump to `2.6.0` + hash) and `prompts/profile-translation-repair.md` (bump to `1.2.0` + hash) from "keep every digit unchanged and in order" to "keep every numeric value unchanged".
- **Build-time Profile referential integrity (`packages/data-pipeline/src/output/profiles.ts`, `packages/data-pipeline/src/output/index.ts`):**
  - Export `verifyBuiltProfiles(outputDir, datasets)` in `output/profiles.ts` that verifies for both `en` and `ru`:
    1. Every entity with `hasProfile: true` across people, conflicts, and milestones has a readable JSON file at `profiles/<locale>/<slug>.json`.
    2. Every `profiles/<locale>/*.json` file corresponds to an entity marked `hasProfile: true` (no orphan files).
    3. Every `connection` in each written Profile points to an existing entity slug with matching `lane` and `detailLevel`.
  - Call `verifyBuiltProfiles()` at the end of `packages/data-pipeline/src/output/index.ts` so `build-data` fails closed if any invariant breaks.

## Acceptance criteria

- [x] `resolveArticleQids` retries HTTP `429` and `503` (honoring numeric `Retry-After`, falling back to $\ge 5$ s backoff) and succeeds when a later attempt returns 200; `sources.ts` honors `Retry-After` on both `429` and `503`.
- [x] `finalizeProfiles` drops self-links and duplicate Connections whose distinct Wikipedia URLs resolve to the same Wikidata QID, updates `meta.validation` counts accordingly, and remaps `pending_assessment` paths cleanly with zero stale indices.
- [x] `parseTranslationFields` accepts Russian text where numeric tokens are reordered across clauses (e.g., `"In 1905, he published 4 papers"` $\rightarrow$ `"4 статьи он опубликовал в 1905 году"`) while still rejecting changed, missing, or added digits; `prompt.test.ts` passes with updated prompt hashes.
- [x] `verifyBuiltProfiles` passes on valid output directories and throws descriptive errors on missing Profile files, orphan Profile files, unknown Connection slugs, or mismatched Connection `lane`/`detailLevel`; `output/index.ts` runs it on every `build-data`.
- [x] Unit tests in `wikipedia-qids.test.ts`, `finalize.test.ts`, `translation.test.ts`, `verification.test.ts`, and `output/profiles.test.ts` cover every fix.
- [x] `npm run typecheck --workspace packages/data-pipeline`, `npm run test --workspace packages/data-pipeline`, and `npm run lint --workspace packages/data-pipeline` all pass.
