Type: grilling
Status: superseded by [24 — Wars source: reopened, Wikidata-only](24-wars-source-reopen-wikidata-only.md)

## Question

CDB90 has no native war-level date field (confirmed by research — see [CDB90 war-range research](../issues/06-research-cdb90-war-ranges.md)). Two things need deciding for the Wars-lane range-bar derivation:

1. **Grouping key**: derive war groups from the free-text `war` field (65 distinct wars, better coverage) or `cow_warno` (Correlates of War number, only populated for 33 of the 65 wars, but a cleaner canonical ID)?
2. **Single-battle-war fallback**: 17 of 65 wars (by `war` grouping) have only one battle, so min/max-date derivation degenerates to a zero-width point. Render these as a point event instead of a range bar, or pad the single date by a fixed duration to still show a range?

Also worth deciding: whether it's acceptable that derived ranges systematically undershoot the true historical war span (CDB90 only captures major-battle dates, not declaration/armistice dates — e.g. Thirty Years' War derives to 1620-1648 vs. the actual 1618-1648), or whether that's a data-quality tradeoff worth flagging/mitigating somehow.

## Context

Blocks: any implementation of the Wars-lane CDB90 hybrid — see [Wars source: CDB90 hybrid](../issues/02-wars-source-cdb90-hybrid.md).

## Answer

Both original sub-questions (grouping key, single-battle-war fallback) turned out to be moot. Direct inspection of the actual `battles.csv` (not just its schema doc) found that the `war4` column — described only as "new war classification... names are in the style of COW wars" — embeds a `War Name of START-END` (or `War Name of YEAR`) pattern in its string values, e.g. `"Franco-Prussian War of 1870-1871"`, `"Changkufeng War of 1938"`. Populated for all 660 rows, 64 distinct wars, one regex parse away from a clean war-level date range. Spot-checked against known history: `"Thirty Years' War of 1618-1648"` and `"Franco-Dutch War of 1672-1678"` both match true historical spans exactly — noticeably better than the `battle_durations.csv` min/max derivation approach from the original research, which undershot both (1620-1648 and 1674-1675 respectively).

**Decision: use `war4`'s embedded date range directly (regex-parsed), not battle-date derivation.** This resolves the grouping-key question (war4 groups and dates in one field) and the single-battle-war fallback (a one-year war just naturally parses to a single-year range) in one move. One known data-quality issue to handle: `"World War II of 1939-194"` has a truncated end-year (missing the final digit, should be 1945) — needs a hardcoded fix or a defensive parse. The `battles.csv`/`battle_durations.csv` join approach from the original research is kept as a documented fallback only, not the primary path.

This also means [CDB90 war-range research](../issues/06-research-cdb90-war-ranges.md)'s "no war-level dates anywhere in CDB90" conclusion was wrong — see the correction appended there.
