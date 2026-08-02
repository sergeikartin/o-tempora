import fs from "node:fs";
import { validateSparqlResultShape } from "../fetch/validate-sparql-result.js";
import { groupRows, type GroupRowsConfig } from "./group-rows.js";
import { REGION_CATEGORIES } from "./region-categories.js";

// Dumps any country Q-ID a grouped person/event carries (across all three
// raw sources, unioned) that isn't yet in REGION_CATEGORIES. Run after each
// batch of manual additions to region-categories.ts until this reports
// zero — except for Q-IDs that genuinely have no home in the app's fixed
// 6-region set (e.g. Oceania), which are expected to stay unmapped forever
// and resolve to "no region" by design.
function load(path: string) {
  return validateSparqlResultShape(JSON.parse(fs.readFileSync(path, "utf8")));
}

const peopleConfig: GroupRowsConfig = {
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

const historicalConfig: GroupRowsConfig = {
  entityVar: "event",
  labelVar: "eventLabel",
  sitelinksVar: "sitelinks",
  articleVar: "article",
  descriptionVar: "description",
  dateVar: "date",
  tagVar: "type",
  countryVar: "country",
};

const inventionsConfig: GroupRowsConfig = {
  entityVar: "event",
  labelVar: "eventLabel",
  sitelinksVar: "sitelinks",
  articleVar: "article",
  descriptionVar: "description",
  dateVar: "date",
  countryVar: "country",
};

const grouped = [
  ...groupRows(load("data/raw/people.raw.json").results.bindings, peopleConfig),
  ...groupRows(load("data/raw/events-historical.raw.json").results.bindings, historicalConfig),
  ...groupRows(load("data/raw/events-inventions.raw.json").results.bindings, inventionsConfig),
];

const unmapped = new Set<string>();
for (const entity of grouped) {
  for (const countryId of entity.countries) {
    if (!(countryId in REGION_CATEGORIES)) unmapped.add(countryId);
  }
}

if (unmapped.size === 0) {
  console.log("No unmapped country Q-IDs.");
} else {
  console.log(`${unmapped.size} unmapped country Q-ID(s):`);
  for (const id of unmapped) console.log(`  ${id}`);
  process.exitCode = 1;
}
