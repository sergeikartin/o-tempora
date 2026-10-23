// English taglines for known candidate people, keyed on the Wikidata QID
// Pantheon retains per row (wd_id), parameterized on a batch of Q-IDs, not a
// corpus scan. Runs after fetch-pantheon.ts on the rows clearing the HPI
// specialist floor (see fetch-taglines.ts), since Pantheon's CSV has no tagline.
//
// Also backfills the P18 image claim, an English+Russian rdfs:label (name), a
// Russian tagline, and a Russian Wikipedia article title (?articleRu, the
// schema:about/schema:isPartOf pattern conflicts-enrichment.ts uses) on the same
// ?person. Each is a single-valued OPTIONAL on the same VALUES-clause query, so
// it adds no requests. name replaces Pantheon's CSV `name` (unused in
// pantheon-row-shape.ts) as the source of a person's display name. ?articleRu is
// People's only source of a Russian article title (Conflicts/Milestones get one
// per basket language, "ru" included); fetch-wikipedia-extracts.ts reads it back
// from this query's raw output for People's Russian `description`.
export function buildTaglinesQuery(personIds: string[]): string {
  const values = personIds.map((id) => `wd:${id}`).join(" ");
  return `
SELECT ?person ?nameEn ?nameRu ?tagline ?taglineRu ?image ?articleRu WHERE {
  VALUES ?person { ${values} }
  OPTIONAL { ?person rdfs:label ?nameEn . FILTER(LANG(?nameEn) = "en") }
  OPTIONAL { ?person rdfs:label ?nameRu . FILTER(LANG(?nameRu) = "ru") }
  OPTIONAL { ?person schema:description ?tagline . FILTER(LANG(?tagline) = "en") }
  OPTIONAL { ?person schema:description ?taglineRu . FILTER(LANG(?taglineRu) = "ru") }
  OPTIONAL { ?person wdt:P18 ?image . }
  OPTIONAL { ?articleRu schema:about ?person; schema:isPartOf <https://ru.wikipedia.org/>. }
}
`.trim();
}
