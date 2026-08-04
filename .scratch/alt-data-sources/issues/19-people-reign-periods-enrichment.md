# 19 — People: reign-period secondary enrichment

**What to build:** Ruler/office-holder reign-period overlays keep working after the People switch to Pantheon, sourced via a secondary Wikidata lookup keyed on the Wikidata Q-ID Pantheon retains per person.

**Blocked by:** 17 — People: switch to Pantheon (needs the downloaded Pantheon raw rows and their `wd_id` values to exist).

**Status:** ready-for-agent

- [ ] The existing batched Q-ID reigns query runs against the list of `wd_id` values from the downloaded Pantheon raw rows, not a primary Wikidata people scan.
- [ ] Regenerating `people.json` still populates `reignPeriods` for known rulers/office-holders (spot-checked against a few known monarchs).
- [ ] No structural change to the existing reigns query/batching mechanism itself — only its input Q-ID source changes.
