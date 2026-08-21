import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TIER_0_FAME_SCORE_FLOOR } from "@same-sky/shared-types";
import { transformPeople, transformConflicts, transformMilestones } from "../transform/index.js";
import { assignConflictsMilestonesRows, assignPersonRows } from "./row-assignment.js";
import {
  buildPeople,
  buildConflicts,
  buildMilestones,
  splitByPayloadTier,
  type DropReport,
} from "./write-datasets.js";

// The pipeline owns its own output — generating a dataset is a separate,
// inspectable step from publishing it for consumers to read. `publish.ts`
// copies this directory's contents into packages/shared-types/src/data/.
const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "output");

function logReport(label: string, kept: number, report: DropReport): void {
  console.log(`${label}: kept ${kept}, dropped ${report.dropped}`);
  for (const [reason, count] of Object.entries(report.reasons)) {
    console.log(`    ${reason}: ${count}`);
  }
}

async function writeDataset(fileName: string, data: unknown): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(path.join(DATA_DIR, fileName), JSON.stringify(data, null, 2));
}

// Attaches each entry's permanent Row Depth identity (TimelineEntry.row,
// docs/adr/0005-row-assignment-moves-to-the-pipeline.md) — row assignment is
// language-independent (same ids/dates/fame regardless of `lang`, per
// write-datasets.ts's Lang doc comment), so `rowOf` is computed once, off
// the English build, and applied to both language builds by id here.
function withRows<T extends { id: string }>(entries: T[], rowOf: ReadonlyMap<string, number>): (T & { row: number })[] {
  return entries.map((entry) => ({ ...entry, row: rowOf.get(entry.id) ?? 0 }));
}

// Writes a lane's Payload Tier pair (`<lane>.tier0.json` / `<lane>.tier1.json`,
// `.ru` variants included via `fileNameFor`) — see write-datasets.ts's
// splitByPayloadTier and docs/adr/0004-payload-tier-split-defers-low-fame-data.md.
async function writeTieredDataset<T extends { fameScore: number }>(
  fileNameFor: (tier: "tier0" | "tier1") => string,
  entries: T[],
  floor: number,
): Promise<void> {
  const { tier0, tier1 } = splitByPayloadTier(entries, floor);
  await writeDataset(fileNameFor("tier0"), tier0);
  await writeDataset(fileNameFor("tier1"), tier1);
  console.log(`  -> ${fileNameFor("tier0")}: ${tier0.length}, ${fileNameFor("tier1")}: ${tier1.length}`);
}

async function main(): Promise<void> {
  const peopleRows = transformPeople();
  const { people, report: peopleReport } = buildPeople(peopleRows, "en");
  logReport("people.json", people.length, peopleReport);
  const { people: peopleRu, report: peopleRuReport } = buildPeople(peopleRows, "ru");
  logReport("people.ru.json", peopleRu.length, peopleRuReport);

  const personRowOf = assignPersonRows(people);
  const peopleWithRows = withRows(people, personRowOf);
  const peopleRuWithRows = withRows(peopleRu, personRowOf);
  await writeTieredDataset((tier) => `people.${tier}.json`, peopleWithRows, TIER_0_FAME_SCORE_FLOOR.people);
  await writeTieredDataset(
    (tier) => `people.${tier}.ru.json`,
    peopleRuWithRows,
    TIER_0_FAME_SCORE_FLOOR.people,
  );

  // Both language builds resolve from the same rows — buildConflicts
  // itself decides inclusion off English fields regardless of `lang`, so
  // calling it twice on identical input is what keeps the two files'
  // entity sets identical (see write-datasets.ts's Lang doc comment).
  const conflictRows = transformConflicts();
  const { entries: conflicts, report: conflictsReport } = buildConflicts(conflictRows, "en");
  logReport("conflicts.json", conflicts.length, conflictsReport);
  const { entries: conflictsRu, report: conflictsRuReport } = buildConflicts(conflictRows, "ru");
  logReport("conflicts.ru.json", conflictsRu.length, conflictsRuReport);

  const milestoneRows = transformMilestones();
  const { milestones, report: milestonesReport } = buildMilestones(milestoneRows, "en");
  logReport("milestones.json", milestones.length, milestonesReport);
  const { milestones: milestonesRu, report: milestonesRuReport } = buildMilestones(milestoneRows, "ru");
  logReport("milestones.ru.json", milestonesRu.length, milestonesRuReport);

  // Conflicts and Milestones share one row-packing pass (row-assignment.ts),
  // so their rows are computed together off the English builds, then
  // applied to both languages by id, same as People above.
  const eventsRowOf = assignConflictsMilestonesRows(conflicts, milestones);
  const conflictsWithRows = withRows(conflicts, eventsRowOf);
  const conflictsRuWithRows = withRows(conflictsRu, eventsRowOf);
  const milestonesWithRows = withRows(milestones, eventsRowOf);
  const milestonesRuWithRows = withRows(milestonesRu, eventsRowOf);

  await writeTieredDataset(
    (tier) => `conflicts.${tier}.json`,
    conflictsWithRows,
    TIER_0_FAME_SCORE_FLOOR.conflicts,
  );
  await writeTieredDataset(
    (tier) => `conflicts.${tier}.ru.json`,
    conflictsRuWithRows,
    TIER_0_FAME_SCORE_FLOOR.conflicts,
  );
  await writeTieredDataset(
    (tier) => `milestones.${tier}.json`,
    milestonesWithRows,
    TIER_0_FAME_SCORE_FLOOR.milestones,
  );
  await writeTieredDataset(
    (tier) => `milestones.${tier}.ru.json`,
    milestonesRuWithRows,
    TIER_0_FAME_SCORE_FLOOR.milestones,
  );

  console.log(`Wrote Payload Tier files for people, conflicts, and milestones (en + ru) to ${DATA_DIR}`);
  console.log("Run `npm run publish-data --workspace packages/data-pipeline` to publish to packages/shared-types.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
