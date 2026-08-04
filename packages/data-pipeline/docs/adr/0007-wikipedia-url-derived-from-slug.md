# wikipediaUrl for People is derived from Pantheon's slug, not fetched

`wikipediaUrl` for People is computed deterministically from Pantheon's `slug` column (`https://en.wikipedia.org/wiki/{slug}`) rather than fetched, because Pantheon guarantees every row has one — unlike Wikidata's optional `schema:about`/`isPartOf` join that Wars/Discoveries would need.
