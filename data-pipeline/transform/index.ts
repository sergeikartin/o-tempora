import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSparqlResultShape } from "../fetch/validate-sparql-result.js";
import { groupRows, type GroupedRow, type GroupRowsConfig } from "./group-rows.js";
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
  tagVar: "type",
  countryVar: "country",
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

// group -> tag -> score, per lane. Tagging happens before the top-750 slice
// so events-lane tagging (which differs by source: historical events look
// up a ?type claim, inventions get "invention" unconditionally) is applied
// while each source's grouped rows are still distinguishable, before the
// two sources are merged into one ranked pool for scoring.
export function transformPeople(): TaggedPerson[] {
  const raw = loadRaw("people.raw.json");
  const grouped = groupRows(raw.results.bindings, PEOPLE_CONFIG);
  const tagged = grouped.map((row) => ({ ...row, ...tagPerson(row) }));
  return scoreAndRank(tagged);
}

export function transformEvents(): TaggedEvent[] {
  const historicalRaw = loadRaw("events-historical.raw.json");
  const inventionsRaw = loadRaw("events-inventions.raw.json");

  const historical = groupRows(historicalRaw.results.bindings, HISTORICAL_CONFIG).map((row) => ({
    ...row,
    ...tagHistoricalEvent(row),
  }));
  const inventions = groupRows(inventionsRaw.results.bindings, INVENTIONS_CONFIG).map((row) => ({
    ...row,
    ...tagInvention(row),
  }));

  // Confirmed no ID overlap between the two raw sources (see
  // context/specs/02-data-pipeline-score.md), so this is a plain union with
  // no dedup-conflict handling needed.
  return scoreAndRank([...historical, ...inventions]);
}
