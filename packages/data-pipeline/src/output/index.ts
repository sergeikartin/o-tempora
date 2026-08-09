import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformPeople, transformWars, transformDiscoveries, loadReignsMap } from "../transform/index.js";
import { buildPeople, buildWars, buildDiscoveries, type DropReport } from "./write-datasets.js";

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
  const { people, report: peopleReport } = buildPeople(transformPeople(), loadReignsMap());
  logReport("people.json", people.length, peopleReport);
  await writeDataset("people.json", people);

  const { entries: wars, report: warsReport } = buildWars(transformWars());
  logReport("wars.json", wars.length, warsReport);
  await writeDataset("wars.json", wars);

  const { discoveries, report: discoveriesReport } = buildDiscoveries(transformDiscoveries());
  logReport("discoveries.json", discoveries.length, discoveriesReport);
  await writeDataset("discoveries.json", discoveries);

  console.log(`Wrote people.json, wars.json, and discoveries.json to ${DATA_DIR}`);
  console.log("Run `npm run publish-data --workspace packages/data-pipeline` to publish to packages/shared-types.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
