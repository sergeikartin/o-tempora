# 02 — Detail Level switch: chunked loading + UI

**What to build:** The full user-visible Detail Level feature, wired end to end against the 4 delta files from ticket 01. A user can select any of 4 levels via a segmented control; the right data is fetched (eagerly, prefetched, or on demand depending on level) and rendered; the control shows the selected level's name and description. See `.scratch/detail-level-tiers/spec.md` for the full loading policy and UI copy.

**Loading policy:**
- Level 1 + level 2 delta files load eagerly, gating first paint — same cost as today's eager load.
- Level 3's delta file idle-prefetches in the background once first paint completes.
- Level 4's delta file fetches strictly on demand, only once a user actually selects level 4.
- Once fetched, a level's data stays in memory for the rest of the session even if the user dials back to a shallower level — never re-fetched, never evicted.

**UI:**
- The existing 2-position segmented control becomes 4-position, one stop per level, each labeled with the level's name directly (`Legendary`/`Mainstream`/`Specialized`/`Deep Cut`).
- The selected level's one-line description renders as helper text below the control, updating live as selection changes.
- Default selection on first load is level 2 (`Mainstream`), matching today's default.

Also update any living documentation that still describes the old two-file Payload Tier loading scheme (network-loading framing referencing "Tier 0"/"Tier 1"), so it reflects the 4-level scheme instead.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Selecting any of the 4 levels renders the correct entity set for all three lanes
- [ ] Network panel confirms: level 1+2 chunks present in the initial load; level 3 chunk requested shortly after (idle), before the user touches the control; level 4 chunk is not requested until the user selects level 4
- [ ] Switching between already-visited levels (e.g. 4 → 2 → 4) does not re-fetch previously loaded chunks
- [ ] Control shows all 4 names as labels; helper text below shows the matching description and updates immediately on selection
- [ ] First paint timing/byte cost with the default level-2 selection is unchanged from today's Mainstream load
- [ ] Living docs describing the old `tier0`/`tier1` loading split are updated to describe the 4-level scheme
