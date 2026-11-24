# Profile manual reviews

On 2026-11-15, five of the 30 draft Profiles received manual source audits at the user's request. All five need corrections or further evidence. No raw prose, review metadata, automatic verification reports or publication receipts were changed. These notes distinguish supported claims, factual problems, disputed interpretations and evidence gaps; they do not grant publication approval.

| Profile | Main findings | Audit |
|---|---|---|
| Isaac Newton | Guinea valuation was imposed by royal proclamation after Newton's advice; continuous gold-standard history and writing/publication claims need correction. Dataset death-year convention also needs investigation. | [Newton](2026-11-15-newton.md) |
| Cleopatra | Overcertain ancestry, disputed private ownership of Roman Egypt, missing pearl-story citation and a translation discrepancy. | [Cleopatra](2026-11-15-cleopatra.md) |
| World War II | Molotov/Ribbentrop signed the pact; carrier continuity is misleading; atomic-bomb causation needs qualification; Enigma and Stalingrad wording needs precision. | [World War II](2026-11-15-world-war-ii.md) |
| Gregorian calendar | Cervantes's death and burial dates are confused; forbidden italics; unresolved calendar anecdotes and date distinctions. | [Gregorian calendar](2026-11-15-gregorian-calendar.md) |
| Founding of the Roman Empire | Actium prematurely ends the war; unsupported superlatives and disputed constitutional detail; dataset 28 BC versus conventional 27 BC requires reconciliation. | [Roman Empire](2026-11-15-roman-empire.md) |

The audits inspected all 128 visible passage fields across those five Profiles, including 48 Connection explanations. Each report records the exact input-file SHA-256; proposed corrections have not been applied. Source retrieval failures remain evidence gaps, not factual verdicts.

[Offline preflight](2026-11-15-preflight.json) also confirms that the full sample contains exactly 20 People, 4 Conflicts and 6 Milestones, all at Legendary, and all 281 stored Connection targets occur in the published dataset. Stored membership does not establish live Wikipedia URL/QID identity. The selected five pass schema/identity/locale/year-label checks; the calendar draft fails the bold-only markup rule.

[November 15 plan output](2026-11-15-plan.txt) lists exactly the 30 selected entities as skipped stale records. The five audits above cover that day's review. See [ticket 12](../issues/12-generate-and-review-the-30.md) for current verification and publication progress.

Follow-up (2026-11-17): Gregorian calendar has been corrected, automatically verified, independently audited and published. Its [audit note](2026-11-15-gregorian-calendar.md#follow-up--2026-11-17) records the completed follow-up; the table above describes the original 2026-11-15 findings.

Follow-up (2026-11-17): Isaac Newton has been corrected, automatically verified, independently audited and published. The [completed follow-up](2026-11-17-newton-follow-up.md) records the evidence and dataset date correction; the table above describes the original findings.

Follow-up (2026-11-19): Revised the two remaining audited drafts, World War II and Founding of the Roman Empire. The World War II draft now distinguishes the pact signatories, the two stages of the Stalingrad surrender, and the sequence of events before Japan's surrender. The Roman Empire draft separates Actium from the conquest of Egypt and attributes the disputed account of Augustus's provincial authority. Its timeline point now uses astronomical year −26 (27 BC) in both locales, following the [Met's chronology](https://www.metmuseum.org/essays/augustan-rule-27-b-c-14-a-d). The original audit notes describe the pre-edit versions.

The Roman Empire Profile is published in English and Russian. The [English verification report](../../../packages/data-pipeline/data/raw/profiles/milestones/Q2277-founding-of-the-roman-empire.en.verification.json) covers 54 claims from 12 fetched sources with no blockers. The Russian translation passed a separate audit of all 25 fields.

The World War II Profile is published in English and Russian. The [English verification report](../../../packages/data-pipeline/data/raw/profiles/conflicts/Q362-world-war-ii.en.verification.json) covers 76 claims from 24 fetched sources with no blockers. The Russian translation passed a separate audit of all 31 fields.
