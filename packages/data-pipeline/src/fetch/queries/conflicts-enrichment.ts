import { articleVar, PAGEVIEWS_LANGUAGES } from '../pageviews-languages.js';

// Each pageviews-basket language's Wikipedia article title is an OPTIONAL
// binding in this query (like the English ?article), so it reuses the query's
// VALUES-clause batching instead of a second SPARQL pass. Shared with
// milestones-enrichment.ts's identical binding set.
function articleOptionalBlocks(): string {
  return PAGEVIEWS_LANGUAGES.map(
    (lang) =>
      `  OPTIONAL { ?${articleVar(lang)} schema:about ?event; schema:isPartOf <https://${lang}.wikipedia.org/>. }`,
  ).join('\n');
}

// Enrichment for the hand-curated Conflicts list
// (data/raw/conflicts-curated.raw.json), parameterized on a batch of curated
// Q-IDs (as in milestones-enrichment.ts), not a corpus scan. Backfills sitelinks
// (-> fameScore), a Wikipedia article URL per pageviews-basket language,
// country (-> regionTags), the P18 image claim, an English and Russian name
// (rdfs:label) and tagline, and start/end dates with precision (the p:/psv:
// statement-value-node pattern exposes wikibase:timePrecision). category/parentId
// are curator-authored and never refetched; name comes from Wikidata's label in
// both languages so they share one source, and the curated `name` is unused.
//
// ?date prefers P580 (start time) over P585 (point in time): conflicts already
// carry an explicit range, and some items (e.g. Q127751 Wars of the Roses) carry
// an unrelated, looser P585 that would clobber the real start. P585 is only a
// fallback for rows with no P580. Every P585/P580/P582 pattern is restricted to
// `a wikibase:BestRank` so a Preferred-rank claim wins over a Normal-rank one
// (e.g. Q32929 War of the Austrian Succession's precise Preferred end date over
// a coarser Normal one). Some items (e.g. Q189266 Eastern Front) still carry two
// conflicting BestRank claims with no Preferred rank; ORDER BY ?date ?endDate
// puts the earliest first per ?event and fetchConflictsEnrichment takes the first
// value, so ties resolve to the earliest claim.
export function buildConflictsEnrichmentQuery(ids: string[]): string {
  const values = ids.map((id) => `wd:${id}`).join(' ');
  const articleVars = PAGEVIEWS_LANGUAGES.map(
    (lang) => `?${articleVar(lang)}`,
  ).join(' ');
  return `
SELECT ?event ?sitelinks ${articleVars} ?country ?image ?nameEn ?nameRu ?tagline ?taglineRu ?date ?datePrecision ?endDate ?endDatePrecision WHERE {
  VALUES ?event { ${values} }
  ?event wikibase:sitelinks ?sitelinks .
${articleOptionalBlocks()}
  OPTIONAL { ?event wdt:P17 ?country. }
  OPTIONAL { ?event wdt:P18 ?image. }
  OPTIONAL { ?event rdfs:label ?nameEn . FILTER(LANG(?nameEn) = "en") }
  OPTIONAL { ?event rdfs:label ?nameRu . FILTER(LANG(?nameRu) = "ru") }
  OPTIONAL { ?event schema:description ?tagline . FILTER(LANG(?tagline) = "en") }
  OPTIONAL { ?event schema:description ?taglineRu . FILTER(LANG(?taglineRu) = "ru") }
  OPTIONAL {
    ?event p:P585 ?pointInTimeStatement .
    ?pointInTimeStatement a wikibase:BestRank .
    ?pointInTimeStatement psv:P585 ?pointInTimeValue .
    ?pointInTimeValue wikibase:timeValue ?pointInTime ;
                       wikibase:timePrecision ?pointInTimePrecision .
  }
  OPTIONAL {
    ?event p:P580 ?startTimeStatement .
    ?startTimeStatement a wikibase:BestRank .
    ?startTimeStatement psv:P580 ?startTimeValue .
    ?startTimeValue wikibase:timeValue ?startTime ;
                     wikibase:timePrecision ?startTimePrecision .
  }
  BIND(COALESCE(?startTime, ?pointInTime) AS ?date)
  BIND(COALESCE(?startTimePrecision, ?pointInTimePrecision) AS ?datePrecision)
  OPTIONAL {
    ?event p:P582 ?endDateStatement .
    ?endDateStatement a wikibase:BestRank .
    ?endDateStatement psv:P582 ?endDateValue .
    ?endDateValue wikibase:timeValue ?endDate ;
                   wikibase:timePrecision ?endDatePrecision .
  }
}
ORDER BY ?event ?date ?endDate
`.trim();
}
