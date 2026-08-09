// Enrichment for the hand-curated Events & Inventions list
// (data/raw/events-curated.raw.json) — not a corpus scan, parameterized on
// a batch of specific curated Q-IDs, same VALUES-clause shape as
// reigns.ts/descriptions.ts. Backfills sitelinks (-> fameScore), an English
// Wikipedia article URL, country (-> regionTags), and the P18 image claim
// (dynamic-tooltips spec §4.3 — same "extend the existing OPTIONAL set"
// treatment as descriptions.ts, no new request count); name/year/category/
// description are already curator-verified and never refetched here.
export function buildEventsEnrichmentQuery(ids: string[]): string {
  const values = ids.map((id) => `wd:${id}`).join(" ");
  return `
SELECT ?event ?sitelinks ?article ?country ?image WHERE {
  VALUES ?event { ${values} }
  ?event wikibase:sitelinks ?sitelinks .
  OPTIONAL { ?article schema:about ?event; schema:isPartOf <https://en.wikipedia.org/>. }
  OPTIONAL { ?event wdt:P17 ?country. }
  OPTIONAL { ?event wdt:P18 ?image. }
}
`.trim();
}
