// English one-line taglines for already-known candidate people, keyed
// on the Wikidata QID Pantheon retains per row (wd_id) — not a corpus
// scan, parameterized on a batch of specific Q-IDs, same shape as
// reigns.ts. Runs after fetch-pantheon.ts, on the subset of rows that
// clear the HPI specialist floor (see fetch-taglines.ts), since
// Pantheon's CSV has no tagline-equivalent field of its own.
//
// Also backfills the P18 (image) claim, an English+Russian rdfs:label
// (name), a Russian tagline binding, and a Russian Wikipedia article title
// (?articleRu, the same schema:about/schema:isPartOf pattern
// conflicts-enrichment.ts/milestones-enrichment.ts use for their own
// per-language article titles) on the same already-queried ?person —
// cheapest way to add each (dynamic-tooltips spec §4.3's reasoning,
// extended): no new request count, since every one of these is a
// single-valued OPTIONAL claim on the same VALUES-clause query, the same
// "extend the existing enrichment query" treatment Conflicts/Milestones use
// for their own per-language name/tagline. name replaces Pantheon's CSV
// `name` column as this pipeline's source of truth for a person's display
// name — Pantheon's own `name` is left unused in pantheon-row-shape.ts,
// same "kept, not deleted" precedent as Conflicts/Milestones' curated name.
// ?articleRu is People's only source of a Russian Wikipedia article title
// (unlike Conflicts/Milestones, which already fetch one per pageviews-
// basket language including "ru") — fetch-wikipedia-extracts.ts reads it
// back out of this query's raw output to source People's Russian
// `description`.
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
