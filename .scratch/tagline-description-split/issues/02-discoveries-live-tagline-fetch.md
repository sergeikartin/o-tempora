# 02 — Discoveries: live-fetch `tagline` instead of curated text

**What to build:** Events & Inventions (Discoveries) currently ships a hand-curated, never-refetched tagline. Change it to be live-fetched from Wikidata for every curated entity, the same mechanism People and Wars already use — with no fallback to the old curated text. This brings all three lanes onto one consistent sourcing model for `tagline`, at the cost of a real behavior change: an entity whose live lookup fails to resolve a tagline is now dropped from the published output, something that could never happen for Discoveries before.

**Blocked by:** 01 — Rename `description` → `tagline` everywhere

**Status:** ready-for-agent

- [ ] Discoveries' `tagline` is sourced from a live per-entity Wikidata lookup, not from the hand-curated text in the curated source list.
- [ ] An entity whose live lookup can't resolve a tagline is dropped from the published Discoveries output — no fallback to the curated text, matching how People/Wars already behave when their live fetch fails.
- [ ] The previously hand-curated tagline text remains untouched on disk in the curated source file — it's simply no longer read by the pipeline, not deleted.
- [ ] Tests cover both the "live value wins" case and the "no live value resolved → entity dropped" case for Discoveries.
