import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ReignPeriod } from "@same-sky/shared-types";
import { validateSparqlResultShape } from "../fetch/validate-sparql-result.js";
import { groupRows, type GroupedRow, type GroupRowsConfig } from "./group-rows.js";
import { groupReigns } from "./group-reigns.js";
import { tagPerson, type PersonTags } from "./tag-people.js";
import { tagHistoricalEvent, tagInvention, type EventTags } from "./tag-events.js";
import { scoreAndRank } from "./score.js";

export type TaggedPerson = GroupedRow & PersonTags;
export type TaggedEvent = GroupedRow & EventTags;

const RAW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "raw");

function loadRaw(fileName: string) {
  return validateSparqlResultShape(
    JSON.parse(fs.readFileSync(path.join(RAW_DIR, fileName), "utf8")),
  );
}

const PEOPLE_CONFIG: GroupRowsConfig = {
  entityVar: "person",
  labelVar: "personLabel",
  sitelinksVar: "sitelinks",
  articleVar: "article",
  descriptionVar: "description",
  dateVar: "birthDate",
  secondaryDateVar: "deathDate",
  tagVar: "occupation",
  countryVar: "country",
};

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
export function transformPeople(): TaggedPerson[] {
  const raw = loadRaw("people.raw.json");
  const grouped = groupRows(raw.results.bindings, PEOPLE_CONFIG);
  const tagged = grouped.map((row) => ({ ...row, ...tagPerson(row) }));
  return scoreAndRank(tagged);
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

// Keyed by every candidate person Q-ID fetch-reigns.ts queried, not just the
// ones that survive the fame-tier cut in transformPeople() — Output looks
// this up by id per final person, so extra entries for people who don't
// make the cut are simply never read.
export function loadReignsMap(): Map<string, ReignPeriod[]> {
  const raw = loadRaw("people-reigns.raw.json");
  return groupReigns(raw.results.bindings);
}
