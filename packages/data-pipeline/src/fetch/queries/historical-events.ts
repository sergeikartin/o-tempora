import type { ConflictCategory } from "@same-sky/shared-types";
import { MIN_SITELINKS } from "./min-sitelinks.js";
import { formatYearAsSparqlDateTime } from "./format-sparql-date.js";

// One Q-ID per surviving ConflictCategory value (armistice, Q107706,
// dropped — see .scratch/wars-conflicts-taxonomy/issues/01-per-category-sitelink-floors.md's
// Answer), each queried independently rather than one shared VALUES-clause
// list of classes — lets fetch-historical-events.ts pull every category into
// its own raw file (map's "one raw file per type" decision) and, downstream,
// transform/event-type-categories.ts key a direct 1:1 Q-ID -> ConflictCategory
// map instead of the old 2-bucket collapse. Confirmed live against the query
// service this session — see the map's Notes.
export const WAR_TYPE_QID = "Q198";
export const BATTLE_TYPE_QID = "Q178561";
export const SIEGE_TYPE_QID = "Q188055";
export const MILITARY_OPERATION_TYPE_QID = "Q645883";
export const REVOLUTION_TYPE_QID = "Q10931";
export const REBELLION_TYPE_QID = "Q124734";
export const COUP_D_ETAT_TYPE_QID = "Q45382";
export const WAR_OF_INDEPENDENCE_TYPE_QID = "Q1006311";
export const PEACE_TREATY_TYPE_QID = "Q625298";

// war and war-of-independence are both definitionally multi-year conflicts
// with real start/end dates — the only two ConflictCategory values that
// render as a range bar (a real Period) rather than a point; everything
// else in the lane is a WarEvent regardless of whether Wikidata happens to
// record a duration for it. See output/write-datasets.ts's buildWars.
export const BAR_RENDERED_TYPE_QIDS: ReadonlySet<string> = new Set([WAR_TYPE_QID, WAR_OF_INDEPENDENCE_TYPE_QID]);

export interface ConflictCategoryQuery {
  category: ConflictCategory;
  typeQid: string;
  // One raw file per category (map's "one raw file per type" decision) —
  // fetch-historical-events.ts writes each category's bindings here.
  rawFileName: string;
}

// Iterated by fetch-historical-events.ts to fetch and write one raw file per
// category; iterated again by transform/index.ts's transformWars to read
// them all back in — order there only affects log-output grouping. It also
// doubles as transform/index.ts's dedupeFirstById's tiebreak order for
// entities whose Wikidata item clears more than one category's query
// (multiple instance-of claims) — reordering this array changes which
// category such an entity ends up tagged as. See dedupeFirstById's own
// comment for what that ordering actually encodes (editorial salience for
// a general-audience timeline, not strict Wikidata-taxonomy specificity).
export const CONFLICT_CATEGORY_QUERIES: ConflictCategoryQuery[] = [
  { category: "war", typeQid: WAR_TYPE_QID, rawFileName: "events-war.raw.json" },
  { category: "battle", typeQid: BATTLE_TYPE_QID, rawFileName: "events-battle.raw.json" },
  { category: "siege", typeQid: SIEGE_TYPE_QID, rawFileName: "events-siege.raw.json" },
  {
    category: "military-operation",
    typeQid: MILITARY_OPERATION_TYPE_QID,
    rawFileName: "events-military-operation.raw.json",
  },
  { category: "revolution", typeQid: REVOLUTION_TYPE_QID, rawFileName: "events-revolution.raw.json" },
  { category: "rebellion", typeQid: REBELLION_TYPE_QID, rawFileName: "events-rebellion.raw.json" },
  { category: "coup-d-etat", typeQid: COUP_D_ETAT_TYPE_QID, rawFileName: "events-coup-d-etat.raw.json" },
  {
    category: "war-of-independence",
    typeQid: WAR_OF_INDEPENDENCE_TYPE_QID,
    rawFileName: "events-war-of-independence.raw.json",
  },
  { category: "peace-treaty", typeQid: PEACE_TREATY_TYPE_QID, rawFileName: "events-peace-treaty.raw.json" },
];

// One category's candidates for a given [minYear, maxYearExclusive) era
// bucket — see fetch-historical-events.ts's fetchBucketed. `typeQid` pins
// the query to a single Wikidata instance-of class rather than a shared
// VALUES list; ?type is still bound (via BIND, not VALUES) so the row shape
// group-rows.ts/tag-events.ts already expect (a `tags` array keyed off
// ?type) is unchanged even though every row in a given category's raw file
// now carries the same single tag.
export function buildHistoricalEventsQuery(
  typeQid: string,
  limit: number,
  offset: number,
  minYear: number,
  maxYearExclusive: number,
): string {
  const minDateTime = formatYearAsSparqlDateTime(minYear);
  const maxDateTime = formatYearAsSparqlDateTime(maxYearExclusive);
  return `
SELECT ?event ?eventLabel ?date ?datePrecision ?endDate ?endDatePrecision ?sitelinks ?type ?country ?article ?description ?image WHERE {
  ?event wdt:P31 wd:${typeQid} ;
         wikibase:sitelinks ?sitelinks .
  BIND(wd:${typeQid} AS ?type)
  FILTER(?sitelinks >= ${MIN_SITELINKS})
  # Full statement/value-node model (not the wdt: truthy shortcut) so
  # wikibase:timePrecision is available alongside the date itself — a "01"
  # month/day in the value is otherwise indistinguishable from Wikidata's
  # own placeholder for "unknown" at year precision. Same p:/psv: pattern
  # reigns.ts already uses for its P580/P582 qualifiers.
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
  BIND(COALESCE(?pointInTime, ?startTime) AS ?date)
  BIND(COALESCE(?pointInTimePrecision, ?startTimePrecision) AS ?datePrecision)
  FILTER(BOUND(?date))
  FILTER(?date >= "${minDateTime}"^^xsd:dateTime && ?date < "${maxDateTime}"^^xsd:dateTime)
  OPTIONAL {
    ?event p:P582 ?endDateStatement .
    ?endDateStatement psv:P582 ?endDateValue .
    ?endDateValue wikibase:timeValue ?endDate ;
                   wikibase:timePrecision ?endDatePrecision .
  }
  OPTIONAL { ?event rdfs:label ?eventLabel . FILTER(LANG(?eventLabel) = "en") }
  OPTIONAL { ?event wdt:P17 ?country. }
  OPTIONAL { ?article schema:about ?event; schema:isPartOf <https://en.wikipedia.org/>. }
  OPTIONAL { ?event schema:description ?description . FILTER(LANG(?description) = "en") }
  # P18 image claim, same "extend the existing OPTIONAL set" treatment
  # descriptions.ts/events-enrichment.ts already use for People/Discoveries
  # (dynamic-tooltips spec §4.1/§4.3) — no new request count, per "Research
  # P18/Commons image coverage for the new Wars & Conflicts categories"'
  # wiring recommendation.
  OPTIONAL { ?event wdt:P18 ?image . }
}
LIMIT ${limit} OFFSET ${offset}
`.trim();
}
