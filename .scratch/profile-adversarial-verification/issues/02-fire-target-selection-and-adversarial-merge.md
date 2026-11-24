# 02 — FIRE target selector, Loki adversarial contract, and policy v7 gate

**Status:** resolved
**Blocked by:** None — can start immediately (parallel with 01).

**What to build:** Build the pure, deterministic core of lightweight adversarial verification—target selection, neutral/falsification prompt, result parsing, counterevidence merging, auditor surfacing, and verification policy version 7—verifiable end-to-end through the policy, audit-payload, and publication seams without requiring live API or coordinator execution yet.

- Create `packages/data-pipeline/prompts/profile-adversarial.md` (v1.0.0 with matching SHA-256 prefix) implementing the Loki neutral/falsification search prompt: decompose claims to neutral entity-aspect queries plus falsification queries for myths/quotes/superlatives, avoid echo-chamber domains already in `cited_urls`, fetch via local evidence tool only, and return `{ checks: [...] }`.
- Create `packages/data-pipeline/src/profiles/verification/adversarial.ts` exporting:
  - `AdversarialTarget`, `AdversarialCheck`, `AdversarialResult` types.
  - `selectAdversarialTargets(profile, assessment)`: deterministically picks up to 5 `verdict === 'supported'` findings (excluding pure subject start/end year restatements), ranked by Priority 1 (`deep_facts.*`), Priority 2 (`risk === 'corroborate'`), and Priority 3 (heuristic escalation on `ordinary` findings with quoted speech $\ge 15$ chars, superlatives/firsts, or attribution/legend cues), attaching `finding_index`, `path`, `claim`, `passage_text`, `existing_counterevidence`, and `claim_hash = hash({ path, claim })`.
  - `adversarialPrompt(profile, subject, assessment, targets)`: renders `profile-adversarial.md` with only subject brief, selected `targets`, and `cited_urls` (omitting writer `explanation`).
  - `parseAdversarialResult(value, targets)`: validates `checks` schema, outcomes (`no_conflict_found | conflict_found | fetch_blocked`), `finding_index`/`path` alignment with `targets`, and `counterevidence` excerpt shapes.
  - `mergeAdversarialResult(assessment, result)`: returns a new `Assessment` with validated `counterevidence` appended to matching findings (deduplicated by `source` + `normalizeText(quote)`) without mutating `finding.evidence` or `finding.verdict`.
- Update `packages/data-pipeline/src/profiles/verification/policy.ts`:
  - Bump `POLICY_VERSION` to `'7'` while keeping `'3'`–`'6'` (and `'2'` for closed spans/points) eligible in `isCurrentVerificationPolicy()`.
  - Add optional `adversarial?: { model: string; checks: AdversarialCheck[] }` to `Report`.
  - In `blockers()`, when `report.policy_version === '7'` and `report.adversarial` is present (or expected targets exist unless explicitly marked skipped/disabled), enforce that every `conflict_found` check carries at least one `counterevidence` item and every checked `finding_index` matches a valid finding, while `checkEvidence()` continues verifying all merged counterevidence quotes against local snapshots.
- Update `englishAuditPrompt()` in `packages/data-pipeline/src/profiles/verification/researcher.ts` to accept an optional `adversarialChecks` parameter and include `adversarial_notes` (only for `conflict_found` and `fetch_blocked` entries) in the audit JSON payload.

## Acceptance criteria

- [x] `packages/data-pipeline/prompts/profile-adversarial.md` exists with v1.0.0 metadata and verified SHA-256 prefix (`prompt.test.ts` passes).
- [x] `selectAdversarialTargets` selects Priority 1 (`deep_facts.*`), Priority 2 (`corroborate`), and Priority 3 (long quotes, superlatives/firsts, legend cues) in priority order, ignores non-`supported` findings, and caps output at 5 targets.
- [x] `adversarialPrompt` omits writer `explanation` fields and includes subject brief, selected targets, and deduplicated `cited_urls`.
- [x] `mergeAdversarialResult` appends adversarial counterevidence without duplicates and preserves existing `evidence` and `verdict` values unchanged.
- [x] Merged adversarial quotes are checked by `checkEvidence()`; fabricated or uncached adversarial quotes block approval.
- [x] `POLICY_VERSION` is `'7'`; `readProfileApproval` and `shipProfiles` continue accepting valid existing version `2`–`6` approvals while validating version `7` reports (including `adversarial` integrity).
- [x] `englishAuditPrompt` includes `adversarial_notes` for `conflict_found` and `fetch_blocked` checks and omits `no_conflict_found` noise.
- [x] Unit tests in `packages/data-pipeline/src/profiles/verification/verification.test.ts` verify target prioritization/caps, prompt omission of writer explanations, deduplicated counterevidence merge, fabricated adversarial quote rejection, `adversarial_notes` payload, and v2–v6 backward compatibility with `shipProfiles`.
- [x] `npm run typecheck --workspace packages/data-pipeline`, `npm run test --workspace packages/data-pipeline`, and `npm run lint --workspace packages/data-pipeline` all pass.
