import { PAGEVIEWS_LANGUAGES, articleVar } from "../pageviews-languages.js";

function articleOptionalBlocks(): string {
  return PAGEVIEWS_LANGUAGES.map(
    (lang) =>
      `  OPTIONAL { ?${articleVar(lang)} schema:about ?event; schema:isPartOf <https://${lang}.wikipedia.org/>. }`,
  ).join("\n");
}

// Enrichment for the hand-curated Events & Inventions list
// (data/raw/events-curated.raw.json) — not a corpus scan, parameterized on
// a batch of specific curated Q-IDs, same VALUES-clause shape as
// reigns.ts/descriptions.ts. Backfills sitelinks (-> fameScore), a
// Wikipedia article URL per language in the pageviews basket (same 7-
// language set wars-enrichment.ts fixes for ADR 0010's pageviews blend),
// country (-> regionTags), and the P18 image claim (dynamic-tooltips spec
// §4.3 — same "extend the existing OPTIONAL set" treatment as
// descriptions.ts, no new request count); name/year/category/description
// are already curator-verified and never refetched here.
export function buildEventsEnrichmentQuery(ids: string[]): string {
  const values = ids.map((id) => `wd:${id}`).join(" ");
  const articleVars = PAGEVIEWS_LANGUAGES.map((lang) => `?${articleVar(lang)}`).join(" ");
  return `
SELECT ?event ?sitelinks ${articleVars} ?country ?image WHERE {
  VALUES ?event { ${values} }
  ?event wikibase:sitelinks ?sitelinks .
${articleOptionalBlocks()}
  OPTIONAL { ?event wdt:P17 ?country. }
  OPTIONAL { ?event wdt:P18 ?image. }
}
`.trim();
}
