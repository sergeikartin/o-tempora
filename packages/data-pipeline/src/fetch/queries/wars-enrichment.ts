// Enrichment for the hand-curated Wars & Conflicts list
// (data/raw/wars-curated.raw.json) — not a corpus scan, parameterized on a
// batch of specific curated Q-IDs, same VALUES-clause shape as
// events-enrichment.ts. Backfills sitelinks (-> fameScore), an English
// Wikipedia article URL, country (-> regionTags), the P18 image claim, an
// English description, and start/end dates with precision — the p:/psv:
// statement-value-node pattern makes wikibase:timePrecision available
// alongside each date. Unlike events-enrichment.ts, name/category/
// parentId are curator-authored and never refetched here, but description
// and dates are — the curated file carries no year/endYear/description of
// its own (see wars-curated.raw.json's meta.description). ?date prefers
// P580 (start time) over P585 (point in time): wars already carry an
// explicit start/end range, and some items (e.g. Q127751 Wars of the
// Roses) also carry an unrelated/looser P585 that would otherwise clobber
// the real start date. P585 is only a fallback for rows with no P580.
export function buildWarsEnrichmentQuery(ids: string[]): string {
  const values = ids.map((id) => `wd:${id}`).join(" ");
  return `
SELECT ?event ?sitelinks ?article ?country ?image ?description ?date ?datePrecision ?endDate ?endDatePrecision WHERE {
  VALUES ?event { ${values} }
  ?event wikibase:sitelinks ?sitelinks .
  OPTIONAL { ?article schema:about ?event; schema:isPartOf <https://en.wikipedia.org/>. }
  OPTIONAL { ?event wdt:P17 ?country. }
  OPTIONAL { ?event wdt:P18 ?image. }
  OPTIONAL { ?event schema:description ?description . FILTER(LANG(?description) = "en") }
  OPTIONAL {
    ?event p:P585 ?pointInTimeStatement .
    ?pointInTimeStatement psv:P585 ?pointInTimeValue .
    ?pointInTimeValue wikibase:timeValue ?pointInTime ;
                       wikibase:timePrecision ?pointInTimePrecision .
  }
  OPTIONAL {
    ?event p:P580 ?startTimeStatement .
    ?startTimeStatement psv:P580 ?startTimeValue .
    ?startTimeValue wikibase:timeValue ?startTime ;
                     wikibase:timePrecision ?startTimePrecision .
  }
  BIND(COALESCE(?startTime, ?pointInTime) AS ?date)
  BIND(COALESCE(?startTimePrecision, ?pointInTimePrecision) AS ?datePrecision)
  OPTIONAL {
    ?event p:P582 ?endDateStatement .
    ?endDateStatement psv:P582 ?endDateValue .
    ?endDateValue wikibase:timeValue ?endDate ;
                   wikibase:timePrecision ?endDatePrecision .
  }
}
`.trim();
}
