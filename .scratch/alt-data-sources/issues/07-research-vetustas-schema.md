Type: research
Status: resolved

## Question

What is the Vetustas Archiva "inventions" dataset (https://docs.vetustas.net/datasets/inventions)? The docs page is a JS shell that couldn't be fetched directly — find the actual dataset (download link, API, or repo). Determine: field list, date field(s) and precision, any identifiers (Wikidata QID or otherwise), license, record count, and time period covered. Critically: does it cover discoveries/inventions broadly enough to fully replace Wikidata for the Events & Inventions lane, or only a subset (in which case this lane needs the same hybrid treatment as Wars)?

## Context

Blocks: Events & Inventions lane sourcing decision — currently the only lane with no sourcing decision made yet, pending this research.

## Answer

Full findings: [research/vetustas-schema.md](../research/vetustas-schema.md). The docs page is a client-rendered SPA shell with no static content, but the real data was traced through to a primary source and a live API: `github.com/0xShady/vetustas-archiva` and `api.vetustas.net/v1` (self-documenting `/v1/inventions/schema`, OpenAPI 3.1 spec).

- **10 fields**: `id`, `name`, `date`, `reference_url`, `country`, `inventor`, `type`, `category`, `image`, `wikidata_id`. `wikidata_id` is 100% filled (296/296) — a full crosswalk, unlike CDB90's partial DBpedia one.
- **296 records**, dates mixed precision (year-only for most, negative for BCE), spanning ~3.3M BCE to 2020, 92% within this app's ~3000 BCE-present scope.
- **License: CC BY-SA 4.0** for the data (code is MIT) — the same ShareAlike constraint as Pantheon's license (see [Pantheon license ShareAlike](../issues/10-pantheon-license-sharealike.md)).
- **Coverage verdict: not sufficient to fully replace Wikidata.** 296 records is roughly the same scale as the **289 invention-category events this project's existing Wikidata pipeline already produces** (`packages/shared-types/src/data/events.json`) — this is a "greatest hits" list, not a broader corpus. Metadata is inconsistent (`type` is an unnormalized raw Wikidata class dump; `country` is 82% empty). If adopted at all, it would need the same hybrid treatment as the Wars lane, not a standalone swap — its main asset is the fully-filled `wikidata_id` crosswalk.
