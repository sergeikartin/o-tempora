# Profiles Pipeline v2 — Redesign Plan

Status: resolved

## Context & Problem

The current Profiles pipeline grew organically across 19 ADRs (`0021`–`0024`, `0026`–`0040`) from memory-only drafts → provider APIs → stateless automated verification → session polling → subagent coordinators → adversarial verification → upfront scout/prefetch → policy 9 guardrails. The result is ~11,150 LOC in `packages/data-pipeline/src/profiles/`, 7 subagent roles mirrored across 3 harnesses, 600–900 line committed `*.verification.json` receipts, and complex state-machine plumbing (`pending.json`, `policy_version`, `profile-scout`, `assessment` JSON, verbatim substring quote matching, live Wikipedia URL→QID resolution).

Most of that complexity existed because the pipeline started as a stateless API harness and kept that machinery after moving to conversation subagents. Now that we know what actually matters for O Tempora, we can discard the prototype ADRs and throwaway code and build a clean v2 pipeline from first principles.

---

## Settled Design Decisions

### 1. Target Scale & Runtime
- **Scale:** Sized primarily for **Legendary + Mainstream (~125–325 entities, starting with the 123 Legendary)**, with clean headroom to Specialized (~800). Not optimizing for all 4,611 Deep Cut entities.
- **Execution:** **Conversation subagents only** — zero marginal API spend, using existing harness subscriptions and practicing clean subagent coordination.
- **Main session as Coordinator:** The main chat session runs coordination following a canonical playbook/skill (default batch concurrency: **3 entities**), dispatching fresh worker subagents directly. This avoids nested-subagent restrictions in Claude Code and works identically across `.claude/`, `.agents/`, and `.codex/`.
- **4 Worker Roles** (replacing 7) with one canonical doc/prompt set under `packages/data-pipeline/` and thin 5-line shims across `.claude/`, `.agents/`, and `.codex/`:
  - `profile-writer` — flagship (`inherit`)
  - `profile-checker` — flagship (`inherit`)
  - `profile-translator` — mid-tier (`sonnet` in `.claude`, `flash` in `.agents`, inherited model + lower reasoning effort in `.codex`)
  - `profile-translation-checker` — mid-tier (`sonnet` / `flash` / lower reasoning effort)

### 2. Sourcing, Verification & Revision Loop
- **Source bar:** **Wikipedia and any other reputable open source** are equally valid for both **Key Moments** and **Deep Facts**. Prefer a focused external `sourceUrl` when cleanly available (e.g. from Wikipedia’s references), without banning Wikipedia. Check surprising anecdotes, exact quotes, and superlatives against myths/disputes and mark legends with `isLegend: true`.
- **Shared lightweight source cache:** A single CLI command (`fetch-source`) fetches any public HTTPS HTML/text page, converts HTML → clean Markdown with `# Headings` (using a dedicated HTML-to-Markdown library alongside existing HTML parsing as appropriate), and writes it to gitignored `packages/data-pipeline/.work/sources/<hash>.md`. It indexes both requested and post-redirect final URLs, respects Wikipedia pacing, and fails fast on 403/bot-wall/PDF/empty pages. It prints a compact JSON summary (`{ finalUrl, title, path, lineCount, headings: [{ heading, line }] }`) so Writer and Checker read exact line ranges using their **native file-reading tool** (no custom CLI `--offset`/`--length`/`--batch` flags).
- **Active web-capable Checker:** Drop `profile-scout`, `assessment` JSON, `dispute_urls`, and verbatim substring quote-matching. The Writer produces clean Profile JSON; a fresh **Checker** subagent reads the cached `sourceUrl`s *and* runs its own independent web/falsification searches on risky claims (dates, quotes, numbers, Deep Facts, myths), returning concise per-passage check notes and a `pass | revise | escalate` verdict.
- **Audit strictness & 1-round patch loop:**
  - Checker blocks **only on material factual defects** (wrong date/name/attribution, unsupported or contradicted claim, unlabeled myth, dead/off-topic citation, dataset mismatch, non-neutral framing). Editorial feedback is surfaced as non-blocking `suggestions`.
  - On `revise`: max **1 targeted revision + 1 scoped re-check**. The Writer receives the draft for context plus only the flagged blockers and outputs a **field-only Zod patch** (`ProfilePatchSchema`). `apply-patch` mechanically rejects any patch key not listed in `blockers[].path`, guaranteeing untouched passages stay verbatim unchanged. Prefer cutting or replacing an unverified optional detail/Deep Fact over piling on caveats.
  - On re-check, Checker audits resolved blockers, touched passages, and overall coherence without raising fresh nitpicks on untouched passages.
