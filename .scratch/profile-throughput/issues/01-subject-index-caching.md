# 01 — Self-healing subject-index cache with Russian metadata

Status: resolved
**Blocked by:** None — can start immediately (parallel with 02 and 03).

**What to build:** Eliminate the recurring cold-start cost of `loadSubjects()` (which synchronously re-parses the 39 MB Pantheon CSV and all raw JSON files on every one-shot CLI invocation) by adding a stat-validated disk cache under gitignored `data/output/`, while attaching each entity's already-committed Russian dataset metadata (`name`, `tagline`, `description`) for downstream translation glossary lookup.

- Update `packages/data-pipeline/src/profiles/paths.ts` to export `SUBJECTS_CACHE_PATH` pointing to `packages/data-pipeline/data/output/profile-subjects.cache.json`.
- Extend `ProfileSubject` in `packages/data-pipeline/src/profiles/subjects.ts` with optional `ru?: { name?: string; tagline?: string; description?: string }`:
  - Populate `ru` in `indexProfileSources()` from existing `TaggedPerson` (`nameRu`, `taglineRu`, `descriptionRu`), `TaggedConflict` (`labelRu`, `taglineRu`, `descriptionRu`), and `TaggedMilestone` (`labelRu`, `taglineRu`, `descriptionRu`) fields—omitting `ru` when all three fields are absent.
  - Keep `subjectBrief()` returning only `{ qid, lane, name, dates, wikipediaUrl }` so English prompts and hashes stay unchanged.
- Add cache read/write/invalidation helpers in `packages/data-pipeline/src/profiles/subjects.ts`:
  - Compute a lightweight `inputs` fingerprint (`{ size, mtimeMs }` via `statSync`) across every raw data file read by `transformPeople()`, `transformConflicts()`, and `transformMilestones()`, plus `src/transform/person-date-corrections.ts`.
  - Store `{ schema_version: 1, inputs, subjects }` atomically (`writeFileSync` to `.tmp` + `renameSync`), creating the parent directory if needed and ignoring non-fatal cache write failures so read-only environments never crash.
  - Update `loadSubjects(options?)` (accepting optional `{ cachePath?: string; bypassCache?: boolean; compute?: () => ProfileSubject[]; statInputs?: () => Record<string, { size: number; mtimeMs: number }> }` for clean unit testing) to return cached subjects immediately on a valid fingerprint match, and recompute + rewrite transparently on cache miss, corrupt JSON, schema mismatch, or changed input stats.
  - Export `writeSubjectsCache(subjects, options?)` for reuse by `build-data`.
- Update `packages/data-pipeline/src/output/index.ts` so `build-data` writes `SUBJECTS_CACHE_PATH` directly from the `peopleRows`, `conflictRows`, `milestoneRows`, and built English entries it already computed.

## Acceptance criteria

- [x] `ProfileSubject` includes optional `ru?: { name?: string; tagline?: string; description?: string }` populated from committed raw data, while `subjectBrief()` output is unchanged.
- [x] Calling `loadSubjects()` twice against unchanged raw inputs runs transforms only once and returns deep-equal `ProfileSubject[]` from the cache on the second call.
- [x] Modifying any tracked raw input file's size or mtime, corrupting the cache JSON, or changing `schema_version` triggers a transparent recompute and refreshes the cache file.
- [x] `build-data` (`packages/data-pipeline/src/output/index.ts`) writes the cache file from its already-transformed rows without running duplicate transforms.
- [x] Cache file lives under gitignored `packages/data-pipeline/data/output/` (`git status` stays clean after running Profile commands).
- [x] Unit tests in `packages/data-pipeline/src/profiles/subjects.test.ts` cover cache miss/write, warm hit (asserting `compute` is not invoked), invalidation on input stat change, corrupt cache recovery, and `ru` metadata population.
- [x] `npm run typecheck --workspace packages/data-pipeline`, `npm run test --workspace packages/data-pipeline`, and `npm run lint --workspace packages/data-pipeline` all pass.
