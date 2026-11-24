# 02 — Zero-network local preflight CLI command

Status: resolved
**Blocked by:** None — can start immediately (parallel with 01 and 03).

**What to build:** Expose a fast, zero-network, zero-LLM `profiles preflight` command so writer and repair agents can catch deterministic mechanical, quote, anchor, date, and corroboration errors inside their warm context before running `finalize` or spending an audit pass.

- Create `packages/data-pipeline/src/profiles/preflight.ts` exporting `preflightProfile(options)` that accepts `{ qid, filePath, profilesDir, subject }` and runs strictly local checks:
  - **Input detection:** Parse either a staged assessed Profile (`extractAssessedProfile`, e.g. `incoming/<QID>.json`) or a finalized raw Profile with `meta.pending_assessment` / saved verification report (`parseModelProfile` + `readPendingAssessment`). Report schema parse failures cleanly in `issues` rather than crashing with an opaque stack trace.
  - **Identity & Connection syntax:** Check `profile.type === SUBJECT_TYPE[subject.lane]`, flag non-canonical or unparseable Wikipedia article URLs on `profile.wikipedia_url` and `profile.connections[]` using `titleOfArticleUrl()` (zero MediaWiki network calls), and warn/flag duplicate Connection URLs.
  - **Markup & Key Moment dates:** Reuse `assertBoldOnlyMarkup()` across `passages(profile)` and the pure date checks from `mechanical.ts` (`yearRange` backwards ranges and historical year zero).
  - **Cached snapshot loading:** Load all snapshot IDs referenced by `assessment.findings` from `<profilesDir>/evidence/<id>.json` using `parseSourceSnapshot()`, reporting missing or corrupted snapshots as actionable issues instead of throwing on the first missing file.
  - **Evidence, citations, dates & corroboration:** Run `evidenceChecks(profile, subject, assessment, snapshots)`, `checkEvidence(assessment, snapshots)`, and the passage-coverage / `supported`-verdict / reliable-source / `corroborate` (distinct hosts, distinct origins, primary/scholarly) checks from `policy.ts`—sharing extracted helpers rather than duplicating policy logic.
  - Return a compact structured report:
    ```ts
    {
      ok: boolean;
      qid: string;
      file: string;
      checked_passages: number;
      checked_findings: number;
      checked_sources: number;
      issues: string[];
    }
    ```
- Wire `preflight --qid=<QID> [--file=<path>]` into `packages/data-pipeline/src/profiles/coordinator.ts` (`runCoordinatorCommand`) and `USAGE` in `packages/data-pipeline/src/profiles/index.ts`:
  - Default `--file` to `path.join(options.profilesDir, 'incoming', `${qid}.json`)`.
  - Emit the JSON report and set `process.exitCode = 1` when `ok` is `false`.
- Update living docs and writer agent guidance in the same change:
  - `packages/data-pipeline/docs/profiles.md` and `packages/data-pipeline/docs/profile-coordinator.md` (add `preflight` between staging and `finalize`, and before returning a repair reply).
  - `.claude/agents/profile-writer.md` and `.codex/agents/profile-writer.toml` (instruct the writer to run `preflight` on its staged file before handing back to the coordinator).

## Acceptance criteria

- [x] `profiles preflight --qid=<QID>` defaults to `data/raw/profiles/incoming/<QID>.json` and supports `--file=<path>` for both staged assessed Profiles and finalized drafts with `pending_assessment`.
- [x] `preflight` makes zero network calls (never invokes `resolveArticleQids` or `fetchSource`).
- [x] Clean staged assessed Profiles return `{ ok: true, ..., issues: [] }` with exit code 0.
- [x] Each failure class produces a clear issue and `ok: false` (exit code 1): schema error, wrong `type`, unpaired/disallowed markup, backwards or year-zero Key Moment date, `subject_dates` mismatch against dataset span, missing cached snapshot, quote not found in snapshot, displayed `source` URL not among supporting fetched pages, missing `#anchor` fragment, malformed Connection Wikipedia URL, incomplete passage coverage, non-`supported` finding, or missing `corroborate` host/origin/scholarly support.
- [x] Pure mechanical/policy validation helpers are shared with `mechanical.ts` and `policy.ts` rather than copy-pasted.
- [x] Unit tests in `packages/data-pipeline/src/profiles/preflight.test.ts` (or `verification.test.ts`) exercise both `preflightProfile` and `runCoordinatorCommand('preflight', ...)` across passing and failing fixtures.
- [x] Living docs (`profiles.md`, `profile-coordinator.md`) and writer agent files (`.claude/agents/profile-writer.md`, `.codex/agents/profile-writer.toml`) document `preflight`.
- [x] `npm run typecheck --workspace packages/data-pipeline`, `npm run test --workspace packages/data-pipeline`, and `npm run lint --workspace packages/data-pipeline` all pass.
