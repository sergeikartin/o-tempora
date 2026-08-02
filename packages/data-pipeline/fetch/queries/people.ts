// Candidate humans: birth date + sitelink count required (sitelinks is the
// fame signal Score will rank on), everything else optional since Wikidata
// coverage is inconsistent even for well-known people.
export function buildPeopleQuery(limit: number, offset: number): string {
  return `
SELECT ?person ?personLabel ?birthDate ?deathDate ?sitelinks ?occupation ?country ?article ?description WHERE {
  ?person wdt:P31 wd:Q5 ;
          wdt:P569 ?birthDate ;
          wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks > 80)
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
