# Profile verification

Run `npm run profiles --workspace packages/data-pipeline -- verify --qids=Q935,Q635 --repair`. This command requires `OPENAI_API_KEY`, uses OpenAI web search, and makes paid model calls. `--model` selects the researcher; `--audit-model` selects the separate audit/repair calls (defaults to the researcher). The [Profile coordinator](profile-coordinator.md) can run those checks with subagent results through `english-audit` and `english-repair`. Omit `--repair` to check and approve without changing prose. `--force` rechecks a current approval. Run one batch at a time.

For a Gemini historical auditor, add `--audit-provider=gemini --audit-model=gemini-3.8-flash` and set `GEMINI_API_KEY`. Research, repair and Russian translation audit use OpenAI with `--model`. The Russian translator can still be selected with `--translation-model`. Provider flags apply in API mode.

## Compare auditors on saved evidence

Run both commands on the same QIDs to compare fresh audits without new research or changes to Profiles, reports or approvals:

```sh
npm run profiles --workspace packages/data-pipeline -- audit --qids=Q635,Q362,Q12138 --provider=gemini --model=gemini-3.8-flash
npm run profiles --workspace packages/data-pipeline -- audit --qids=Q635,Q362,Q12138 --provider=openai --model=gpt-6.2-sol
```

Each result includes the original audit, the new audit, and reported token usage. The command needs a current verification report and its local evidence snapshots. Inspect disagreements against the excerpts, especially missed claims, misleading quotes and sources that share an origin. Include held Profiles with available evidence when testing false approvals.

## Approval policy

- Extract claims in passage order from every visible field, including overview, dates, titles and Connection explanations. Read each Key Moment's three fields together for implied claims. In the coordinator workflow the writer supplies findings with each passage. In API mode the researcher extracts findings from existing prose. An independent auditor checks each passage against the evidence and then checks the full narrative for chronology, contradictions, repetition and balance.
- Supporting excerpts must occur in locally fetched public HTTPS HTML/plain-text sources. Research reads bounded excerpts by phrase or offset. The audit receives the Profile once and each finding once, with short numeric references to shared source excerpts. Quote and anchor checks use the full cached sources. Reports retain excerpts, URLs and content hashes, and full snapshots live in gitignored `data/raw/profiles/evidence/`. PDFs and login-only pages require a readable alternative.
- A finding's optional `counterevidence` carries exact excerpts from credible fetched accounts that materially conflict with or limit the claim or its supporting account. The audit checks those excerpts in context and verifies that any attribution or qualification resolves the conflict. Only supporting evidence can establish corroboration or support a displayed passage citation.
- Every remaining claim must be `supported`. `contradicted`, `unverifiable`, `disputed`, uncovered details and failed mechanical checks block approval. Obscure anecdotes, quotations, firsts/superlatives, disputed figures and living-person allegations require two independent original accounts on distinct hosts, including primary or scholarly support. Confidence never grants approval. Clearly attributed legends verify the existence of the account.
- Mechanical checks cover schema/markup, subject and Connection QIDs, reversed year labels, historical year zero, and verifier-extracted birth/death or event start/end years against structured dataset dates. Ongoing subjects have a known start and an open end. Approximate dataset dates allow one year of tolerance. Other dates and calendar distinctions are evidence/audit checks. Public passage citations must point to fetched supporting pages, with valid section anchors.
- A receipt binds the policy, content, identity, locale and report hashes. Output withholds absent, malformed, stale or failing approvals. Changed dataset dates or edited content require re-verification before publishing. The `edited` status protects prose and still requires approval. Current and version 3 through 5 approvals remain eligible under the same checks. Policy 3 added a start-year check for ongoing subjects, so their version 2 reports require re-verification. Version 2 reports for closed spans and point dates are still eligible. Bump `POLICY_VERSION` whenever approval rules or verifier instructions change. [Date and passage handling](adr/0027-profiles-share-subject-dates-and-passages.md)

## Repair and review

`--repair` permits at most two changes followed by full verification. Correct or qualify from evidence; remove unsupported optional Deep Facts/Connections. Preserve identity and substantive core history. Prior attempts are saved under `verification-history/`. Protected `edited` records receive a candidate in `proposals/`; applying a proposal is a human decision, followed by verification.

The coordinator can also retry with stronger evidence while preserving the exact draft and its remaining repair rounds. It sends the resulting draft and assessment to a fresh auditor.

Each `<profile>.verification.json` contains the exact claims, evidence, corrections, blockers and model IDs. CLI outcomes are `approved`, `skipped`, `held` or `retry`; infrastructure/model errors are `failed`. Any held/retry/failed item makes the batch exit nonzero without stopping other QIDs. Retry fetch failures before treating a claim as unresolvable; fetching failure alone never justifies removing content.

Humans handle essential factual/framing disagreements and protected-edit proposals. Initially audit a small selection of approvals across all three lanes, including repaired Profiles and corroborated claims; expand audits when a failure appears. Automatic approval is fallible, so use audit failures to improve fixtures and policy. Held Profiles keep the existing Description fallback.

`--translation-model` can select a separate API translator. The translator and translation audit default to `--audit-model` for OpenAI historical audits or `--model` for other historical audit providers. After English approval (including a skipped current approval), the command runs [Russian translation and fidelity audit](profile-translation.md). Translation failure leaves English approval intact, exits nonzero and prevents unapproved Russian publication. Historical verification policy remains separate from the translation policy.
