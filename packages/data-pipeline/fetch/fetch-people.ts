import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAllPages } from "./wikidata-client.js";
import { buildPeopleQuery } from "./queries/people.js";

const PAGE_SIZE = 500;
// Raised from 10 to reach toward the 3000-person fame-tier ceiling (see
// queries/people.ts's threshold-lowering comment for the row-yield math).
// Spot-checked live before changing: offset up to 20,000 succeeded
// reliably, 25,000/35,000 timed out on the same run — ambient service
// instability (see architecture.md's "pagination has a soft ceiling"
// decision), not a hard wall. 40 pages (offset up to 19,500) stays inside
// the empirically reliable range; fetchAllPages already stops gracefully
// and keeps partial results if a deeper page fails regardless.
const MAX_PAGES = 40;
const RAW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "raw");

export async function fetchPeople(): Promise<void> {
  console.log("Fetching candidate people from the Wikidata Query Service...");
  const result = await fetchAllPages(buildPeopleQuery, PAGE_SIZE, MAX_PAGES);

  await mkdir(RAW_DIR, { recursive: true });
  const outputPath = path.join(RAW_DIR, "people.raw.json");
  await writeFile(outputPath, JSON.stringify(result, null, 2));
  console.log(`Wrote ${result.results.bindings.length} rows to ${outputPath}`);
}
