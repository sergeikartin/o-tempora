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

[Plan output](2026-11-15-plan.txt) lists exactly the 30 selected entities as skipped stale records, with no regeneration. The remaining 25 have not received historical source audits in this batch. Automatic verification, approval calibration, corrections and publication remain outstanding under [ticket 12](../issues/12-generate-and-review-the-30.md).

Follow-up (2026-11-17): Gregorian calendar has been corrected, automatically verified, independently audited and published. Its [audit note](2026-11-15-gregorian-calendar.md#follow-up--2026-11-17) records the completed follow-up; the table above describes the original 2026-11-15 findings.

Follow-up (2026-11-17): Isaac Newton has been corrected, automatically verified, independently audited and published. The [completed follow-up](2026-11-17-newton-follow-up.md) records the evidence and dataset date correction; the table above describes the original findings.
