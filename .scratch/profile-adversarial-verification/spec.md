Status: superseded by ../profiles-pipeline-v2/spec.md

Labels: ready-for-agent

# Adversarial Verification and Heading-Aware Source Excerpts for Profiles

## Problem Statement

Today, English Profile verification operates as a closed-world entailment check. The independent auditor sees only the sources and counterevidence chosen by the writer or research pass, and inspects narrow 700-character excerpts sliced from a flat, tag-stripped text stream. This leaves three blind spots:

1. **Cherry-picking bias on high-risk claims.** If a writer cites a popular secondary page repeating a famous myth, misattributed quotation, or disputed superlative and never fetches a scholarly rebuttal, the independent auditor has no contradictory evidence in front of it and legitimately marks the passage supported.
2. **Missing section framing in source excerpts.** Stripping HTML into a flat string erases the page title and heading hierarchy, and adjacent quote windows can merge across section boundaries. A quotation lifted from a section titled *"Legends and myths"* or *"Disputed attribution"* looks indistinguishable from established biography inside a flat 700-character snippet.
3. **Silent context loss on unnormalized quotes.** Deterministic evidence checking matches quotes after Unicode NFC and whitespace normalization, whereas audit context slicing searches for the raw unnormalized quote string. Quotes that pass mechanical verification through whitespace collapsing silently lose their surrounding context window in the auditor prompt.

## Solution

Add two complementary capabilities to the offline Profile verification subsystem while keeping the published Profile format, Output gate, and fail-closed receipt architecture unchanged:

1. **Heading-aware source excerpts.** Capture the document title and exact character offsets of `h1`–`h6` headings during single-pass HTML extraction, preserve backward compatibility with existing cached snapshots, surface section breadcrumbs when reading excerpts and auditing claims, fix normalized quote lookup in audit context assembly, and prevent context windows from merging across heading boundaries.
2. **Lightweight risk-gated adversarial verification (FIRE + Loki).** Deterministically select at most five high-risk supported findings per Profile—prioritizing Deep Facts, `corroborate`-risk claims, and heuristically escalated quotes, superlatives, or legend cues—and run a budgeted adversarial pass using neutral and falsification search queries against locally fetched sources. Merge any discovered counterevidence into the assessment before the independent auditor runs, keeping the auditor as the single semantic judge of whether the prose adequately qualifies, attributes, or corrects the conflict.

Both execution modes—conversation subagents through the one-shot coordinator CLI and direct provider APIs through `verify`—share the same target selector, prompt, quote verification, and versioned receipt rules.

## User Stories

