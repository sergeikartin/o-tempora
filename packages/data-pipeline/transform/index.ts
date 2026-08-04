import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ReignPeriod } from "@same-sky/shared-types";
import { validateSparqlResultShape } from "../fetch/validate-sparql-result.js";
import { parsePantheonCsv, type PantheonPersonRow } from "../fetch/pantheon-row-shape.js";
import { groupRows, type GroupedRow, type GroupRowsConfig } from "./group-rows.js";
import { groupReigns } from "./group-reigns.js";
import { tagPantheonPerson, type PantheonPersonTags } from "./tag-pantheon-person.js";
import { tagHistoricalEvent, tagInvention, type EventTags } from "./tag-events.js";
import { scoreAndRank, scoreAndRankByHpi } from "./score.js";

export type TaggedPerson = PantheonPersonRow &
  PantheonPersonTags & { description?: string; wikipediaUrl: string };
export type TaggedEvent = GroupedRow & EventTags;

const RAW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "raw");

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
  secondaryDateVar: "endDate",
  tagVar: "type",
  countryVar: "country",
  partOfLabelVar: "partOfLabel",
};

const INVENTIONS_CONFIG: GroupRowsConfig = {
  entityVar: "event",
  labelVar: "eventLabel",
  sitelinksVar: "sitelinks",
  articleVar: "article",
  descriptionVar: "description",
  dateVar: "date",
  countryVar: "country",
};

// group -> tag -> score, per lane. Wars & Conflicts and Discoveries &
// Inventions are two entirely independent lanes end to end — each fed by
// its own raw snapshot, tagged with its own rules (historical events look
// up a ?type claim; inventions get "invention" unconditionally), and scored
// on its own. They're never merged: tagHistoricalEvent never produces
// "invention" and tagInvention always does, so the two lanes' categories
// can't overlap by construction — see tag-events.test.ts.
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

export function transformDiscoveries(): TaggedEvent[] {
  const inventionsRaw = loadRaw("events-inventions.raw.json");
  const inventions = groupRows(inventionsRaw.results.bindings, INVENTIONS_CONFIG).map((row) => ({
    ...row,
    ...tagInvention(row),
  }));
  return scoreAndRank(inventions);
}

// Keyed by every person Q-ID that fetch-reigns.ts's snapshot covers, not
// just the ones that survive the fame-tier cut in transformPeople() —
// Output looks this up by id per final person, so extra/stale entries are
// simply never read.
export function loadReignsMap(): Map<string, ReignPeriod[]> {
  const raw = loadRaw("people-reigns.raw.json");
  return groupReigns(raw.results.bindings);
}
