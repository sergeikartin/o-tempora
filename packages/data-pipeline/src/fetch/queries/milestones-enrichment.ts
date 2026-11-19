import { articleVar, PAGEVIEWS_LANGUAGES } from '../pageviews-languages.js';

function articleOptionalBlocks(): string {
  return PAGEVIEWS_LANGUAGES.map(
    (lang) =>
      `  OPTIONAL { ?${articleVar(lang)} schema:about ?event; schema:isPartOf <https://${lang}.wikipedia.org/>. }`,
  ).join('\n');
}

// Milestones span many entity shapes (inventions, discoveries, publications,
// institutions, launches, structures...), so no single property reliably holds
// the date as P580/P585 do for Conflicts. These 10 properties were each
// exercised by at least one curated entry. Priority order: P575
// (discovery/invention) as the most milestone-specific, P571 (inception) for
// institutions/structures, P577 (publication), P580 (start time)/P585 (point in
// time) for events and spans, then four narrow fallbacks (P569 date of birth,
// P606 first flight, P619 spacecraft launch, P1619 official opening). Some
// items carry two BestRank claims on the winning property with no Preferred
// rank to break the tie (e.g. Q1065 United Nations has year- and day-precision
// P571); the query's ORDER BY, not this array, makes that deterministic.
const DATE_PROPERTIES = [
  'P575',
  'P571',
  'P577',
  'P580',
  'P585',
  'P569',
  'P606',
  'P619',
  'P729',
  'P1619',
] as const;

function dateVar(property: string): string {
  return property.toLowerCase();
}

// Same p:/psv: statement-value-node pattern as conflicts-enrichment.ts's
// ?date/?endDate blocks (exposes wikibase:timePrecision with the date),
// restricted to wikibase:BestRank so a Preferred-rank claim wins over a
// Normal-rank one.
function dateOptionalBlocks(): string {
  return DATE_PROPERTIES.map((property) => {
    const v = dateVar(property);
    return `  OPTIONAL {
    ?event p:${property} ?${v}Statement .
    ?${v}Statement a wikibase:BestRank .
    ?${v}Statement psv:${property} ?${v}Value .
    ?${v}Value wikibase:timeValue ?${v}Time ;
               wikibase:timePrecision ?${v}Precision .
  }`;
  }).join('\n');
}

// Enrichment for the hand-curated Milestones list
// (data/raw/milestones-curated.raw.json), parameterized on a batch of curated
// Q-IDs (VALUES clause, as in taglines.ts), not a corpus scan. Backfills
// sitelinks (-> fameScore), a Wikipedia article URL per pageviews-basket
// language (the same 7 languages as conflicts-enrichment.ts, docs/adr/0010),
// country (-> regionTags), the P18 image claim, an English and Russian name
// (rdfs:label) and tagline, and a date via DATE_PROPERTIES' priority-ordered
// COALESCE. The curated file's own `name` is unused; category is
// curator-verified and never refetched. ORDER BY ?event ?date makes the earliest
// claim win ties, as in conflicts-enrichment.ts, since
// fetch-milestones-enrichment.ts keeps only the first row's ?date per id.
//
// ?endDate is the same P582 OPTIONAL block as conflicts-enrichment.ts's, bound
// independently of whichever property won ?date and deliberately not part of
// DATE_PROPERTIES' COALESCE. A row with a resolved ?endDate becomes a period
// (e.g. Q42005 Black Death, 1346-1353), every other row a point, the same
// Conflict/ConflictEvent split rule fetch-milestones-enrichment.ts and
// write-datasets.ts apply.
export function buildMilestonesEnrichmentQuery(ids: string[]): string {
  const values = ids.map((id) => `wd:${id}`).join(' ');
  const articleVars = PAGEVIEWS_LANGUAGES.map(
    (lang) => `?${articleVar(lang)}`,
  ).join(' ');
  const timeVars = DATE_PROPERTIES.map(
    (property) => `?${dateVar(property)}Time`,
  ).join(', ');
  const precisionVars = DATE_PROPERTIES.map(
    (property) => `?${dateVar(property)}Precision`,
  ).join(', ');
  const statementVars = DATE_PROPERTIES.map(
    (property) => `?${dateVar(property)}Statement`,
  ).join(', ');
  return `
SELECT ?event ?sitelinks ${articleVars} ?country ?image ?nameEn ?nameRu ?tagline ?taglineRu ?date ?datePrecision ?endDate ?endDatePrecision ?dateCirca ?endDateCirca WHERE {
  VALUES ?event { ${values} }
  ?event wikibase:sitelinks ?sitelinks .
${articleOptionalBlocks()}
  OPTIONAL { ?event wdt:P17 ?country. }
  OPTIONAL { ?event wdt:P18 ?image. }
  OPTIONAL { ?event rdfs:label ?nameEn . FILTER(LANG(?nameEn) = "en") }
  OPTIONAL { ?event rdfs:label ?nameRu . FILTER(LANG(?nameRu) = "ru") }
  OPTIONAL { ?event schema:description ?tagline . FILTER(LANG(?tagline) = "en") }
  OPTIONAL { ?event schema:description ?taglineRu . FILTER(LANG(?taglineRu) = "ru") }
${dateOptionalBlocks()}
  BIND(COALESCE(${timeVars}) AS ?date)
  BIND(COALESCE(${precisionVars}) AS ?datePrecision)
  BIND(COALESCE(${statementVars}) AS ?dateStatement)
  BIND(IF(BOUND(?dateStatement), EXISTS { ?dateStatement pq:P1480 wd:Q5727902 }, false) AS ?dateCirca)
  OPTIONAL {
    ?event p:P582 ?endDateStatement .
    ?endDateStatement a wikibase:BestRank .
    ?endDateStatement psv:P582 ?endDateValue .
    ?endDateValue wikibase:timeValue ?endDate ;
                   wikibase:timePrecision ?endDatePrecision .
    BIND(EXISTS { ?endDateStatement pq:P1480 wd:Q5727902 } AS ?endDateCirca)
  }
}
ORDER BY ?event ?date ?endDate
`.trim();
}
