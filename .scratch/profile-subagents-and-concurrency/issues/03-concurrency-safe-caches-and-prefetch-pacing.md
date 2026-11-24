# 03 — Concurrency-safe shared caches and prefetch --concurrency (default 1)

Status: resolved
**Blocked by:** None — can start immediately (parallel with 01 and 02).

**What to build:** Eliminate shared-file write races in the local evidence cache and add opt-in bounded concurrency (`--concurrency`, defaulting to `1`) to `profiles prefetch` while keeping `*.wikipedia.org` strictly paced.

- **Lock-free per-host blocked-host cache (`packages/data-pipeline/src/profiles/prefetch.ts`):**
  - Replace the single read-modify-write `evidence/blocked-hosts.json` file with per-host files stored at `evidence/blocked-hosts/<hash(host)>.json` (same content-hash directory pattern as `evidence/urls/<hash(url)>.json`).
  - Write each blocked host entry `{ host, url, reason, failed_at }` atomically via `writeJson()` (`randomUUID()` temp file + `rename`), and delete the per-host file via `rm(..., { force: true })` when a `--refresh` fetch succeeds.
  - Keep the 7-day TTL (`BLOCK_TTL`) and continue recording only deterministic failures (`403`, `410`, `451`, unsupported content type), never transient `429`/`5xx`/timeouts.
  - For smooth local migration, if a per-host file is absent and a legacy `evidence/blocked-hosts.json` exists, fall back to reading it read-only (never rewriting it).
- **Bounded `prefetch --concurrency` defaulting to `1` (`packages/data-pipeline/src/profiles/prefetch.ts`, `coordinator.ts`, `index.ts`):**
  - Add `--concurrency=<n>` to `profiles prefetch` in `coordinator.ts` and `USAGE` in `index.ts`: integer in `1..3`, default **`1`**. Reject non-integer or out-of-range values with a clear error.
  - Implement a small helper `prefetchBatch({ subjects, profilesDir, maxSources, refresh, concurrency = 1, fetch, readLinks, now })` using a bounded worker pool of size `concurrency` that preserves input QID order when returning/emitting results.
  - Verify that concurrent QID workers still serialize every `*.wikipedia.org` request through `sources.ts`'s shared `paceWikipedia()` queue ($\ge 1$ s spacing), while distinct third-party hosts remain bounded to at most 3 concurrent fetches per QID.
- **Subject-cache concurrency test (`packages/data-pipeline/src/profiles/subjects.test.ts`):**
  - Verify that concurrent cold-start `loadSubjects()` calls against the same `cachePath` complete cleanly without `ENOENT`/collision errors or corrupt JSON (validating the existing `randomUUID()` atomic write in `writeSubjectsCache`).
- **Living docs:** Update `packages/data-pipeline/docs/profiles.md` and `packages/data-pipeline/docs/profile-coordinator.md` to document `prefetch --concurrency=<1..3>` (default `1`) and per-host `evidence/blocked-hosts/` caching.

## Acceptance criteria

- [x] `prefetchSubject` stores blocked-host entries as individual files under `evidence/blocked-hosts/<hash(host)>.json` using atomic writes and removes a host's file on a successful `--refresh`.
- [x] Running two `prefetchSubject` calls concurrently that block different hosts preserves both entries with zero lost updates.
- [x] `profiles prefetch` accepts `--concurrency=<1..3>`, defaults to `1`, rejects invalid values (e.g. `0`, `4`, `abc`), and preserves deterministic per-QID output order.
- [x] Concurrent `prefetchBatch` runs with `concurrency > 1` stay within the worker bound and keep `*.wikipedia.org` requests paced through the shared queue.
- [x] Unit tests in `packages/data-pipeline/src/profiles/prefetch.test.ts` and `subjects.test.ts` cover lock-free concurrent blocked-host writes, `--refresh` unblocking, legacy `blocked-hosts.json` read fallback, `--concurrency` validation and bounded parallelism, and concurrent cold-start `loadSubjects` calls.
- [x] Living docs (`profiles.md`, `profile-coordinator.md`) document `--concurrency` (default `1`).
- [x] `npm run typecheck --workspace packages/data-pipeline`, `npm run test --workspace packages/data-pipeline`, and `npm run lint --workspace packages/data-pipeline` all pass.
