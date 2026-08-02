// Candidate wars, battles, treaties, sieges, revolutions, rebellions, military
// operations, and generically-classed "historical event" items. Restricted to
// an explicit VALUES list of instance-of classes rather than a wdt:P279*
// transitive walk under a broad parent class — the transitive form reliably
// times out against the live query service at this corpus size.
const EVENT_TYPES = [
  "wd:Q198", // war
  "wd:Q178561", // battle
  "wd:Q131569", // treaty
  "wd:Q188055", // siege
  "wd:Q10931", // revolution
  "wd:Q124734", // rebellion
  "wd:Q645883", // military operation
  "wd:Q13418847", // historical event
];

export function buildHistoricalEventsQuery(limit: number, offset: number): string {
  return `
SELECT ?event ?eventLabel ?date ?sitelinks ?type ?country ?article WHERE {
  VALUES ?type { ${EVENT_TYPES.join(" ")} }
  ?event wdt:P31 ?type ;
         wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks > 20)
  OPTIONAL { ?event wdt:P585 ?pointInTime. }
  OPTIONAL { ?event wdt:P580 ?startTime. }
  BIND(COALESCE(?pointInTime, ?startTime) AS ?date)
  FILTER(BOUND(?date))
  OPTIONAL { ?event rdfs:label ?eventLabel . FILTER(LANG(?eventLabel) = "en") }
  OPTIONAL { ?event wdt:P17 ?country. }
  OPTIONAL { ?article schema:about ?event; schema:isPartOf <https://en.wikipedia.org/>. }
}
LIMIT ${limit} OFFSET ${offset}
`.trim();
}