1. As a reader opening a Profile, I want Deep Facts, quotations, and superlatives to be tested against independent disconfirming sources before publication, so that debunked historical myths do not ship as settled fact.
2. As a reader opening a Profile, I want disputed accounts and legends to remain clearly attributed rather than presented with unearned certainty, so that I can trust what is documented versus apocryphal.
3. As an independent English auditor reviewing a Profile, I want each source excerpt to include the source page title and enclosing section heading breadcrumb, so that I can immediately recognize when a quote comes from a *"Myths"*, *"Legends"*, or *"Controversy"* section.
4. As an independent English auditor, I want quotes from different sections of the same article to stay in separate context blocks rather than merging across heading boundaries, so that section attribution remains accurate for every finding.
5. As an independent English auditor, I want every quote that passed normalized mechanical evidence checking to receive its surrounding 700-character context window, so that minor whitespace or Unicode normalization differences never strip context away.
6. As an independent English auditor, I want independently retrieved counterevidence and short conflict notes attached to high-risk findings, so that I can judge whether the draft prose resolves credible scholarly disagreement.
7. As a Profile writer or repair agent calling the `evidence` command, I want each returned excerpt to include the page title and current section breadcrumb, so that I avoid misreading disputed sections during drafting and repair.
8. As a maintainer running verification at scale across hundreds of Profiles, I want adversarial search to run only on deterministically selected high-risk claims (capped at five per Profile) rather than every biographical sentence, so that verification cost and latency stay bounded.
9. As a maintainer, I want adversarial search to use neutral and falsification queries rather than repeating a claim verbatim, so that web search surfaces scholarly rebuttals instead of pages echoing the same myth.
10. As a maintainer, I want adversarial evidence to come strictly from locally fetched public HTTPS snapshots verified by the same deterministic quote checker as supporting evidence, so that the adversarial step can never fabricate quotes or rely on search snippets.
11. As a maintainer, I want noisy or irrelevant adversarial search hits to never cause brittle mechanical holds on their own, so that the independent auditor remains the sole judge of whether a conflict actually blocks approval.
12. As a maintainer running a repair loop, I want unchanged high-risk claims to reuse their prior adversarial check results across repair rounds, so that fixing one passage does not pay for redundant web searches on untouched passages.
13. As a maintainer running the coordinator subagent workflow without provider API keys, I want a one-shot `english-adversarial` CLI command that prepares a hash-bound task and checkpoints verified replies before `english-audit`, so that subagent runs have full parity with API runs.
14. As a maintainer running the coordinator workflow on a Profile with no high-risk targets, I want `english-adversarial` to emit an explicit `skipped` result, so that the coordinator can proceed straight to `english-audit` without dispatching an unnecessary subagent.
15. As a maintainer running provider API verification (`profiles verify`), I want adversarial checking to run automatically between research and audit with configurable model selection and an opt-out flag for experiments, so that API batches gain the same protection without extra manual commands.
16. As a maintainer comparing historical auditors on saved evidence (`profiles audit`), I want saved snapshots' title and heading metadata passed through to the auditor, so that offline auditor comparisons match live audit inputs.
17. As a maintainer managing already-published Profiles, I want existing cached evidence snapshots without title/heading fields and existing policy version 2–6 approvals to remain valid, so that upgrading the verifier does not invalidate or block previously approved Profiles.
18. As a maintainer auditing verification reports, I want policy version 7 reports to record the adversarial model, queries, outcomes, and fetched counterevidence alongside existing findings, so that every approval decision stays inspectable and reproducible.

## Implementation Decisions

### 1. Heading-Aware Source Snapshots and Context Assembly

- **Snapshot schema extension:** Extend the cached `Source` model with optional `title` (normalized document title) and `headings` (ordered list of `{ level: 1..6, text, offset }` entries recording exact character indices in normalized `source.text`).
- **Backward-compatible snapshot integrity:** Legacy evidence files already on disk were content-hashed without `title` or `headings`. Snapshot parsing must hash only the fields present on the stored record so legacy snapshots continue validating cleanly, while newly fetched snapshots include `title` and `headings` in their content hash.
- **Single-pass offset-accurate HTML extraction:** Replace the two-step fragment-join-then-normalize HTML extractor with a single-pass incremental normalizer that preserves exact whitespace collapsing and NFC normalization while computing accurate character offsets for `h1`–`h6` headings. Ignore hidden elements (`script`, `style`, `noscript`, `svg`, `nav`, `footer`, `header`) and strip Wikipedia `.mw-editsection` spans from heading text.
- **Breadcrumb resolution and excerpt boundaries:** Provide a pure breadcrumb resolver that maps any character offset in `source.text` to the active heading stack (`string[]`).
  - Surface `title` and `section` on `readExcerpt()` responses from the source store.
  - In English audit prompt assembly, locate quotes using normalized quote text (`normalizeText(item.quote)`) instead of raw `item.quote`, compute each match's `section` breadcrumb, and merge overlapping 700-character windows only when they belong to the same section breadcrumb.
  - Emit each audit context entry with optional `title` and structured `excerpts: Array<{ section: string[], text: string }>`.
  - Pass full parsed source snapshots (not only bare `text`) through saved-evidence audit execution.
- **Audit prompt update:** Add brief instructions to the English audit prompt explaining `title`, per-excerpt `section` breadcrumbs, and `adversarial_notes` (bumping its version and hash).

### 2. FIRE Risk-Gated Target Selection

