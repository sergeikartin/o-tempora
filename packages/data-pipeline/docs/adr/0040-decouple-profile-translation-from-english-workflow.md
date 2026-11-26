---
status: accepted
---

# Decouple Russian Profile translation from the English workflow

The Profile pipeline previously coupled English authoring/verification and Russian translation inside one coordinator and one `status` state machine (`english-approved` pointed to `russian-translation` until `bilingual-approved`). That forced English batches to either carry Russian translation along by default or pass `stop_after: english-audit`, and mixed two independent concerns: English research/verification (which is heavy, web-backed, and can publish on its own) and Russian translation/fidelity review (which is pure-text over already-approved English artifacts).

Decouple the two workflows while keeping one `profiles` CLI and the existing sidecar file layout:

- **Two coordinators:** `profile-coordinator` handles English authoring, verification, and repair only, ending at `english-approved`. A dedicated `profile-translation-coordinator` (registered across `.claude/agents/`, `.agents/agents/`, and `.codex/agents/` from canonical `docs/profile-translation-coordinator.md`) handles Russian translation and fidelity audits over current approved English Profiles without modifying English drafts or reports.
- **Decoupled status commands:** `profiles status` tracks English stages only (`missing`, `staged`, `draft-pending-audit`, `english-held`, `english-approved` with `next_command: done`) and drops its import of `translation.ts`. A new `profiles translation-status` command (`src/profiles/translation-status.ts`) inspects Russian translation stages (`missing`, `held`, `approved`, and `awaiting-english`). In scope mode it defaults to `--scope=all` across all lanes and returns only current approved English Profiles unless `--stage` includes `awaiting-english`; with `--qids` it reports every requested QID explicitly.
- **Unchanged storage and publication contract:** Approved English Profiles (`*.en.json` + `*.en.verification.json`), Russian sidecars (`*.ru.translation.json` / `*.ru.translation.held.json`), and independent locale publication in `build-data` remain unchanged ([ADR-0026](0026-profiles-translate-approved-english-into-russian.md), [ADR-0037](0037-profiles-separate-audit-rules-from-publish-receipts.md)).