- **Batch flow & escalation:** Auto-promote passing drafts automatically; never interrupt mid-batch. Still-blocked or `escalate` items remain in `.work/<QID>/` marked **`needs-review`** (surfaced by `status` and the batch summary). After manual editing, a human promotes them with `promote --human-approved` (which still runs full deterministic `validate`).

### 3. Unified Zod Schemas (4 Schemas Across EN & RU)
Add **`zod`** to `packages/data-pipeline` and validate every handoff boundary with strict schemas shared across English and Russian:

1. **`ProfileContentSchema`** (`.work/<QID>/<locale>.draft.json` and body of committed files):
   ```ts
   {
     overview: string,
     keyMoments: [{ date: string, title: string, text: string, sourceUrl: string }], // 2–4
     deepFacts: [{ text: string, isLegend: boolean, sourceUrl: string }],            // 0–3
     connections: [{ qid: string, reason: string }]
   }
   ```
   *(Drops unused review fields: `claims`, `confidence`, `type`, `importance`, `assessment`.)*
2. **`ProfilePatchSchema`** (`.work/<QID>/<locale>.patch.json`):
   ```ts
   {
     overview?: string,
     keyMoments?: Record<string, KeyMoment | null>,
     deepFacts?: Record<string, DeepFact | null>,
     connections?: Record<string, Connection | null>
   }
   ```
3. **`CheckVerdictSchema`** (`.work/<QID>/<locale>.check.json` and `recheck.json`):
   ```ts
   {
     qid: string,
     locale: 'en' | 'ru',
     verdict: 'pass' | 'revise' | 'escalate',
     checks: [{ path: string, status: 'pass' | 'blocker', note: string }],
     blockers: [{ path: string, issue: string, fix: string }],
     suggestions: string[]
   }
   ```
   *(Refinement enforces `pass => blockers.length === 0` and `revise => blockers.length > 0`.)*
4. **`StoredProfileSchema`** (`data/raw/profiles/<lane>/<QID>-<slug>.<locale>.json`):
   `ProfileContentSchema` plus compact `meta`:
   ```ts
   meta: {
     qid: string,
     locale: 'en' | 'ru',
     subjectDates: string,     // dataset dates when written/checked, e.g. "1879–1955"
     approvedAt: string,       // ISO timestamp
     sourceHash?: string,      // ru only: sha256 of canonical English prose
     writerModel?: string,
     checkerModel?: string
   }
   ```

For Russian (`ru`), drafts and stored files share the exact same schema, carrying `sourceUrl` and `isLegend` copied from `.en.json`. `validate --locale=ru` verifies they match `.en.json` unchanged, and `build-data` treats `.en.json`’s `sourceUrl`/`isLegend` as authoritative if English citations are ever updated.

### 4. Workspace & 7-Command CLI Surface
All transient files live in gitignored **`packages/data-pipeline/.work/`** (the files *are* the state — no `pending.json`, no `blocked-hosts`, no `wikipedia-qids.ts`):

```text
packages/data-pipeline/.work/
├── sources/
│   ├── index.json            # requestedUrl -> hash & finalUrl -> hash
│   └── <sha256-16>.md        # clean Markdown with # Headings
└── <QID>/
    ├── en.brief.json         # dataset metadata + cached en Wikipedia path
    ├── en.draft.json         # ProfileContentSchema (+ qid/subjectDates wrapper or meta)
    ├── en.check.json         # CheckVerdictSchema
    ├── en.patch.json         # optional 1-round revision (ProfilePatchSchema)
    ├── en.recheck.json       # optional scoped re-check (CheckVerdictSchema)
    ├── ru.brief.json         # committed EN + sourceHash + Russian dataset names + cached ru Wikipedia path
    ├── ru.draft.json
    ├── ru.check.json
    ├── ru.patch.json
    └── ru.recheck.json
```

