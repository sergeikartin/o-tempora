# 01 — Stage-filtered status, --out task output, and gitignored handoff workspace

Status: resolved
**Blocked by:** None — can start immediately (parallel with 02).

**What to build:** Add the small CLI and workspace ergonomics needed for frictionless manual handoffs between Codex and Gemini Neon (via Easy MCP): stage filtering on `profiles status`, a gitignored in-repo `tasks/` handoff directory, `--out=<file>` on task-preparing commands, and `--model=<id>` fallback override on `profiles finalize`.

- **Gitignored in-repo handoff directory:**
  - Add `packages/data-pipeline/data/raw/profiles/tasks/` to the root `.gitignore` right beside `incoming/` and `evidence/`.
  - Export `TASKS_DIR = path.join(RAW_PROFILES_DIR, 'tasks')` from `packages/data-pipeline/src/profiles/paths.ts`.
- **Stage and limit filtering on `profiles status` (`status.ts`, `coordinator.ts`, `index.ts`):**
  - Export `parseProfileStages(value: string | undefined): ReadonlySet<ProfileStage> | undefined` in `status.ts` parsing comma-separated `ProfileStage` values and throwing a clear error listing allowed stages on invalid/empty values.
  - Extend `inspectProfileStatus()` with optional `stages?: ReadonlySet<ProfileStage>` and `limit?: number` (positive integer): filter classified items to matching stages, apply `limit` if provided, and compute `summary` over the returned `items` so `summary` totals always equal `items.length`.
  - Wire `--stage=<s1,s2,...>` and `--limit=<n>` into `runCoordinatorCommand('status', ...)` and `USAGE` in `index.ts`.
- **`--out=<file>` on prepare-mode coordinator commands (`coordinator.ts`, `index.ts`):**
  - Add `out` to the allowed flags of `english-adversarial`, `english-audit`, `english-repair`, `russian-translation`, and `russian-audit`.
  - Reject `--out` when combined with `--result`.
  - When `--out=<file>` is passed and a task is prepared (i.e., not `skipped` or `reused`), write the prepared task JSON atomically via `writeJson(outFile, prepared)` and emit a compact summary `{ status: 'prepared', file: outFile, input_hash: prepared.input_hash, ...(targets count when applicable) }` to stdout instead of dumping the full prompt body.
- **Explicit writer model fallback on `profiles finalize` (`index.ts`):**
  - Allow optional `--model=<id>` on `profiles finalize` (defaulting to `await loadWriterModel()` when omitted) so Codex or Gemini runs can set fallback writer provenance when a staged file omits `writer.model`.

## Acceptance criteria

- [x] `packages/data-pipeline/data/raw/profiles/tasks/` is listed in root `.gitignore` and `TASKS_DIR` is exported from `packages/data-pipeline/src/profiles/paths.ts`.
- [x] `profiles status --stage=draft-pending-audit` and comma-separated `--stage=draft-pending-adversarial,draft-pending-audit` filter `items` and `summary` accurately, and `--limit=<n>` caps returned items; invalid stage names or non-positive `--limit` values throw clear errors.
- [x] Passing `--out=<file>` on `english-adversarial`, `english-audit`, `english-repair`, `russian-translation`, or `russian-audit` writes the exact prepared task JSON to `<file>` and emits a compact `{ status: 'prepared', file, input_hash }` summary; combining `--out` with `--result` throws an error; `skipped`/`reused` responses do not write an empty file.
- [x] `profiles finalize --model=<id>` records `<id>` as the fallback `meta.model` when a staged file omits `writer.model`, while preserving staged `writer.model` precedence and existing default behavior when `--model` is omitted.
- [x] Unit tests in `packages/data-pipeline/src/profiles/status.test.ts`, `verification/verification.test.ts`, and `finalize.test.ts` cover `--stage`, `--limit`, `--out` prepare/apply round trips, and `finalize --model`.
- [x] `npm run typecheck --workspace packages/data-pipeline`, `npm run test --workspace packages/data-pipeline`, and `npm run lint --workspace packages/data-pipeline` all pass.
