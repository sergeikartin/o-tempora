# Profiles Pipeline & Coordinator Playbook

A **Profile** replaces the Wikipedia **Description** in the detail panel with an overview, **Key Moments**, up to three **Deep Facts**, and **Connections**. English authoring and Russian translation are decoupled workflows sharing one lean CLI (`npm run profiles --workspace packages/data-pipeline -- <command>`), four Zod handoff schemas, and a gitignored workspace at `packages/data-pipeline/.work/`.

## Roles & Coordination

Your **main chat session acts as Coordinator** (default batch concurrency: **3 entities**), dispatching fresh worker subagents defined once under `prompts/` with thin shims across `.claude/agents/`, `.agents/agents/`, and `.codex/agents/`:

| Role | Tier | Prompt |
|---|---|---|
| `profile-writer` | Flagship (`inherit` in Claude/AGY; `gpt-6.2-astra` + `high` in Codex) | [profile-writer.md](../prompts/profile-writer.md) |
| `profile-checker` | Flagship (`inherit` in Claude/AGY; `gpt-6.2-astra` + `high` in Codex) | [profile-checker.md](../prompts/profile-checker.md) |
| `profile-translator` | Mid-tier (`sonnet` / `flash` / `gpt-6.2-sol` + `low` in Codex) | [profile-translator.md](../prompts/profile-translator.md) |
| `profile-translation-checker` | Mid-tier (`sonnet` / `flash` / `gpt-6.2-sol` + `low` in Codex) | [profile-translation-checker.md](../prompts/profile-translation-checker.md) |

### English Workflow (Coordinator Steps)
1. **Pick a batch:** Run `status --locale=en --stage=missing --limit=10` (or use QIDs chosen in chat).
2. **Prepare sequentially:** Run `prepare --locale=en --qids=Q1,Q2,Q3` so English Wikipedia articles are fetched politely into `.work/sources/` and `.work/<QID>/en.brief.json` is written before parallel Writers launch.
3. **Draft in parallel (up to 3 QIDs):** Launch one fresh `profile-writer` subagent per QID (`mode: draft`). Each Writer fetches/caches any extra cited pages via `fetch-source`, looks up Connections offline via `find-entity`, writes `.work/<QID>/en.draft.json`, and runs `validate <QID> --locale=en`.
4. **Check in parallel:** For each validated draft, launch one fresh `profile-checker` subagent (`mode: check`). The Checker reads cached `sourceUrl` Markdown files directly, runs independent web searches on risky claims/Deep Facts/myths, writes `.work/<QID>/en.check.json`, and runs `validate <QID> --locale=en --kind=check`.
5. **Handle verdicts (never interrupt mid-batch):**
   - `pass` → run `promote <QID> --locale=en --writer-model=<id> --checker-model=<id> --harness=<codex|claude|agy>` (writes clean `data/raw/profiles/<lane>/<QID>-<slug>.en.json`; passing the actual model IDs explicitly avoids vague or omitted subagent self-reports).
   - `revise` → dispatch **1 targeted revision** to `profile-writer` (`mode: revise`, writes `en.patch.json` and runs `apply-patch <QID> --locale=en`), then **1 scoped re-check** to a fresh `profile-checker` (`mode: recheck`, writes `en.recheck.json`). If `recheck` returns `pass`, run `promote` with the same provenance flags; otherwise leave it in `.work/<QID>/` (automatically reported as `needs-review` by `status`).
   - `escalate` → leave in `.work/<QID>/` as `needs-review` and continue the batch.
6. **Batch summary:** Report promoted QIDs, any `needs-review` QIDs with their blockers, and remind the user to review the `git diff`.

### Russian Workflow (Coordinator Steps)
Run independently over current approved English Profiles:
1. Run `status --locale=ru --stage=missing,stale --limit=10` (or explicit `--qids=...`).
2. Run `prepare --locale=ru --qids=Q1,Q2,Q3` — writes `.work/<QID>/ru.brief.json` with the committed `.en.json`, `sourceHash`, dataset Russian names (`nameRu`, `connectionNamesRu`), and cached Russian Wikipedia Markdown (when available).
3. Dispatch `profile-translator` (`mode: draft`) → `validate <QID> --locale=ru` → fresh `profile-translation-checker` (`mode: check`).
4. Apply the same verdict rule: `pass` → `promote <QID> --locale=ru --writer-model=<id> --checker-model=<id> --harness=<codex|claude|agy>`; `revise` → max 1 patch (`apply-patch`) + 1 scoped `recheck`; still blocked or `escalate` → `needs-review`.