Commands under `npm run profiles --workspace packages/data-pipeline -- <command>`:
1. **`status [--locale=en|ru] [--scope=legendary|mainstream|all] [--stage=...] [--qids=...] [--limit=N]`** — reports `missing | approved | stale | needs-review` (default scope `mainstream`, sorted by Fame Score descending so Legendary comes first).
2. **`prepare --qids=Q1,Q2,... [--locale=en|ru]`** — for `en`: sequentially fetches each subject’s English Wikipedia article into `.work/sources/` (polite pacing) and writes `en.brief.json`. For `ru`: reads committed `.en.json`, computes `sourceHash`, looks up Russian dataset names for the subject and every Connection, fetches the subject’s **Russian Wikipedia** article into `.work/sources/` when present, and writes `ru.brief.json`.
3. **`fetch-source <url>`** — fetches/caches a public HTTPS HTML/text page as clean Markdown with headings in `.work/sources/<hash>.md`, returning `{ finalUrl, title, path, lineCount, headings }`.
4. **`find-entity <query...>`** — offline lookup across all 4,611 dataset entities (`name`, `slug`, `tagline`, `wikipediaUrl`), returning `qid`, `slug`, `name`, `lane`, `dates`, `tagline`. Eliminates live Wikipedia URL→QID resolution and silent Connection dropping.
5. **`validate <qid> --locale=en|ru [--kind=draft|patch|check]`** — Zod + deterministic checks:
   - Common: schema, bold-only markup (`**...**`), valid/unique/non-self Connection QIDs, no year 0 / reversed year ranges.
   - `en`: `subjectDates` matches dataset, every `sourceUrl` exists in `.work/sources/index.json` with content.
   - `ru`: `sourceHash` matches `.en.json`, array lengths and Connection QID order match `.en.json`, `sourceUrl` & `isLegend` match `.en.json`, bold presence where English has bold, preserved digits/Roman numerals, Cyrillic prose present.
6. **`apply-patch <qid> --locale=en|ru`** — validates `patch.json`, mechanically enforces that only paths in `check.json`’s `blockers` are touched, merges verbatim (dropping `null` items), and immediately runs `validate`.
7. **`promote <qid> --locale=en|ru [--force] [--human-approved]`** — verifies `validate` passes and latest `check`/`recheck` verdict is `pass` (unless `--human-approved`), refuses to overwrite an existing committed file without `--force`, and writes clean `<QID>-<slug>.<locale>.json` into `data/raw/profiles/<lane>/`.

### 5. Storage, Publication & Bilingual Contract
- **`packages/shared-types` & `packages/web` stay unchanged.**
- **Committed-files-as-truth:** `data/raw/profiles/<lane>/` holds only approved `<QID>-<slug>.en.json` and `<QID>-<slug>.ru.json`. No committed `*.verification.json` receipts, no `policy_version`, no `review.status === "edited"` (replaced by no-overwrite without `--force`).
- **Decoupled EN → RU** with independent locale publication. Missing or stale Russian falls back to Russian Wikipedia **Description**.
- **`build-data` (`src/output/profiles.ts`):** Validates committed files with `StoredProfileSchema` + bold-only markup + Connection target resolution; uses `.en.json`’s `sourceUrl`/`isLegend` authoritatively; **warns and skips** (falling back to **Description**) if `meta.subjectDates` drifts from the current dataset or Russian `meta.sourceHash` drifts from `.en.json`.

