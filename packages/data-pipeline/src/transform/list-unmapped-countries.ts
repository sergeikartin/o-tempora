import fs from "node:fs";
import { REGION_CATEGORIES } from "./region-categories.js";
import { validateEnrichedMilestonesFile } from "../fetch/fetch-milestones-enrichment.js";
import { validateEnrichedConflictsFile } from "../fetch/fetch-conflicts-enrichment.js";

// Dumps any country Q-ID a Conflicts/Milestones entry carries (across both
// enriched sources, unioned) that isn't yet in REGION_CATEGORIES. Run after
// each batch of manual additions to region-categories.ts until this reports
// zero — except for Q-IDs that genuinely have no home in the app's fixed
// 6-region set (e.g. Oceania), which are expected to stay unmapped forever
// and resolve to "no region" by design.
//
// People no longer contributes here — it's Pantheon-sourced now, using a
// separate, fully-enumerated country-name lookup (un-region-categories.ts,
// no unmapped-value maintenance script needed).
//
// Both Conflicts and Milestones are the hand-curated + enriched list now, not a
// raw SPARQL binding dump — already one row per entry with a plain
// `countries: string[]` field, no groupRows step needed (same reasoning as
// transformConflicts/transformMilestones).
const { conflicts } = validateEnrichedConflictsFile(JSON.parse(fs.readFileSync("data/raw/conflicts-curated-enriched.raw.json", "utf8")));
const { milestones } = validateEnrichedMilestonesFile(
  JSON.parse(fs.readFileSync("data/raw/milestones-curated-enriched.raw.json", "utf8")),
);

const unmapped = new Set<string>();
for (const countryId of [...conflicts.flatMap((conflict) => conflict.countries), ...milestones.flatMap((milestone) => milestone.countries)]) {
  if (!(countryId in REGION_CATEGORIES)) unmapped.add(countryId);
}

if (unmapped.size === 0) {
  console.log("No unmapped country Q-IDs.");
} else {
  console.log(`${unmapped.size} unmapped country Q-ID(s):`);
  for (const id of unmapped) console.log(`  ${id}`);
  process.exitCode = 1;
}