## CLI Commands

Run from repo root: `npm run profiles --workspace packages/data-pipeline -- <command>`.

| Command | Purpose |
|---|---|
| `status [--locale=en\|ru] [--scope=legendary\|mainstream\|all] [--stage=...] [--qids=...] [--limit=N]` | Reports each entity’s stage (`missing`, `approved`, `stale`, `needs-review`, or `awaiting-english` for `ru`). Default scope is `mainstream` sorted by Detail Level and Fame Score. |
| `prepare --qids=Q1,Q2 [--locale=en\|ru] [--refresh]` | Sequentially fetches Wikipedia (EN or RU via Wikidata sitelink) into `.work/sources/` and writes `.work/<QID>/<locale>.brief.json`. |
| `fetch-source <url> [--refresh]` | Fetches a public HTTPS HTML/text page, converts HTML → clean Markdown in `.work/sources/<hash>.md`, indexes requested & post-redirect URLs, and prints `{ finalUrl, title, path, lineCount, headings }`. Fails fast on 403/bot-wall/PDF/tiny pages. |
| `find-entity <query...> [--limit=N]` | Offline lookup across all 4,611 dataset entities (`qid`, `slug`, `name`, `lane`, `dates`, `tagline`) for picking Connection QIDs. |
| `validate <qid> [--locale=en\|ru] [--kind=draft\|patch\|check\|recheck] [--file=<path>]` | Validates Zod handoffs and deterministic invariants (bold-only markup, `subjectDates`, valid/unique/non-self Connection QIDs, cached `sourceUrl`s for `en`; `sourceHash`, exact alignment, bold, preserved digits/Roman numerals, Cyrillic for `ru`). |
| `apply-patch <qid> [--locale=en\|ru]` | Validates `<locale>.patch.json`, mechanically rejects edits outside `check.json`’s `blockers[].path`, merges verbatim, and re-runs `validate`. |
| `promote <qid> [--locale=en\|ru] [--writer-model=<id>] [--checker-model=<id>] [--harness=codex\|claude\|agy] [--force] [--human-approved]` | Verifies `validate`, passing `check`/`recheck` (unless `--human-approved`), and required `writerModel`/`checkerModel` provenance; refuses overwrite without `--force`; stamps `promptVersion`, `promptHash`, `approval`, and `revised`; and writes `<QID>-<slug>.<locale>.json` to `data/raw/profiles/<lane>/`. |

## Storage & Publication

- **Committed files are truth:** Only approved Profiles live under `data/raw/profiles/<lane>/<QID>-<slug>.<locale>.json` (no committed verification receipts). Both locales share `StoredProfileSchema`; `.ru.json` records `meta.sourceHash`. Advisory staleness metadata (`writerModel`, `checkerModel`, `harness`, `promptVersion`, `promptHash`, `approval`, `revised`) is recorded on `promote` for future refresh prioritization and never blocks `build-data`.
- **Transient state:** Everything in-progress, cached sources, checker verdicts, and `needs-review` items live in gitignored `packages/data-pipeline/.work/`.
- **Manual resolution:** After editing a `needs-review` draft in `.work/<QID>/<locale>.draft.json`, promote it with `promote <QID> --locale=<locale> --human-approved`.
- **Publication:** `npm run build-data --workspace packages/data-pipeline` validates committed Profiles deterministically, takes `sourceUrl`/`isLegend` authoritatively from `.en.json`, warns and skips Profiles whose `meta.subjectDates` or Russian `meta.sourceHash` drifted (falling back to **Description**), writes `data/output/profiles/<locale>/<slug>.json`, sets `hasProfile`, and verifies Connection parity. `npm run publish-data --workspace packages/data-pipeline` copies them to `packages/shared-types/src/data/`.
