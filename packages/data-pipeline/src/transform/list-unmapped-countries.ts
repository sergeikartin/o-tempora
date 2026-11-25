import fs from 'node:fs';
import { validateEnrichedConflictsFile } from '../fetch/fetch-conflicts-enrichment.ts';
import { validateEnrichedMilestonesFile } from '../fetch/fetch-milestones-enrichment.ts';
import { REGION_CATEGORIES } from './region-categories.ts';

// Dumps any country Q-ID a Conflicts/Milestones entry carries (across both
// enriched sources, unioned) that isn't yet in REGION_CATEGORIES. Run after each
// batch of additions to region-categories.ts until it reports zero, except
// Q-IDs with no home in the 22 sub-regions, which stay unmapped and resolve to
// "no region". People need no such script: their Pantheon country-name lookup
// (un-region-categories.ts) is fully enumerated. Both lanes are already one row
// per entry with a plain `countries: string[]`, so no groupRows step is needed.
const { conflicts } = validateEnrichedConflictsFile(
  JSON.parse(
    fs.readFileSync('data/raw/conflicts-curated-enriched.raw.json', 'utf8'),
  ),
);
const { milestones } = validateEnrichedMilestonesFile(
  JSON.parse(
    fs.readFileSync('data/raw/milestones-curated-enriched.raw.json', 'utf8'),
  ),
);

const unmapped = new Set<string>();
for (const countryId of [
  ...conflicts.flatMap((conflict) => conflict.countries),
  ...milestones.flatMap((milestone) => milestone.countries),
]) {
  if (!(countryId in REGION_CATEGORIES)) unmapped.add(countryId);
}

if (unmapped.size === 0) {
  console.log('No unmapped country Q-IDs.');
} else {
  console.log(`${unmapped.size} unmapped country Q-ID(s):`);
  for (const id of unmapped) console.log(`  ${id}`);
  process.exitCode = 1;
}
