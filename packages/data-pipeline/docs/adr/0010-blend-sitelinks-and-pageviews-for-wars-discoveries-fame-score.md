---
status: accepted
---

# Blend Wikidata sitelinks with Wikimedia pageviews for Wars & Discoveries' fame score

Wars & Discoveries' `fameScore` was raw sitelink count — a single signal, unlogged, unblended, per `rankBySitelinks`'s explicit "never blended" design comment. Pageviews capture sustained real-reader interest that sitelink count alone can miss, so we're blending them: `fameScore = round(0.60 * S_sitelinks + 0.40 * S_pageviews)`, where each component is log-normalized to 0–100 and clamped. This only concerns Wars & Discoveries — People's Pantheon HPI is untouched, and "never blend across lanes" still holds; only "never blend within a lane" is being overridden, and only for these two.

## Considered options

- **Per-lane benchmarks** (Wars and Discoveries normalized against separate `sitelinks_max`/`pageviews_max`) — rejected. Real data shows near-identical sitelinks distributions (Wars: min 2, max 292, median 69, n=154; Discoveries: min 8, max 296, median 69, n=121), so separate scales would add complexity without a real underlying difference. Wars and Discoveries now share one benchmark, making a war's and an invention's score directly comparable.
- **Configurable weights/benchmarks** (env var or config file) — rejected in favor of hardcoded constants in `score.ts`, matching the existing `FAME_TIER_MIN_HPI` pattern. Changing them requires a full pipeline re-run and re-publish regardless, so runtime configurability adds no value.
- **Pageviews summed across every language an entity has a sitelink for** — rejected; cost scales with sitelinks count (up to ~300 calls for a top entity) and would largely re-derive sitelinks itself. Using a fixed 7-language basket (en/zh/es/fr/de/ar/ru) instead bounds the cost while still meaningfully countering English-only bias.
- **Dropping rows on pageviews-fetch failure**, mirroring the existing sitelinks-failure gate — rejected. Sitelinks failing means Wikidata doesn't know the entity; pageviews failing is more likely a transient API issue on a secondary signal, and dropping a hand-vetted curated entity over that would contradict the existing principle (ADR 0008/0009) that the curated list is the sole inclusion gate. Pageviews-fetch failure degrades to a 0 contribution instead.

## Formula

```
fameScore = round(0.60 * S_sitelinks + 0.40 * S_pageviews)
S_sitelinks = min(100, 100 * ln(1 + sitelinks) / ln(1 + 350))
S_pageviews = min(100, 100 * ln(1 + pageviews) / ln(1 + 200_000_000))
```

`pageviews` is the sum of per-article monthly Wikimedia pageviews across a fixed 7-language basket (en/zh/es/fr/de/ar/ru), over the trailing 4 full calendar years, via the Pageviews REST API per-article endpoint. Missing/redirected titles in a given language contribute 0 for that language — best-effort, no redirect-resolution logic.

## Benchmark derivation

`sitelinks_max = 350` is the real curated-list max (296, "Internet"/"Computer") plus headroom. `pageviews_max = 200,000,000` came from a live pilot: real Wikidata sitelinks + real Wikimedia pageviews (same 7-language basket, same 4-year window) fetched for 18 entities spanning the full sitelinks range of both lanes; World War II's 143,235,719 four-year total was the observed ceiling, so 200,000,000 was chosen as headroom above it. The pilot's before/after ranking showed movement of only ±1 to ±4 positions across the 18-item sample, with every shift explainable (e.g. WWI/WWII rising past Internet/Computer on sustained real readership outpacing near-max sitelink counts) — accepted as sufficient validation without running the full 275-entity curated set through the same comparison.

## Consequences

- `fameScore`'s meaning now differs by lane in a way it didn't structurally before: People stays raw HPI; Wars/Discoveries becomes a two-signal blend. The field itself (`TimelineEntry.fameScore`) is unchanged — only its computation for two of the three lanes.
- `FAME_SCORE_BOUNDS` for wars/discoveries in `packages/web/src/shared/config/viewport.ts` moves from lane-specific raw-count ranges (wars 70–193, discoveries 8–296) to one shared 1–100 range with default 75 — a provisional starting point to be manually re-tuned once real scores are visible in the running app, not a precisely re-derived value.
- The exact constants (350, 200,000,000, 0.60, 0.40) belong as inline comments in `score.ts` alongside the existing `FAME_TIER_MIN_HPI` derivation comment when implemented — not in `docs/config-variables.md`, which is scoped to runtime-tunable config; these are fixed pipeline constants that require a code change and a pipeline re-run to alter.
- Does not touch People/HPI scoring, and does not change what `fameScore` is allowed to drive downstream — still only the manual UI filter floor (`packages/web/docs/adr/0003-manual-fame-filter-replaces-zoom-tier.md`), not zoom-tier gating, marker size, or z-order.
