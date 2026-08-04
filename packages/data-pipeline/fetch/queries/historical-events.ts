import { MIN_SITELINKS } from "./min-sitelinks.js";
import { formatYearAsSparqlDateTime } from "./format-sparql-date.js";

// The one ?type class that gets range-bar (start+end) treatment instead of a
// single point, per the product decision that only wars — not battles,
// treaties, sieges, etc. — render as a bar. Exported so transform/
// event-type-categories.ts and output/write-datasets.ts can key off the same
// Q-ID instead of duplicating the literal — Fetch stays the source of truth
// for what a "war" Q-ID is, since it's the stage that already owns the
// EVENT_TYPES class list below.
export const WAR_TYPE_QID = "Q198";

// Candidate wars, battles, treaties, sieges, revolutions, rebellions, military
// operations, and generically-classed "historical event" items. Restricted to
// an explicit VALUES list of instance-of classes rather than a wdt:P279*
// transitive walk under a broad parent class — the transitive form reliably
// times out against the live query service at this corpus size.
const EVENT_TYPES = [
  `wd:${WAR_TYPE_QID}`, // war
  "wd:Q178561", // battle
  "wd:Q131569", // treaty
  "wd:Q188055", // siege
  "wd:Q10931", // revolution
  "wd:Q124734", // rebellion
  "wd:Q645883", // military operation
  "wd:Q13418847", // historical event
];

export function buildHistoricalEventsQuery(
  limit: number,
  offset: number,
  minYear: number,
  maxYearExclusive: number,
): string {
  const minDateTime = formatYearAsSparqlDateTime(minYear);
  const maxDateTime = formatYearAsSparqlDateTime(maxYearExclusive);
  return `
SELECT ?event ?eventLabel ?date ?endDate ?sitelinks ?type ?country ?article ?description ?partOfLabel WHERE {
  VALUES ?type { ${EVENT_TYPES.join(" ")} }
  ?event wdt:P31 ?type ;
         wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= ${MIN_SITELINKS})
  OPTIONAL { ?event wdt:P585 ?pointInTime. }
  OPTIONAL { ?event wdt:P580 ?startTime. }
  BIND(COALESCE(?pointInTime, ?startTime) AS ?date)
  FILTER(BOUND(?date))
  FILTER(?date >= "${minDateTime}"^^xsd:dateTime && ?date < "${maxDateTime}"^^xsd:dateTime)
  OPTIONAL { ?event wdt:P582 ?endDate. }
  OPTIONAL { ?event rdfs:label ?eventLabel . FILTER(LANG(?eventLabel) = "en") }
  OPTIONAL { ?event wdt:P17 ?country. }
  OPTIONAL { ?article schema:about ?event; schema:isPartOf <https://en.wikipedia.org/>. }
  OPTIONAL { ?event schema:description ?description . FILTER(LANG(?description) = "en") }
  # "Part of" (P361) the parent conflict, e.g. a battle -> its war. Best
  # effort: an event with no P361 claim, or whose target has no English
  # label, simply gets no ?partOfLabel — never filtered out over this.
  OPTIONAL {
    ?event wdt:P361 ?partOf .
    OPTIONAL { ?partOf rdfs:label ?partOfLabel . FILTER(LANG(?partOfLabel) = "en") }
  }
}
LIMIT ${limit} OFFSET ${offset}
`.trim();
}
