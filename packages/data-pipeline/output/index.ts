import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformPeople, transformEvents, loadReignsMap } from "../transform/index.js";
import { buildPeople, buildEvents, type DropReport } from "./write-datasets.js";

// Single destination — both /data-pipeline and (from Unit 3/4) /src read
// generated data from the same shared-types package, rather than the
// pipeline writing its own copy and duplicating it into /src/shared/data/.
const DATA_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "packages",
  "shared-types",
  "src",
  "data",
);

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
  const { people, report: peopleReport } = buildPeople(transformPeople(), loadReignsMap());
  logReport("people.json", people.length, peopleReport);
  await writeDataset("people.json", people);

  const { events, report: eventsReport } = buildEvents(transformEvents());
  logReport("events.json", events.length, eventsReport);
  await writeDataset("events.json", events);

  console.log(`Wrote people.json and events.json to ${DATA_DIR}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
