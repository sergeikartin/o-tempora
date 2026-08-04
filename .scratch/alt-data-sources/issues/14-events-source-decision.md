Type: grilling
Status: resolved

## Question

Vetustas Archiva's inventions dataset turned out to be roughly the same scale as what the existing Wikidata pipeline already produces — 296 records vs. 289 invention-category events already in `packages/shared-types/src/data/events.json` — see [Vetustas schema research](../issues/07-research-vetustas-schema.md). It's not broad enough to fully replace Wikidata for Events & Inventions; adopting it at all would mean the same hybrid treatment as the Wars lane (CDB90 + Wikidata), not a standalone swap, and it carries the same CC BY-SA 4.0 ShareAlike constraint as Pantheon (see [Pantheon license ShareAlike](../issues/10-pantheon-license-sharealike.md)).

Given comparable scale to what's already produced, is adopting Vetustas (hybrid, with its fully-filled `wikidata_id` crosswalk as the main asset — e.g. for cross-linking or de-duplication against Wikidata-sourced events) still worth the integration cost and license obligation? Or does Events & Inventions simply stay on Wikidata entirely, relying on the query-reliability fix ([Wikidata reliability approach](../issues/04-wikidata-reliability-approach.md)) instead of adopting a new source for this lane?

## Context

This is the Events & Inventions lane's sourcing decision — the one lane left unresolved after charting. Depends on [Pantheon license ShareAlike](../issues/10-pantheon-license-sharealike.md) resolving the license-acceptability question first, since that answer applies here too.

## Answer

Stay Wikidata-only for Events & Inventions. Vetustas is rejected: its 296 records are comparable in scale to the 289 invention events Wikidata already produces (not a clear superset), coverage is only 92% within the app's date range, and its metadata is inconsistent (`type` unnormalized, `country` 82% empty). Unlike People (Pantheon dwarfs the current dataset) or Wars (CDB90 gives genuinely better-dated coverage), Vetustas doesn't clearly outperform the status quo, and adopting it would mean real integration cost (hybrid merge/dedupe logic, a second CC BY-SA notice) for marginal benefit. This lane relies entirely on the query-reliability fix ([Wikidata reliability approach](../issues/04-wikidata-reliability-approach.md) / [Wikidata query reliability research](../issues/08-research-wikidata-query-fix.md)) rather than a new data source.
