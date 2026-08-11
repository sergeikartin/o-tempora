import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildReignsQuery } from "./queries/reigns.js";
import { MIN_HPI } from "./queries/min-hpi.js";
import { parsePantheonCsv } from "./pantheon-row-shape.js";
import { batchedSparqlFetch } from "./batched-sparql-fetch.js";

const RAW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "raw");

// Runs after fetchPantheon() — reads the candidate person Q-IDs back out of
// the just-downloaded CSV (the "raw file is the handoff" pattern
// fetch-taglines.ts already uses), rather than a primary Wikidata people
// scan. Filtered to MIN_HPI same as fetch-taglines.ts: anything below
// that floor never survives Score, so querying it here is wasted.
export async function fetchReigns(): Promise<void> {
  const csvPath = path.join(RAW_DIR, "people-pantheon.raw.csv");
  const rows = parsePantheonCsv(await readFile(csvPath, "utf8"));
  const personIds = [...new Set(rows.filter((row) => row.hpi >= MIN_HPI).map((row) => row.wdId))];

  console.log(`Fetching reign/term-of-office periods for ${personIds.length} candidate people...`);

  const output = await batchedSparqlFetch(personIds, buildReignsQuery);

  const outputPath = path.join(RAW_DIR, "people-reigns.raw.json");
  await writeFile(outputPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${output.results.bindings.length} rows to ${outputPath}`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  fetchReigns().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
