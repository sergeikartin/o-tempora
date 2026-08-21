import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TIER_0_FAME_SCORE_FLOOR } from "@same-sky/shared-types";
import { transformPeople, transformConflicts, transformMilestones } from "../transform/index.js";
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
  await writeTieredDataset((tier) => `people.${tier}.json`, people, TIER_0_FAME_SCORE_FLOOR.people);

  const { people: peopleRu, report: peopleRuReport } = buildPeople(peopleRows, "ru");
  logReport("people.ru.json", peopleRu.length, peopleRuReport);
  await writeTieredDataset((tier) => `people.${tier}.ru.json`, peopleRu, TIER_0_FAME_SCORE_FLOOR.people);

  // Both language builds resolve from the same rows — buildConflicts
  // itself decides inclusion off English fields regardless of `lang`, so
  // calling it twice on identical input is what keeps the two files'
  // entity sets identical (see write-datasets.ts's Lang doc comment).
  const conflictRows = transformConflicts();
  const { entries: conflicts, report: conflictsReport } = buildConflicts(conflictRows, "en");
  logReport("conflicts.json", conflicts.length, conflictsReport);
  await writeTieredDataset((tier) => `conflicts.${tier}.json`, conflicts, TIER_0_FAME_SCORE_FLOOR.conflicts);

  const { entries: conflictsRu, report: conflictsRuReport } = buildConflicts(conflictRows, "ru");
  logReport("conflicts.ru.json", conflictsRu.length, conflictsRuReport);
  await writeTieredDataset((tier) => `conflicts.${tier}.ru.json`, conflictsRu, TIER_0_FAME_SCORE_FLOOR.conflicts);

  const milestoneRows = transformMilestones();
  const { milestones, report: milestonesReport } = buildMilestones(milestoneRows, "en");
  logReport("milestones.json", milestones.length, milestonesReport);
  await writeTieredDataset((tier) => `milestones.${tier}.json`, milestones, TIER_0_FAME_SCORE_FLOOR.milestones);

  const { milestones: milestonesRu, report: milestonesRuReport } = buildMilestones(milestoneRows, "ru");
  logReport("milestones.ru.json", milestonesRu.length, milestonesRuReport);
  await writeTieredDataset(
    (tier) => `milestones.${tier}.ru.json`,
    milestonesRu,
    TIER_0_FAME_SCORE_FLOOR.milestones,
  );

  console.log(`Wrote Payload Tier files for people, conflicts, and milestones (en + ru) to ${DATA_DIR}`);
  console.log("Run `npm run publish-data --workspace packages/data-pipeline` to publish to packages/shared-types.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