### 6. Migration, Docs & ADR Cleanup
- **Migrate existing Profiles:** Convert all **13 approved English** (the 12 shipped + Michelangelo `Q5592`, which passed verification with 0 blockers) and **11 Russian** Profiles into `<QID>-<slug>.<locale>.json` and delete old `*.en.verification.json` and `*.ru.translation.json` sidecars.
- **ADRs:** Delete the 19 prototype Profile ADRs (`0021`–`0024` and `0026`–`0040`), **keep `0025-person-dates-can-have-evidenced-corrections.md`** (Transform), and add one concise **`0026-profiles-subagent-pipeline.md`** capturing the hard-to-reverse trade-offs.
- **Glossary:** Leave root `GLOSSARY.md` untouched (all reader-facing Profile terms are already defined there; pipeline roles/states live in `packages/data-pipeline/docs/profiles.md`).
- **`.gitignore`:** Ignore `packages/data-pipeline/.work/` and remove obsolete `data/raw/profiles/{incoming,tasks,evidence}/` ignore rules.

---

## Execution Steps

1. **Dependencies & `.gitignore`**
   - Install `zod` and an HTML-to-Markdown library (e.g. `turndown` + `linkedom` or `node-html-markdown`, dropping unused `tldts` if no longer needed) in `packages/data-pipeline`.
   - Update `.gitignore` for `packages/data-pipeline/.work/`.
2. **Core v2 `src/profiles/` implementation + unit tests**
   - `schemas.ts`: the 4 shared Zod schemas + `sourceHash` helper.
   - `paths.ts`, `subjects.ts` (keep clean subject index + add Russian Wikipedia URL & `find-entity` matching), `markup.ts` (keep bold-only check).
   - `sources.ts`: polite Wikipedia pacing + HTML→Markdown conversion + `.work/sources/` cache & heading line index + fail-fast rejection.
   - `validate.ts`, `patch.ts`, `store.ts`, `status.ts`, `prepare.ts`, `promote.ts`, `index.ts` (7-command CLI).
   - Comprehensive Node unit tests covering schemas, HTML→Markdown, `find-entity`, `validate` (EN & RU), `apply-patch` (strict blocker-path guard), `promote` (overwrite & `--human-approved`), and `status`.
3. **Output integration & data migration**
   - Rewrite `src/output/profiles.ts` and `src/output/profiles.test.ts` to read `StoredProfileSchema`, apply warn-and-skip freshness checks (`subjectDates` and Russian `sourceHash`), and keep `verifyBuiltProfiles` intact.
   - Migrate the 13 EN + 11 RU raw Profiles to the new clean `<QID>-<slug>.<locale>.json` format and remove all old `*.en.verification.json` and `*.ru.translation.json` files.
   - Delete all superseded v1 files under `src/profiles/` (including `src/profiles/verification/`).
4. **Prompts, playbooks, harness shims & docs**
   - Write canonical editorial & verification prompts (`prompts/profile-writer.md`, `prompts/profile-checker.md`, `prompts/profile-translator.md`, `prompts/profile-translation-checker.md`) preserving the proven voice, Deep Fact criteria, myth-labeling, and neutrality rules from v1.
   - Write the canonical Coordinator playbook (`packages/data-pipeline/docs/profiles.md`) covering both English and Russian workflows.
   - Replace the 7 old role shims across `.claude/agents/`, `.agents/agents/`, and `.codex/agents/` with the 4 new worker shims (tiered flagship/mid-tier models).
   - Delete prototype ADRs `0021`–`0024` and `0026`–`0040`, keep `0025`, write `0026-profiles-subagent-pipeline.md`, and update `packages/data-pipeline/docs/code-conventions.md` and `AGENTS.md` if needed.
5. **Verification**
   - Run `npm run test --workspace packages/data-pipeline`
   - Run `npm run typecheck --workspace packages/data-pipeline`
   - Run `npm run lint --workspace packages/data-pipeline`
   - Run `npm run build-data --workspace packages/data-pipeline` (verify 13 EN + 11 RU ship cleanly with 0 warnings) and `npm run publish-data --workspace packages/data-pipeline`
   - Run `npm run profiles --workspace packages/data-pipeline -- status --limit=10` and `find-entity "Max Planck"` as a live smoke check.
