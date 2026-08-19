Type: grilling
Status: resolved

## Question

Pantheon's `bplace_country`/`dplace_country` fields are free-text, gazetteer-style present-day country names (233 distinct values) — and, per Pantheon's own FAQ, they reflect **present-day geographic location, not historical nationality** (e.g. someone born in what's now Germany in a year it was Prussia, France, or the HRE shows `bplace_country=Germany`) — see [Pantheon schema research](../issues/05-research-pantheon-schema.md). This app's existing `Region` enum has 6 values (`europe, east-asia, south-asia, middle-east, africa, americas`, `packages/shared-types/src/index.ts:19-26`).

How should the 233 country values map onto `Region`, and is the present-day-location-not-historical-nationality tradeoff acceptable for this app's region filter, or does it need flagging/mitigating somehow (e.g. in the tooltip, in documentation)?

## Context

Blocks: People-lane Tag stage design for the Pantheon switch.

## Answer

**`Region` is genuinely shared** between `Person` and `HistoricalEvent` (`packages/shared-types/src/index.ts:43,77`), same situation as `Category`. `HistoricalEvent`'s region tagging is historical-polity-aware (e.g. Byzantine Empire → `europe` even though its core sits in modern Turkey) and can't be replaced by a present-day country scheme. Decision: **split into two types**, same pattern as `OccupationDomain`.

- **`Region`** stays exactly as-is (6 values), used only by `HistoricalEvent.regionTags` going forward.
- **New type, `UnRegion`**, replaces `Person.regionTags`, carrying the UN M49 geoscheme's 22 sub-regions (kebab-case): `northern-europe, southern-europe, eastern-europe, western-europe, eastern-asia, south-eastern-asia, southern-asia, central-asia, western-asia, northern-africa, western-africa, middle-africa, eastern-africa, southern-africa, northern-america, central-america, caribbean, south-america, australia-and-new-zealand, melanesia, micronesia, polynesia`.

**Sourcing the crosswalk:** rejected chasing `birth_civ` (Pantheon's "ancient civilization of birth" field) for historical accuracy — it's not in the bulk CSV, only the live per-person API, and pulling it for all 126,582 rows would reintroduce a live-dependency reliability risk of the same character as the Wikidata problem this map exists to fix. Present-day-location is accepted as a deliberate simplification for People.

Instead, use Pantheon's live `/country` endpoint (`https://api.pantheon.world/country`, public, no auth, PostgREST-based, verified live — 238 rows) as a **one-time** lookup: it returns `country`, `country_code`, `continent`, `region` (the UN region) per country. Fetch once, hardcode the resulting `bplace_country`/`dplace_country` → `UnRegion` table into the pipeline (same pattern `REGION_CATEGORIES.ts` already uses for Wikidata Q-IDs) — no live dependency during actual Fetch runs. Since the full 22-region granularity is kept (not folded down to the existing 6-value scheme), no manual exceptions are needed to reconcile with `REGION_CATEGORIES.ts`'s precedent — `Person` and `HistoricalEvent` now have independently appropriate region schemes.

**Known gotcha for implementation:** country-name strings don't match exactly between the person CSV and the `/country` endpoint (e.g. `"Bahamas, The"` vs `"The Bahamas"`) — join on `country_code`/ISO codes where possible rather than raw name strings, or normalize both sides.

## Comments

Revisited (2026-08-19, see `.scratch/pre-launch-readiness/issues/04-region-handling-investigation.md`): the split-into-two-types decision above is superseded. `Region`/`UnRegion` are unified onto a single 22-value `Region` type applied to all three lanes — `region-categories.ts` (Wikidata Q-ID keyed, Conflicts/Milestones) now targets the same 22-value scheme `un-region-categories.ts` (Pantheon country-name keyed, People) already used, instead of the coarser 6-value scheme. The rewrite also closed an unrelated maintenance gap found in the process: `region-categories.ts` was missing 52 country Q-IDs entirely (not just the 2 deliberately-excluded Oceania ones), which had been silently dropping to empty `regionTags`.
