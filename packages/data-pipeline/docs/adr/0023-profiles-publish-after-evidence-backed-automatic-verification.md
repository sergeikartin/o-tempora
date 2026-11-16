---
status: superseded
superseded-by: 0024-profiles-can-use-conversation-subagents.md
supersedes: 0022-profile-writer-is-an-agent-or-an-api-call.md
---

# Profiles publish after evidence-backed automatic verification

Reviewing every generated Profile by hand does not scale. Keep ADR 0022's writer choices and staged-file seam, but replace its human promotion gate with an explicit offline `profiles verify --repair` command. The verifier uses OpenAI Responses web search for discovery and a local article fetcher for evidence; a separate model call audits coverage and entailment. This reuses the existing OpenAI dependency and credentials while leaving writer provider choice intact.

Every visible factual claim must be supported, including claims missing from the writer's list. The pipeline checks quotations against fetched text, identities against QIDs, and extracted subject boundary dates against dataset dates. High-risk claims need independent corroboration. Up to two repair passes may correct or qualify evidence-backed wording and remove unsupported optional material; every resulting Profile is verified again. Essential unresolved claims hold the Profile, leaving the Description available. Fetch failures are retryable, not evidence against a claim.

Output requires a current-policy receipt bound to the exact Profile content, identity, locale and verification report. `reviewed` and `edited` alone no longer authorize publishing. `edited` continues to protect prose from automated changes: repair produces a proposal instead. Hashes detect stale or changed artifacts; they are not signatures against someone deliberately forging both files.

The committed report contains verdicts, evidence excerpts, source hashes, model IDs and blockers. Full article snapshots stay local. Small, varied human audits of automatic approvals calibrate the policy; unresolved essential facts and protected-edit proposals are the human queue. A model verdict is not a guarantee of historical truth, so failures found in audits become regression cases and policy changes invalidate older receipts.
