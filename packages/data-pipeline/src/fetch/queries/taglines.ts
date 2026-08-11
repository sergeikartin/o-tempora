// English one-line taglines for already-known candidate people, keyed
// on the Wikidata QID Pantheon retains per row (wd_id) — not a corpus
// scan, parameterized on a batch of specific Q-IDs, same shape as
// reigns.ts. Runs after fetch-pantheon.ts, on the subset of rows that
// clear the HPI specialist floor (see fetch-taglines.ts), since
// Pantheon's CSV has no tagline-equivalent field of its own.
//
// Also backfills the P18 (image) claim on the same already-queried
// ?person — cheapest way to add it (dynamic-tooltips spec §4.3): no new
// request count, since both are single-valued OPTIONAL claims on the same
// VALUES-clause query.
export function buildTaglinesQuery(personIds: string[]): string {
  const values = personIds.map((id) => `wd:${id}`).join(" ");
  return `
SELECT ?person ?tagline ?image WHERE {
  VALUES ?person { ${values} }
  OPTIONAL { ?person schema:description ?tagline . FILTER(LANG(?tagline) = "en") }
  OPTIONAL { ?person wdt:P18 ?image . }
}
`.trim();
}
