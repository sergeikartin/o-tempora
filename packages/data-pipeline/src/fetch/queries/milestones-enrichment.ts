import { PAGEVIEWS_LANGUAGES, articleVar } from "../pageviews-languages.js";

function articleOptionalBlocks(): string {
  return PAGEVIEWS_LANGUAGES.map(
    (lang) =>
      `  OPTIONAL { ?${articleVar(lang)} schema:about ?event; schema:isPartOf <https://${lang}.wikipedia.org/>. }`,
  ).join("\n");
}

// Milestones cover a much wider spread of entity shapes than Conflicts
// (inventions, discoveries, publications, institutions, spacecraft launches,
// structures...), so no single Wikidata property reliably holds "the" date
// the way Conflicts leans on P580/P585 — this is the same 10-property set
// milestones-curated.raw.json's old hand-authored `dateProperty` field
// enumerated (every one of them was exercised by at least one curated
// entry), now fetched live instead of curator-typed. Priority order below
// matches that field's own documented order and is confirmed by that same
// history: P575 (discovery/invention) first since it's the most
// milestone-specific semantic, P571 (inception) next for institutions/
// structures, then P577 (publication), P580 (start time)/P585 (point in
// time) for events and multi-year spans, and the four narrow fallbacks
// (P569 date of birth, P606 first flight, P619 spacecraft launch, P1619
// official opening) last.
const DATE_PROPERTIES = ["P575", "P571", "P577", "P580", "P585", "P569", "P606", "P619", "P729", "P1619"] as const;

function dateVar(property: string): string {
  return property.toLowerCase();
}

// Same p:/psv: statement-value-node pattern as conflicts-enrichment.ts's
// ?date/?endDate blocks (makes wikibase:timePrecision available alongside
// the date), restricted to wikibase:BestRank for the same reason — a
// Preferred-rank claim wins over a Normal-rank one on the same item.
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
  }).join("\n");
}

// Enrichment for the hand-curated Milestones list
// (data/raw/milestones-curated.raw.json) — not a corpus scan, parameterized on
// a batch of specific curated Q-IDs, same VALUES-clause shape as
// taglines.ts. Backfills sitelinks (-> fameScore), a
// Wikipedia article URL per language in the pageviews basket (same 7-
// language set conflicts-enrichment.ts fixes for ADR 0010's pageviews blend),
// country (-> regionTags), the P18 image claim (dynamic-tooltips spec
// §4.3 — same "extend the existing OPTIONAL set" treatment as
// taglines.ts, no new request count), an English tagline (tagline/
// description split, live-fetched not curated, same as Conflicts), and — as
// of the Milestones taxonomy-expansion merge — a date via DATE_PROPERTIES'
// priority-ordered COALESCE, same "curated file carries no date of its own"
// sourcing Conflicts already uses. name/category are still curator-verified
// and never refetched here.
export function buildMilestonesEnrichmentQuery(ids: string[]): string {
  const values = ids.map((id) => `wd:${id}`).join(" ");
  const articleVars = PAGEVIEWS_LANGUAGES.map((lang) => `?${articleVar(lang)}`).join(" ");
  const timeVars = DATE_PROPERTIES.map((property) => `?${dateVar(property)}Time`).join(", ");
  const precisionVars = DATE_PROPERTIES.map((property) => `?${dateVar(property)}Precision`).join(", ");
  return `
SELECT ?event ?sitelinks ${articleVars} ?country ?image ?tagline ?date ?datePrecision WHERE {
  VALUES ?event { ${values} }
  ?event wikibase:sitelinks ?sitelinks .
${articleOptionalBlocks()}
  OPTIONAL { ?event wdt:P17 ?country. }
  OPTIONAL { ?event wdt:P18 ?image. }
  OPTIONAL { ?event schema:description ?tagline . FILTER(LANG(?tagline) = "en") }
${dateOptionalBlocks()}
  BIND(COALESCE(${timeVars}) AS ?date)
  BIND(COALESCE(${precisionVars}) AS ?datePrecision)
}
`.trim();
}
