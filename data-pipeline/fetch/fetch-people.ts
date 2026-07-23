import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAllPages } from "./wikidata-client.js";
import { buildPeopleQuery } from "./queries/people.js";

const PAGE_SIZE = 500;
const MAX_PAGES = 10;
const RAW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "raw");

export async function fetchPeople(): Promise<void> {
  console.log("Fetching candidate people from the Wikidata Query Service...");
  const result = await fetchAllPages(buildPeopleQuery, PAGE_SIZE, MAX_PAGES);

  await mkdir(RAW_DIR, { recursive: true });
  const outputPath = path.join(RAW_DIR, "people.raw.json");
  await writeFile(outputPath, JSON.stringify(result, null, 2));
  console.log(`Wrote ${result.results.bindings.length} rows to ${outputPath}`);
}