- Implement a deterministic target selector over a parsed Profile and its Assessment that selects only `verdict === 'supported'` findings and skips findings that solely restate subject start/end years already checked against dataset dates.
- Rank candidates in three priority tiers and cap at **5 targets per Profile**:
  1. **Priority 1 (always):** Every supported finding under `deep_facts.*`.
  2. **Priority 2 (always):** Every supported finding marked `risk === 'corroborate'`.
  3. **Priority 3 (heuristic escalation):** Supported `ordinary` findings in `overview`, `key_moments.*`, or `connections.*` containing long quoted speech ($\ge 15$ characters inside quotation marks), superlative/first markers (`first`, `only`, `oldest`, `largest`, `never`, `invented`, `coined`), or attribution/legend cues (`famously`, `allegedly`, `supposedly`, `legend`, `myth`, `apocryphal`).
- Identify each target by a stable `finding_index`, `path`, `claim`, and `claim_hash = hash({ path, claim })` for cross-repair reuse.

### 3. Loki Neutral/Falsification Prompt and Result Contract

- Create a versioned adversarial verification prompt instructing the model to:
  - Decompose claims into neutral entity-aspect queries (never searching a questionable claim verbatim) paired with targeted falsification queries (`myth`, `apocryphal`, `disputed`, `historians`, `earliest source`) where appropriate.
  - Prefer independent hosts outside the writer's already-cited URLs (scholarly encyclopedias, museum/university archives, historiographical reviews, primary editions).
  - Fetch every evidentiary page through the local source-reading tool; treat search snippets and model memory as non-evidence.
  - Stop investigating a target once credible conflicting/limiting evidence is fetched or neutral results confirm consensus.
- Pass only the subject brief, selected targets (`finding_index`, `path`, `claim`, `passage_text`, `existing_counterevidence`), and `cited_urls`—deliberately omitting the writer's persuasive `explanation`.
- Decision-encoding return shape (from architecture design):

```json
{
  "checks": [
    {
      "finding_index": 4,
      "path": "deep_facts.0.text",
      "queries": ["neutral query", "falsification query"],
      "outcome": "no_conflict_found | conflict_found | fetch_blocked",
      "counterevidence": [
        { "source": "<64-hex snapshot id>", "quote": "exact contiguous excerpt", "kind": "primary | scholarly | wikipedia | other", "origin": "author/work" }
      ],
      "note": "concise summary of conflict or consensus"
    }
  ]
}
```

### 4. Merge Semantics, Policy Version 7, and Receipts

- **Single semantic judge:** Merging adversarial results appends validated `counterevidence` items onto matching `assessment.findings[finding_index].counterevidence` (deduplicated by source ID + normalized quote) without mutating `finding.evidence` or `finding.verdict`. Only `conflict_found` and `fetch_blocked` notes are surfaced as `adversarial_notes` to the English auditor.
- **Deterministic checks:** Existing `checkEvidence()` automatically validates all merged `counterevidence` quotes against local cached snapshots.
- **Policy version 7:** Bump `POLICY_VERSION` from `'6'` to `'7'`, keeping versions `'3'`–`'6'` (and `'2'` for closed spans/points) eligible in `isCurrentVerificationPolicy()` so existing published Profiles remain valid.
- **Version 7 report contract:** Add an optional `adversarial: { model: string, checks: AdversarialCheck[] }` field on `Report`. In `blockers()`, when `report.policy_version === '7'` and the target selector returns non-empty targets (and adversarial checking was not explicitly omitted), require every selected `finding_index` to have a matching check in `report.adversarial.checks` and every `conflict_found` check to carry at least one counterevidence excerpt.

### 5. Dual Execution Modes (Coordinator Subagents + Provider API)

- **Coordinator mode (ADR 0030 pattern):**
  - Add a one-shot `english-adversarial --qid=<QID> [--result=<file>]` coordinator command.
  - Without `--result`: load the draft and its pending/saved assessment, run target selection, emit `{ status: "skipped" }` if zero targets exist, or emit `{ prompt, input_hash, targets }` bound to `profileHash(record)` and `hash(assessment)`.
  - With `--result`: verify `input_hash`, validate the reply and its quotes against cached evidence snapshots, and save `meta.pending_adversarial` bound to `profileHash(record)` and `hash(assessment)`.
  - In `english-audit`: automatically read and merge `meta.pending_adversarial` (when its hashes match the current draft and assessment) before constructing the audit prompt and invoking verification, clearing `meta.pending_adversarial` once the verification report is saved (just like `meta.pending_assessment`).
