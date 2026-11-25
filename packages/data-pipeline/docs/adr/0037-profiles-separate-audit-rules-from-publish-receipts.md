---
status: accepted
---

# Separate audit-time verification rules from publish-time receipts

Re-running live verification rules (such as adversarial target selection) inside `readProfileApproval` forced the codebase to accumulate historical `policy_version` compatibility branches (`2` through `7`) and an `adversarial_disabled` opt-out whenever verification rules evolved.

Separate the two concerns:

- **Audit time (`applyEnglishAudit` / `blockers`)** always enforces the current pipeline rules (including per-passage adversarial targets) and stamps `POLICY_VERSION` onto new reports as provenance metadata.
- **Publish time (`readProfileApproval`)** verifies receipt authenticity and stored invariants (`qid`, current dataset `dates`, `review.status`, matching non-empty `policy_version`, `profile_hash`, `report_hash`, parsed `assessment`/`audit`, and empty `blockers`, `mechanical`, `evidence_errors`, and audit/assessment issues) without re-running current target-selection heuristics against already-approved reports.
- Retire the pre-ADR-0032 `--research=<file>` flag, `draftConnectionUrls` remapping, and `not_on_wikipedia` draft source sentinel now that every draft originates from an assessed Profile with fetched public HTTPS citations.
