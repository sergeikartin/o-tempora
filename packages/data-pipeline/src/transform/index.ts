import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DiscoveryCategory, Region, ReignPeriod } from "@same-sky/shared-types";
import { validateSparqlResultShape } from "../fetch/validate-sparql-result.js";
import { parsePantheonCsv, type PantheonPersonRow } from "../fetch/pantheon-row-shape.js";
import { validateEnrichedEventsFile } from "../fetch/fetch-events-enrichment.js";
import { groupRows, type GroupedRow, type GroupRowsConfig } from "./group-rows.js";
import { groupReigns } from "./group-reigns.js";
import { tagPantheonPerson, type PantheonPersonTags } from "./tag-pantheon-person.js";
import { tagHistoricalEvent, tagCuratedDiscovery, type EventTags } from "./tag-events.js";
import { scoreAndRank, scoreAndRankByHpi, rankDiscoveriesBySitelinks } from "./score.js";

export type TaggedPerson = PantheonPersonRow &
  PantheonPersonTags & { description?: string; wikipediaUrl: string };
export type TaggedEvent = GroupedRow & EventTags;

export interface TaggedDiscovery {
  id: string;
  label: string;
  article?: string;
  description: string;
  year: number;
  sitelinks: number;
  category: DiscoveryCategory;
  regionTags: Region[];
}

const RAW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "raw");

function loadRaw(fileName: string) {
  return validateSparqlResultShape(
    JSON.parse(fs.readFileSync(path.join(RAW_DIR, fileName), "utf8")),
  );
}

const ENTITY_URI_PATTERN = /\/entity\/(Q\d+)$/;

// Keyed by Wikidata QID, extracted from the description-query's ?person
// URI binding — same extraction pattern group-reigns.ts already uses.
function loadDescriptionsMap(): Map<string, string> {
  const raw = loadRaw("people-descriptions.raw.json");
  const map = new Map<string, string>();
  for (const row of raw.results.bindings) {
    const personUri = row.person?.value;
    const description = row.description?.value;
    if (!personUri || !description) continue;
    const match = ENTITY_URI_PATTERN.exec(personUri);
    if (match?.[1]) map.set(match[1], description);
  }
  return map;
}

const HISTORICAL_CONFIG: GroupRowsConfig = {
  entityVar: "event",
  labelVar: "eventLabel",
  sitelinksVar: "sitelinks",
  articleVar: "article",
  descriptionVar: "description",
  dateVar: "date",
  datePrecisionVar: "datePrecision",
  secondaryDateVar: "endDate",
  secondaryDatePrecisionVar: "endDatePrecision",
  tagVar: "type",
  countryVar: "country",
  partOfLabelVar: "partOfLabel",
};

// group -> tag -> score, per lane. People, Wars & Conflicts, and
// Discoveries & Inventions are three entirely independent lanes end to
// end — each fed by its own raw snapshot and scored on its own.
// Sourced from Pantheon 2.0, not Wikidata — no grouping needed (the CSV is
// already one row per person, unlike SPARQL's denormalized bindings).
// Descriptions come from a separate batched SPARQL fetch keyed on the
// Wikidata QID Pantheon retains per row (fetch-descriptions.ts), since
// Pantheon's own CSV has no description-equivalent field.
export function transformPeople(): TaggedPerson[] {
  const csvPath = path.join(RAW_DIR, "people-pantheon.raw.csv");
  const rows = parsePantheonCsv(fs.readFileSync(csvPath, "utf8"));
  const descriptions = loadDescriptionsMap();

  const tagged = rows.map((row) => ({
    ...row,
    ...tagPantheonPerson(row),
    description: descriptions.get(row.wdId),
    wikipediaUrl: `https://en.wikipedia.org/wiki/${row.slug}`,
  }));

  return scoreAndRankByHpi(tagged);
}

export function transformWars(): TaggedEvent[] {
  const historicalRaw = loadRaw("events-historical.raw.json");
  const historical = groupRows(historicalRaw.results.bindings, HISTORICAL_CONFIG).map((row) => ({
    ...row,
    ...tagHistoricalEvent(row),
  }));
  return scoreAndRank(historical);
}

// Sourced from the hand-curated + enriched events list
// (fetch-events-enrichment.ts's output), not a raw SPARQL binding dump —
// already one row per event, so no groupRows step needed here either
// (same reasoning as transformPeople). A missing enriched `sitelinks`
// means the enrichment pass couldn't resolve that QID; coerced to 0 here
// so it sorts last and Output's buildDiscoveries can drop it explicitly.
export function transformDiscoveries(): TaggedDiscovery[] {
  const enrichedPath = path.join(RAW_DIR, "events-curated-enriched.raw.json");
  const { events } = validateEnrichedEventsFile(JSON.parse(fs.readFileSync(enrichedPath, "utf8")));

  const tagged = events.map((event) => {
    const { category, regionTags } = tagCuratedDiscovery(event.category, event.countries);
    return {
      id: event.id,
      label: event.name,
      article: event.wikipediaUrl,
      description: event.description,
      year: event.year,
      sitelinks: event.sitelinks ?? 0,
      category,
      regionTags,
    };
  });

  return rankDiscoveriesBySitelinks(tagged);
}

// Keyed by every person Q-ID that fetch-reigns.ts's snapshot covers, not
// just the ones that survive the fame-tier cut in transformPeople() —
// Output looks this up by id per final person, so extra/stale entries are
// simply never read.
export function loadReignsMap(): Map<string, ReignPeriod[]> {
  const raw = loadRaw("people-reigns.raw.json");
  return groupReigns(raw.results.bindings);
}
