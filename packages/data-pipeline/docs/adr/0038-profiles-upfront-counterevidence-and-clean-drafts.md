---
status: accepted
---

# Move counterevidence discovery upfront and keep transient state out of raw Profiles

Post-draft adversarial verification added an extra subagent stage, checkpoint/reuse state machine, and forced repair loops whenever counter-accounts surfaced only after writing. Meanwhile, embedding `meta.pending_assessment`, `meta.pending_adversarial`, and `meta.coordinator_repair` inside `data/raw/profiles/<lane>/<QID>-*.en.json` bloated committed drafts with hundreds of lines of transient state, and `verification-history/` plus `proposals/` added file-management complexity rarely used in practice.

Simplify the English Profile workflow:

- **Upfront counterevidence discovery:** Remove the post-draft `english-adversarial` command, `profile-adversarial` role, and adversarial checkpoint/reuse modules. `profile-scout` runs neutral and falsification queries per Deep Fact angle (`deep_fact_candidates[].dispute_urls` and top-level `dispute_urls`), `prefetch --manifest` caches them as `dispute_source_ids` in the Source Map, and `profile-writer` reads competing accounts alongside supporting evidence during drafting. `profile-auditor` remains stateless.
- **Transient state in `tasks/<QID>/pending.json`:** `finalize` writes clean drafts to `data/raw/profiles/<lane>/<QID>-*.en.json` with no `pending_*` or `coordinator_repair` fields in `meta`. Pending assessments, repair counts, and `re_audit` metadata live in gitignored `data/raw/profiles/tasks/<QID>/pending.json` (with read fallback to legacy `meta.pending_assessment` on pre-existing drafts).
- **Drop `verification-history/` and `proposals/`:** Git tracks committed history and `tasks/<QID>/` tracks the active run. Keep `review.status === "edited"` as a simple overwrite guard: `finalize` skips edited records and `english-repair` refuses prose changes on edited records, while `english-audit` can re-approve human edits directly.
