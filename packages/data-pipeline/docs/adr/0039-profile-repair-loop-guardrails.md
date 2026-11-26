---
status: accepted
---

# Profile repair loop guardrails and policy 9

English audits kept holding Profiles that were already accurate, and repairs used up their two draft rounds without converging. Julius Caesar (Q1048) was held after one repair on blockers demanding more ancient variants and named modern scholars for passages that already attributed their claims. Other holds and wasted work came from mechanics rather than content: a citation that named the URL the writer requested failed because the snapshot records the post-redirect URL; `finalize` silently dropped Connections to non-dataset entities after the writer had finished; prefetch truncated the manifest at 24 URLs in list order, so dispute URLs, listed last, were cut first; and Russian checks rejected idiomatic Roman-numeral centuries and bold spans that split to fit Russian word order.

Under policy 9:

- The English audit prompt treats a disagreement as handled once a passage attributes the contested detail or notes scholarly doubt. It blocks for further variants or named scholars only when the omission makes the passage false or misleading, and prefers cutting an optional detail to adding another caveat.
- Citation checks accept a snapshot by its requested URL as well as its final URL, using the evidence cache’s URL index. `validate` and `english-audit` apply the same rule.
- `validate` emits non-blocking `warnings` for Connections whose URL is not a dataset entity’s article, or is the subject’s own. Redirects cannot be followed offline, so these stay warnings rather than issues.
- Explicit prefetch keeps up to six of its 24 URLs for dispute sources, paired Deep Fact disputes first.
- Russian numeric checks also accept the values when standalone Latin Roman numerals (other than a lone “I”) are read as numbers. Bold checks require only that a field with emphasis keeps some emphasis. The fidelity audit judges which words are bold. The translation policy version is unchanged because these checks only accept more translations.

Receipts from policy 8 remain valid; publication does not re-run audit-time rules ([ADR-0037](0037-profiles-separate-audit-rules-from-publish-receipts.md)).
