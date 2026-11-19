# Generate and review the 30

Type: task (human-in-the-loop)
Status: open
Blocked by: 11

## What to build

Produce the first batch: the 30 entities in `06-sample-selection.md` (20 People, 4 Conflicts, 6 Milestones in five Legendary clusters). English originals, automatically translated into Russian after approval.

- [x] The `profiles` script's plan lists exactly the 30 entities.
- [x] A `profile-writer` run per entity writes a draft Profile.
- [ ] `profiles verify --repair` checks each Profile and writes an evidence-backed report beside it.
- [ ] Audit a varied sample of automatic approvals; resolve essential held claims and protected-edit proposals, then reverify changed content before publishing.
- [x] Every Connection target the cluster relies on exists in the dataset, so hops can be judged.

## Comments

Tracker reconciliation (2026-11-15): `6f9d9b9` committed the sample: 20 People, 4 Conflicts and 6 Milestones. All 30 files still have `meta.review.status: draft`; there are no `*.verification.json` reports and no shipped Profile JSON files. Generation is complete; verification and owner review/promotion are outstanding. The exact-sample plan and cluster Connection checks above still need their acceptance evidence. Do not rerun writing or promote drafts as part of tracker cleanup.

## Comments

Review automation is implemented by ticket 08 / pipeline ADR 0023. The live batch and human calibration audit remain pending; old review statuses alone cannot publish.

2026-11-15: At the user's request, manually audited five Profiles without API credentials: Newton, Cleopatra, World War II, Gregorian calendar and Founding of the Roman Empire. All five need corrections or further evidence; no raw prose or approval metadata changed. [Audit index](../reviews/README.md) links per-passage findings, source evidence and proposed wording. These are manual notes, not `*.verification.json` reports or audits of automatic approvals, so the automated verification and approval-calibration boxes remain open. The other 25 await historical review.

Acceptance evidence: [plan output](../reviews/2026-11-15-plan.txt) lists exactly the selected 30 as stale skips, without regeneration. [Offline preflight](../reviews/2026-11-15-preflight.json) matches the exact 20/4/6 sample, confirms every sample subject is Legendary and all 281 Connection QIDs occur in the published dataset. Live URL/QID identity and UI hopping remain separate checks.

2026-11-17: Completed Gregorian calendar (Q12138). Applied evidence-backed factual/framing corrections, repaired markup and citations, retained three Deep Facts with corroboration or explicit attribution, and removed the unsupported Teresa burial sequence/Connection. Session verification checked 57 claims across 22 passages against 19 fetched sources; the independent final audit and mechanical checks passed with no blockers. One automatic repair narrowed the Hogarth attribution, followed by full reverification. The hash-bound report and approval are saved beside the raw Profile; build and publish succeeded. Published English and Russian-fallback files contain four Key Moments, three Deep Facts and six Connections; both milestone rows carry `hasProfile: true`. The batch-wide acceptance boxes remain open.

2026-11-17: Completed Isaac Newton (Q935). Corrected factual/framing issues and citations; a fresh session verification checked 61 claims across 25 passages with 20 fetched sources. The separate audit and mechanical checks passed without blockers or further automatic repairs. A guarded, evidenced Transform correction normalizes the mixed-calendar Pantheon dates to January 1643–March 1727 for both locales and Profile inputs (pipeline ADR 0025), preserving the raw snapshot. Build and publish succeeded; both locale rows carry `hasProfile: true`, and the English/Russian-fallback files retain four Key Moments, three Deep Facts and nine Connections. Pipeline tests/typecheck passed; lint passed with 13 existing warnings. [Follow-up evidence](../reviews/2026-11-17-newton-follow-up.md). Three of the 30 Profiles are now approved/published; batch acceptance remains open.

2026-11-17: [Automatic Russian translation](18-automatic-russian-translation.md) replaces English Profile copies in Russian output. Cleopatra, Gregorian calendar and Newton now have approved Russian translations; future English approvals trigger translation and a separate fidelity audit automatically. The English historical-review batch remains open.

2026-11-19: Completed Founding of the Roman Empire (Q2277). Corrected the milestone year to 27 BC in both dataset locales and revised the Profile against the [manual audit](../reviews/2026-11-15-roman-empire.md). Verification and independent review passed for 54 claims across 25 passages with 12 fetched sources. The Russian translation passed a separate 25-field audit. Both locale outputs contain four Key Moments, three Deep Facts and nine Connections. The batch acceptance boxes remain open.

2026-11-19: Completed World War II (Q362). Applied the [manual audit](../reviews/2026-11-15-world-war-ii.md), fixed additional chronology and attribution issues, and obtained independent corroboration for the Enigma and Onoda Deep Facts. Verification and independent review passed for 76 claims across 31 passages with 24 fetched sources. The Russian translation passed a separate 31-field audit. Both locale outputs contain four Key Moments, three Deep Facts and fifteen Connections. All five manually audited Profiles are now published in both locales. The other 25 remain in the batch.
