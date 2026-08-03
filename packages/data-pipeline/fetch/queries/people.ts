import { MIN_SITELINKS } from "./min-sitelinks.js";

// Candidate humans: birth date + sitelink count required (sitelinks is the
// fame signal Score will rank on), everything else optional since Wikidata
// coverage is inconsistent even for well-known people.
//
// Threshold matches MIN_SITELINKS (Score's specialist floor, transform/
// score.ts's FAME_TIER_MIN_SITELINKS.specialist): Score unconditionally
// discards anything below that floor, so fetching lower-sitelink candidates
// is pure waste of SPARQL page budget and row count. Not independently
// tunable — if the specialist floor changes, this must change with it.
//
// Bucketed by birth year ([minYear, maxYearExclusive)) rather than one
// unbounded scan across all of history. Root cause this works around: with
// no ORDER BY (sorting the full corpus by sitelinks was already found to
// time out — see architecture.md's "No ORDER BY in Fetch queries" decision),
// the live query service returns matches in an order empirically confirmed
// to track ascending Wikidata QID (~99% of adjacent raw rows non-decreasing
// in QID). Ancient/classical figures were bulk-imported into Wikidata with
// far lower QIDs than modern people, so an unbounded fetch's page budget
// (capped by the live service's own timeout ceiling) was being entirely
// consumed within antiquity — confirmed live: a real run reached only
// birthYear <= 401 across every row it collected. Bucketing gives every era
// its own page budget regardless of this incidental ordering. See
// fetch-people.ts's PEOPLE_ERA_BUCKETS for the actual boundaries.
function formatYearAsSparqlDateTime(year: number): string {
  const sign = year < 0 ? "-" : "";
  const magnitude = Math.abs(year).toString().padStart(4, "0");
  return `${sign}${magnitude}-01-01T00:00:00Z`;
}

export function buildPeopleQuery(
  limit: number,
  offset: number,
  minYear: number,
  maxYearExclusive: number,
): string {
  const minDateTime = formatYearAsSparqlDateTime(minYear);
  const maxDateTime = formatYearAsSparqlDateTime(maxYearExclusive);
  return `
SELECT ?person ?personLabel ?birthDate ?deathDate ?sitelinks ?occupation ?country ?article ?description WHERE {
  ?person wdt:P31 wd:Q5 ;
          wdt:P569 ?birthDate ;
          wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= ${MIN_SITELINKS})
  FILTER(?birthDate >= "${minDateTime}"^^xsd:dateTime && ?birthDate < "${maxDateTime}"^^xsd:dateTime)
  OPTIONAL { ?person rdfs:label ?personLabel . FILTER(LANG(?personLabel) = "en") }
  OPTIONAL { ?person wdt:P570 ?deathDate. }
  OPTIONAL { ?person wdt:P106 ?occupation. }
  OPTIONAL { ?person wdt:P27 ?country. }
  OPTIONAL { ?article schema:about ?person; schema:isPartOf <https://en.wikipedia.org/>. }
  OPTIONAL { ?person schema:description ?description . FILTER(LANG(?description) = "en") }
}
LIMIT ${limit} OFFSET ${offset}
`.trim();
}
