# Automate the review gate

Type: grilling
Status: resolved
Blocked by: 03

## Question

Output ships only `reviewed` and `edited` Profiles, and only the user moves `draft` to `reviewed`. How is that automated without letting unchecked claims through? Cover: which verifier verdicts and `meta.validation` flags auto-promote a Profile, which block it, which only advise; whether a Profile with any `contradicted` claim can ever auto-promote; how `confidence` and `is_legend` order the human queue for what remains; and whether the promotion is a pipeline step or a command run after the verifier reports.

## Answer

Accepted and implemented: `profiles verify --qids=... --repair` performs source-backed claim checking, an independent coverage/evidence audit, up to two repairs and deterministic approval. All surviving claims must be supported; any contradiction, unverifiable/disputed claim, uncovered detail or mechanical failure blocks approval. Confidence is advisory; attributed legends verify the documented account. Missing optional facts/Connections can be removed. Fetch failures retry rather than justify deletion.

Output checks a receipt bound to content, identity, locale, report and current policy. `edited` protects prose but does not grant publication; proposed changes to protected prose go in `proposals/`. Humans handle essential unresolved decisions and a small varied audit sample. The command is separate from Output/build-data. See [verification policy](../../../packages/data-pipeline/docs/profile-verification.md) and [ADR 0023](../../../packages/data-pipeline/docs/adr/0023-profiles-publish-after-evidence-backed-automatic-verification.md).

Implementation validation uses mocked model/source responses; the 30-profile live verification and calibration remain ticket 12.
