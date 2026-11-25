---
status: accepted
---

# Profile pipeline efficiency and verification policy 8

Multi-round English verification and repair dominated Profile turnaround time and token usage. Excerpt reads returned full snapshot `anchors` and `headings` arrays (tens of kilobytes per Wikipedia read), repairs regenerated entire assessed Profiles, adversarial checks targeted multiple findings on the same Deep Fact and re-ran after minor wording fixes, and re-audits reopened untouched passages on phrasing nitpicks.

Under policy 8:

- `profiles evidence` strips `anchors` and `headings` from excerpt responses, supports HTTP compression (`gzip`, `deflate`, `br`) with decompressed size caps, and accepts `--batch=<json|@file>` (up to 12 reads, up to 3 concurrent) to collapse sequential CLI round-trips.
- `selectAdversarialTargets` selects at most one representative supported finding per distinct passage (up to five passages). Policy 7 approvals remain valid under their original per-finding selection.
- `validateAdversarialEvidence` enforces source-kind classification rules alongside quote containment, and `reusableAdversarialChecks` reuses prior `conflict_found` and `no_conflict_found` checks across repairs when counterevidence is preserved and no new risk cue, long quote, number, or risk escalation is introduced.
- `english-repair` emits a compact task containing only the Profile, blockers, and flagged findings, and accepts a compact JSON patch containing only changed passages (plus optional drops and `subject_dates`), preserving untouched passages and findings verbatim. Full assessed Profile replies remain accepted. `preflight --file` merges and validates patch replies locally.
- `englishAuditPrompt` narrows surrounding excerpt windows to 350 characters, omits mechanical fields and supported explanations, and attaches `re_audit` metadata (`repaired_paths` and `prior_blockers`) after repairs so follow-up audits focus on resolved blockers and touched passages without drifting into footnote-bloat escalation spirals.
