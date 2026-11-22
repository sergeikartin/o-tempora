---
status: accepted
---

# Profile approval owns receipt and date freshness

Verification, translation and Output shared receipt validation but each implemented its own current-date comparison. Date freshness is part of the same eligibility decision as receipt integrity, review status and passage coverage.

The Profile approval module validates the saved receipt and checks its freshness against the current dataset dates. Output can validate a receipt before joining the subject and check freshness after the join. Each caller owns its response to the result. Saved-evidence audits can still inspect held reports. Receipt format and policy-version compatibility follow ADR 0027.
