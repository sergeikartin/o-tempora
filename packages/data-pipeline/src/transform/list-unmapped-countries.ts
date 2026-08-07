import fs from "node:fs";
import { validateSparqlResultShape } from "../fetch/validate-sparql-result.js";
import { groupRows, type GroupRowsConfig } from "./group-rows.js";
import { REGION_CATEGORIES } from "./region-categories.js";
import { validateEnrichedEventsFile } from "../fetch/fetch-events-enrichment.js";

// Dumps any country Q-ID a Wars/Discoveries event carries (across both raw
// sources, unioned) that isn't yet in REGION_CATEGORIES. Run after each
// batch of manual additions to region-categories.ts until this reports
// zero — except for Q-IDs that genuinely have no home in the app's fixed
// 6-region set (e.g. Oceania), which are expected to stay unmapped forever
// and resolve to "no region" by design.
//
// People no longer contributes here — it's Pantheon-sourced now, using a
// separate, fully-enumerated country-name lookup (un-region-categories.ts,
// no unmapped-value maintenance script needed).
function load(path: string) {
  return validateSparqlResultShape(JSON.parse(fs.readFileSync(path, "utf8")));
}

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

const historical = groupRows(load("data/raw/events-historical.raw.json").results.bindings, historicalConfig);

// Discoveries is the hand-curated + enriched list now, not a raw SPARQL
// binding dump — already one row per event with a plain `countries: string[]`
// field, no groupRows step needed (same reasoning as transformDiscoveries).
const { events: discoveries } = validateEnrichedEventsFile(
  JSON.parse(fs.readFileSync("data/raw/events-curated-enriched.raw.json", "utf8")),
);

const unmapped = new Set<string>();
for (const countryId of [...historical.flatMap((event) => event.countries), ...discoveries.flatMap((event) => event.countries)]) {
  if (!(countryId in REGION_CATEGORIES)) unmapped.add(countryId);
}

if (unmapped.size === 0) {
  console.log("No unmapped country Q-IDs.");
} else {
  console.log(`${unmapped.size} unmapped country Q-ID(s):`);
  for (const id of unmapped) console.log(`  ${id}`);
  process.exitCode = 1;
}
