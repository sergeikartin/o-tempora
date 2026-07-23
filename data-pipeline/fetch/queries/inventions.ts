// Candidate inventions/discoveries: items carrying wdt:P575 ("time of
// discovery or invention") directly, rather than trying to classify by
// instance-of — Wikidata has no single umbrella class for "invention" that
// most invented/discovered things are actually typed under.
export function buildInventionsQuery(limit: number, offset: number): string {
  return `
SELECT ?event ?eventLabel ?date ?sitelinks ?country ?article WHERE {
  ?event wdt:P575 ?date ;
         wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks > 20)
  OPTIONAL { ?event rdfs:label ?eventLabel . FILTER(LANG(?eventLabel) = "en") }
  OPTIONAL { ?event wdt:P17 ?country. }
  OPTIONAL { ?article schema:about ?event; schema:isPartOf <https://en.wikipedia.org/>. }
}
LIMIT ${limit} OFFSET ${offset}
`.trim();
}
