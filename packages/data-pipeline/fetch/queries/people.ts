// Candidate humans: birth date + sitelink count required (sitelinks is the
// fame signal Score will rank on), everything else optional since Wikidata
// coverage is inconsistent even for well-known people.
//
// Threshold lowered from 80 to 20 to grow the candidate pool toward the
// 3000-person fame-tier ceiling (transform/score.ts's
// PEOPLE_FAME_TIER_CEILING): >80 selects almost exclusively multi-occupation
// historical elites, which are heavy on raw-row cost (many OPTIONAL
// ?occupation rows per person) relative to how many *unique* people they
// yield per page. Spot-checked live before changing: at >20, a single
// LIMIT-500 page already contained 384 unique people (a ~0.77 rows-per-page
// yield versus roughly 0.1 at the old threshold), so the same page budget
// reaches a far larger candidate pool. 20 matches the threshold already used
// for both event queries, rather than inventing a fourth distinct number.
export function buildPeopleQuery(limit: number, offset: number): string {
  return `
SELECT ?person ?personLabel ?birthDate ?deathDate ?sitelinks ?occupation ?country ?article ?description WHERE {
  ?person wdt:P31 wd:Q5 ;
          wdt:P569 ?birthDate ;
          wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks > 20)
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
