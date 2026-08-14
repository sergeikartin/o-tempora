import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformPeople, transformConflicts, transformMilestones } from "../transform/index.js";
import { buildPeople, buildConflicts, buildMilestones, type DropReport } from "./write-datasets.js";

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

async function main(): Promise<void> {
  const peopleRows = transformPeople();
  const { people, report: peopleReport } = buildPeople(peopleRows, "en");
  logReport("people.json", people.length, peopleReport);
  await writeDataset("people.json", people);

  const { people: peopleRu, report: peopleRuReport } = buildPeople(peopleRows, "ru");
  logReport("people.ru.json", peopleRu.length, peopleRuReport);
  await writeDataset("people.ru.json", peopleRu);

  // Both language builds resolve from the same rows — buildConflicts
  // itself decides inclusion off English fields regardless of `lang`, so
  // calling it twice on identical input is what keeps the two files'
  // entity sets identical (see write-datasets.ts's Lang doc comment).
  const conflictRows = transformConflicts();
  const { entries: conflicts, report: conflictsReport } = buildConflicts(conflictRows, "en");
  logReport("conflicts.json", conflicts.length, conflictsReport);
  await writeDataset("conflicts.json", conflicts);

  const { entries: conflictsRu, report: conflictsRuReport } = buildConflicts(conflictRows, "ru");
  logReport("conflicts.ru.json", conflictsRu.length, conflictsRuReport);
  await writeDataset("conflicts.ru.json", conflictsRu);

  const milestoneRows = transformMilestones();
  const { milestones, report: milestonesReport } = buildMilestones(milestoneRows, "en");
  logReport("milestones.json", milestones.length, milestonesReport);
  await writeDataset("milestones.json", milestones);

  const { milestones: milestonesRu, report: milestonesRuReport } = buildMilestones(milestoneRows, "ru");
  logReport("milestones.ru.json", milestonesRu.length, milestonesRuReport);
  await writeDataset("milestones.ru.json", milestonesRu);

  console.log(
    `Wrote people.json, people.ru.json, conflicts.json, conflicts.ru.json, milestones.json, and milestones.ru.json to ${DATA_DIR}`,
  );
  console.log("Run `npm run publish-data --workspace packages/data-pipeline` to publish to packages/shared-types.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
