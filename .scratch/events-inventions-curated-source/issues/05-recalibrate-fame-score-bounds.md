# 05 — Recalibrate FAME_SCORE_BOUNDS.discoveries

Type: task
Status: resolved
Blocked by: 04

## Question

`packages/web/src/shared/config/viewport.ts`'s `FAME_SCORE_BOUNDS.discoveries` (`min:50, max:386, default:200`) is calibrated to the old 806-item Wikidata-corpus sitelink range. Once ticket "04 — Score/Output: wire enrichment data into the Discoveries pipeline" produces real output with the curated set's actual (post-enrichment) sitelink distribution, recompute `min`/`max`/`default` from that real data — same approach used when the original bounds were derived (direct local JSON read, per the `sidebar-filters-legend` map's pattern).

Sanity-check the chosen `default` doesn't silently hide a large fraction of the 121 (now fewer, post-enrichment-drop) curated events — the whole point of curation was to surface hand-vetted significant events, so an overly aggressive default floor would undercut that.

## Answer

Re-ran the full curated + enrichment fetch against live Wikidata (all 121 QIDs resolved, 0 drops at Output) and read the real published `discoveries.json` sitelink range directly: min 8 (Q13443401 "Invention of telephone"), max 296 (tied: Internet, Computer), median 69. Set `FAME_SCORE_BOUNDS.discoveries = { min: 8, max: 296, default: 25 }` — `default: 25` keeps 119/121 (98%) visible on first paint (only items below the 10th percentile hidden), deliberately light-touch per this ticket's sanity-check.
