# Profile verification

Run `npm run profiles --workspace packages/data-pipeline -- verify --qids=Q935,Q635 --repair`. Default API execution requires `OPENAI_API_KEY`, uses OpenAI web search, and makes paid model calls. `--model` selects the researcher; `--audit-model` selects the separate audit/repair calls (defaults to the researcher). Alternatively, `--execution=session --session-dir=<absolute directory>` uses [conversation subagents](profile-sessions.md) for research, audit and repair, with the same fetched-evidence and approval rules. Omit `--repair` to check and approve without changing prose. `--force` rechecks a current approval. Run one batch at a time.

## Approval policy

- Extract claims from every visible field, including overview, dates, titles and Connection explanations; the writer's claims are only hints. A second call audits coverage, evidence, neutrality and narrative substance.
- Supporting excerpts must occur in locally fetched public HTTPS HTML/plain-text sources. Reports retain excerpts, URLs and content hashes; full snapshots live in gitignored `data/raw/profiles/evidence/`. Sources are cached within a Profile run. PDFs and login-only pages require a readable alternative.
- Every remaining claim must be `supported`. `contradicted`, `unverifiable`, `disputed`, uncovered details and failed mechanical checks block approval. Obscure anecdotes, quotations, firsts/superlatives, disputed figures and living-person allegations require two independent original accounts on distinct hosts, including primary or scholarly support. Confidence never grants approval. Clearly attributed legends verify the existence of the account.
- Mechanical checks cover schema/markup, subject and Connection QIDs, reversed year labels, historical year zero, and verifier-extracted birth/death or event start/end years against dataset dates. Approximate dataset dates allow one year of tolerance. Other dates and calendar distinctions are evidence/audit checks. Public passage citations must point to fetched supporting pages, with valid section anchors.
- A receipt binds the current policy, content, identity, locale and report hashes. Output withholds absent, malformed, stale or failing approvals. Output also compares the report’s subject dates with the current dataset; changed dates require verification again before publishing. Editing any content requires verification again; `edited` protects prose but does not bypass approval. Bump `POLICY_VERSION` whenever approval rules or verifier instructions change.

## Repair and review

`--repair` permits at most two changes followed by full verification. Correct or qualify from evidence; remove unsupported optional Deep Facts/Connections. Preserve identity and substantive core history. Prior attempts are saved under `verification-history/`. Protected `edited` records receive a candidate in `proposals/`; applying a proposal is a human decision, followed by verification.

Each `<profile>.verification.json` contains the exact claims, evidence, corrections, blockers and model IDs. CLI outcomes are `approved`, `skipped`, `held` or `retry`; infrastructure/model errors are `failed`. Any held/retry/failed item makes the batch exit nonzero without stopping other QIDs. Retry fetch failures before treating a claim as unresolvable; fetching failure alone never justifies removing content.

Humans handle essential factual/framing disagreements and protected-edit proposals. Initially audit a small selection of approvals across all three lanes, including repaired Profiles and corroborated claims; expand audits when a failure appears. Automatic approval is fallible, so use audit failures to improve fixtures and policy. Held Profiles keep the existing Description fallback.