- **Provider API mode:**
  - Add `createAdversarialChecker(model)` using OpenAI Responses (`web_search` + `read_source`) with strict budgets: max 6 turns, max 6 web searches, max 8 source reads, `reasoning: { effort: 'medium' }`.
  - Wire optional adversarial execution into `verifyProfile()` between `research()` and `auditProfile()`, sharing the same `SourceStore` so snapshots are cached and persisted once, and recording the adversarial model in `report.models`.
  - Cache checks by `claim_hash` across repair rounds within a `verifyProfile()` run so unchanged high-risk claims are not re-searched.
  - Expose `--adversarial-model=<id>` and `--no-adversarial` on `verify` through the shared model-routing module.

### 6. Documentation and ADR Upkeep

- Record this verification upgrade in a new data-pipeline ADR (continuing the ADR 0026–0032 sequence) and update the living Profile workflow, coordinator, and verification docs in the same changes that ship each capability.

## Testing Decisions

- **What makes a good test:** Test observable external behavior across module and CLI boundaries—returned excerpts, assembled audit prompts, blocker lists, saved JSON reports/receipts, coordinator CLI JSON emissions, and Output publication eligibility—never internal parser variables or private helper mechanics. All network and model calls remain mocked via injected callbacks and temporary directories.
- **Agreed test seams (existing highest seams, no new test harnesses):**
  1. **Source & excerpt seam:** `extractHtmlDocument` / `htmlText`, `parseSourceSnapshot`, and `SourceStore.readExcerpt` for heading offsets, Wikipedia edit-link stripping, breadcrumb resolution, and legacy snapshot hash compatibility.
  2. **Audit payload seam:** `auditProfile` and `auditSavedProfile` asserting the exact JSON prompt payload (`source_contexts` with `title` and `{ section, text }`, normalized quote matching, cross-section non-merging, and `adversarial_notes`).
  3. **Policy & publication seam:** `selectAdversarialTargets`, `mergeAdversarialResult`, `checkEvidence`, `blockers`, `readProfileApproval`, and `shipProfiles` covering target prioritization/caps, deduplication, v7 completeness rules, and v2–v6 backward compatibility.
  4. **Verification runner seam:** `verifyProfile` with injected `research`, `adversarial`, `complete`, and `sources` covering full API flow, `claim_hash` reuse across repair rounds, fetch failure handling, and report persistence.
  5. **Coordinator CLI seam:** `runCoordinatorCommand` covering `evidence` breadcrumbs and the end-to-end `english-adversarial` $\rightarrow$ `english-audit` $\rightarrow$ `english-repair` round trip, including `skipped` behavior, stale `input_hash` rejection, and `pending_adversarial` cleanup.
- **Prior art:** The existing Node test suite in `packages/data-pipeline/src/profiles/verification/verification.test.ts` already exercises all five seams using `node:test`, `node:assert/strict`, `mkdtemp`, injected `SourceStore`, `verifyProfile`, `auditProfile`, `auditSavedProfile`, `runCoordinatorCommand`, and `shipProfiles`.

## Out of Scope

- Replacing the TypeScript verification pipeline with Python fact-checking frameworks (OpenFactCheck, FIRE, Loki, SAFE) or adding local NLI models (MiniCheck, HHEM).
- Changing the published `Profile` JSON schema in `shared-types`, `output/profiles.ts`, or `packages/web` rendering.
- Re-verifying or invalidating already-published Profiles approved under verification policies 2–6.
- Running adversarial web search on every ordinary biographical claim or on Russian translation fidelity audits.
- Changing Russian translation mechanics, Connection QID deduplication, or MediaWiki retry backoff (separate cleanup items).

## Further Notes

- This spec synthesizes the architecture review and verification design discussion covering heading-aware excerpts, normalized audit context matching, and FIRE/Loki adversarial checking.
- The four implementation tickets in `issues/` are structured as independent vertical slices: tickets `01` and `02` have no blockers and can execute in parallel; tickets `03` and `04` each depend on `01` and `02` and can also execute in parallel.
- Cross-family auditing (for example, Gemini auditing Claude or GPT drafts) requires no new architecture because the model-routing module already supports `--audit-provider` and `--audit-model`; it can be enabled immediately as a runtime configuration choice alongside these tickets.
