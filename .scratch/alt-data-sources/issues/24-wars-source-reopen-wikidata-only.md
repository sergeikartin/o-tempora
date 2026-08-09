Type: grilling
Status: resolved

## Question

The CDB90 hybrid prototype (`prototype/cdb90-wars` branch, commit `79b3eed`) rendered CDB90-sourced war-level timebars for sanity-checking. Verdict was due before the branch could be discarded (see the prototype commit message). Given that verdict, does Wars & Conflicts stay on the CDB90 hybrid plan (tickets [02](02-wars-source-cdb90-hybrid.md)/[06](06-research-cdb90-war-ranges.md)/[09](09-cdb90-war-range-derivation.md)/[16](16-cdb90-fame-score-source.md)/[21](21-wars-cdb90-hybrid.md)), or does it revert to full Wikidata sourcing?

## Context

Reopens [Wars source: CDB90 hybrid](02-wars-source-cdb90-hybrid.md), which this ticket supersedes. Surfaced via `/grilling` + `/domain-modeling`, per `map.md`'s own note that follow-on decisions the research surfaces should go through those skills.

## Answer

**Full reversal, not a partial hybrid.** Wars & Conflicts goes back to 100% Wikidata-sourced, full history, no 1600-1973 carve-out. CDB90 is dropped entirely — not kept even as supplemental enrichment (e.g. its DBpedia/Correlates-of-War crosswalk).

**Root cause**: the prototype's war-level ranges looked wrong when rendered — a date/range-quality problem, not a coverage or rendering-approach problem. CDB90 has no native war-level date field; both derivation paths considered (`battle_durations.csv` min/max, and the later `war4`-string regex parse) are *derived* approximations, and the derived ranges didn't hold up visually. Wikidata's existing `historical-events.ts` query, by contrast, pulls `P580`/`P585`/`P582` — first-class start/end-date *properties* Wikidata editors attach directly to war entities — not a derived approximation. That's a structural reason to prefer it, not just a fallback.

**Coverage was never actually the gap.** `historical-events.ts`'s existing `EVENT_TYPES` list already covers war, battle, treaty, siege, revolution, rebellion, military operation, and generic historical event, gated by `MIN_SITELINKS` (the same fame-tier mechanism as the rest of the app). Reverting to Wikidata does not require redesigning *what* gets fetched. What's actually missing is that this query has never successfully completed and published a live `wars.json` — `CLAUDE-activeContext.md` confirms Wars & Conflicts' raw Wikidata snapshot is unchanged since the Fame Tier Redesign and remains unpublished.

**Supersedes, in full**: [02 — Wars source: CDB90 hybrid](02-wars-source-cdb90-hybrid.md), [06 — CDB90 war-range research](06-research-cdb90-war-ranges.md) (and its writeup, `research/cdb90-war-ranges.md`), [09 — CDB90 war-range derivation](09-cdb90-war-range-derivation.md), [16 — CDB90 fame-score source](16-cdb90-fame-score-source.md), and the implementation ticket [21 — Wars: CDB90 hybrid integration](21-wars-cdb90-hybrid.md) (never implemented — no code exists that needs unwinding; the 1600-1973 Wikidata-query exclusion its checklist called for was never written).

**Scope boundary**: this decision and its follow-on ticket ([25 — Wars: Wikidata reliability fixes](25-wars-wikidata-reliability.md)) stay inside `packages/data-pipeline`. The frontend fame-tier selector (Unit 9, `CLAUDE-activeContext.md`) remains separately tracked and untouched — the pipeline already supports fame-gating (`MIN_SITELINKS`, three nested tiers); exposing a UI switch for it is out of scope here.

**Disposition of the prototype**: `prototype/cdb90-wars` deleted — it was explicitly a throwaway spike per the `/prototype` skill's own convention, and its verdict is now recorded here instead.
