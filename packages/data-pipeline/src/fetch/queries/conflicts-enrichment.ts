import { PAGEVIEWS_LANGUAGES, articleVar } from "../pageviews-languages.js";

// Each pageviews-basket language's per-QID Wikipedia article title is
// resolved here (an OPTIONAL binding per language, same shape as the
// pre-existing English-only ?article binding) rather than via a second
// SPARQL pass, so title resolution reuses this enrichment query's own
// VALUES-clause batching. Shared with milestones-enrichment.ts's identical
// binding set.
function articleOptionalBlocks(): string {
  return PAGEVIEWS_LANGUAGES.map(
    (lang) =>
      `  OPTIONAL { ?${articleVar(lang)} schema:about ?event; schema:isPartOf <https://${lang}.wikipedia.org/>. }`,
  ).join("\n");
}

// Enrichment for the hand-curated Conflicts list
// (data/raw/conflicts-curated.raw.json) — not a corpus scan, parameterized on a
// batch of specific curated Q-IDs, same VALUES-clause shape as
// milestones-enrichment.ts. Backfills sitelinks (-> fameScore), a Wikipedia
// article URL per language in the pageviews basket, country (-> regionTags),
// the P18 image claim, an English + Russian name (rdfs:label) and tagline,
// and start/end dates with precision — the p:/psv: statement-value-node pattern makes
// wikibase:timePrecision available alongside each date. Unlike
// milestones-enrichment.ts, category/parentId are curator-authored and
// never refetched here, but name, tagline, and dates are not: name comes
// from Wikidata's own rdfs:label in both languages, the same symmetric
// per-language mechanism tagline uses, so English and Russian names share
// one consistent source with no per-entity editorial drift between them —
// the curated file's own hand-typed `name` is left on disk, unused. ?date
// prefers P580 (start
// time) over P585 (point in time): conflicts already carry an explicit
// start/end range, and some items (e.g. Q127751 Wars of the Roses) also
// carry an unrelated/looser P585 that would otherwise clobber the real
// start date. P585 is only a fallback for rows with no P580. Every P585/
// P580/P582 statement pattern is restricted to `a wikibase:BestRank` so a
// Preferred-rank claim always wins over a Normal-rank one on the same item
// (e.g. Q32929 War of the Austrian Succession carries a precise
// Preferred-rank end date alongside a coarser, unpreferred Normal-rank
// one). Some items (e.g. Q189266 Eastern Front) still carry two
// conflicting BestRank claims with no Preferred rank to break the tie —
// ORDER BY ?date ?endDate makes the earliest value come first per ?event,
// and fetchConflictsEnrichment takes the first value it sees, so ties resolve
// deterministically to the earliest claim instead of whichever row the
// endpoint happens to return first.
export function buildConflictsEnrichmentQuery(ids: string[]): string {
  const values = ids.map((id) => `wd:${id}`).join(" ");
  const articleVars = PAGEVIEWS_LANGUAGES.map((lang) => `?${articleVar(lang)}`).join(" ");
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
