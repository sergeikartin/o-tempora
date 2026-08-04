import { MIN_SITELINKS } from "./min-sitelinks.js";
import { formatYearAsSparqlDateTime } from "./format-sparql-date.js";

// Candidate inventions/discoveries: items carrying wdt:P575 ("time of
// discovery or invention") directly, rather than trying to classify by
// instance-of — Wikidata has no single umbrella class for "invention" that
// most invented/discovered things are actually typed under.
export function buildInventionsQuery(
  limit: number,
  offset: number,
  minYear: number,
  maxYearExclusive: number,
): string {
  const minDateTime = formatYearAsSparqlDateTime(minYear);
  const maxDateTime = formatYearAsSparqlDateTime(maxYearExclusive);
  return `
SELECT ?event ?eventLabel ?date ?sitelinks ?country ?article ?description WHERE {
  ?event wdt:P575 ?date ;
         wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= ${MIN_SITELINKS})
  FILTER(?date >= "${minDateTime}"^^xsd:dateTime && ?date < "${maxDateTime}"^^xsd:dateTime)
  OPTIONAL { ?event rdfs:label ?eventLabel . FILTER(LANG(?eventLabel) = "en") }
  OPTIONAL { ?event wdt:P17 ?country. }
  OPTIONAL { ?article schema:about ?event; schema:isPartOf <https://en.wikipedia.org/>. }
  OPTIONAL { ?event schema:description ?description . FILTER(LANG(?description) = "en") }
}
LIMIT ${limit} OFFSET ${offset}
`.trim();
}
