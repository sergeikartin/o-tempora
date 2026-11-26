---
status: accepted
---

# Subagent-first Profiles pipeline with Zod handoffs and committed files as truth

The prototype Profiles pipeline (former ADRs 0021–0024 and 0026–0040) started as a stateless provider-API harness and accumulated ~11k LOC of local snapshot slicing, per-claim assessment JSONs, substring quote matching, policy-version receipts, and multi-round repair state machines even after switching to conversation subagents. Redesign the pipeline from first principles for ~125–325 Legendary and Mainstream entities using conversation subagents exclusively (zero API billing).

- **Main session as Coordinator, 4 worker roles:** The main chat session orchestrates batches directly across `.claude/`, `.agents/`, and `.codex/` (avoiding nested-subagent limits), dispatching flagship (`inherit`) `profile-writer` / `profile-checker` subagents for English and mid-tier (`sonnet` / `flash` / low reasoning effort) `profile-translator` / `profile-translation-checker` subagents for decoupled Russian translation.
- **Active Checker + lightweight Markdown source cache:** `fetch-source` converts HTML/text into clean Markdown with heading line numbers in gitignored `packages/data-pipeline/.work/sources/` so subagents read sources with native file tools and `validate` proves every cited `sourceUrl` was fetched. Drop per-claim assessment JSONs, scout/dispute-URL plumbing, and verbatim substring matching; a fresh web-capable Checker audits cached `sourceUrl`s and runs independent falsification searches, blocking only on material factual defects with max one blocker-scoped patch revision (`apply-patch`).
- **Offline Connection lookup & unified Zod schemas:** `find-entity` resolves Connections offline against the local dataset by QID (dropping live Wikipedia URL→QID lookups). Four shared Zod schemas validate every handoff across both locales (`ProfileContentSchema`, `ProfilePatchSchema`, `CheckVerdictSchema`, `StoredProfileSchema`).
- **Committed files as truth:** Only clean, approved `<QID>-<slug>.<locale>.json` files are committed under `data/raw/profiles/<lane>/`; drafts, caches, verdicts, and `needs-review` items stay in gitignored `.work/`. `build-data` enforces deterministic invariants only and warns-and-skips on `meta.subjectDates` or Russian `meta.sourceHash` drift (falling back to **Description**), inheriting `sourceUrl`/`isLegend` authoritatively from `.en.json`.

## Considered Options

- **Standalone CLI calling provider APIs:** Cleaner unattended batching, but adds direct per-token API spend and removes hands-on subagent orchestration practice.
- **Keep committed `*.verification.json` receipts and mechanical quote-substring checks:** Stronger programmatic audit trail, but adds hundreds of thousands of lines of noisy JSON to Git and brittle quote/redirect/policy-version coupling.
- **Pure native `WebFetch` with zero local cache:** Less code, but `WebFetch` summarizes lossily, varies across harnesses, double-fetches pages between Writer and Checker, and cannot deterministically prove cited URLs were read.
