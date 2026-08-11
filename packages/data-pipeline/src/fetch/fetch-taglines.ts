import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTaglinesQuery } from "./queries/taglines.js";
import { MIN_HPI } from "./queries/min-hpi.js";
import { parsePantheonCsv } from "./pantheon-row-shape.js";
import { batchedSparqlFetch } from "./batched-sparql-fetch.js";

const RAW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "raw");

// Runs after fetch-pantheon.ts, reading the just-downloaded CSV back out
// (same "raw file is the handoff" pattern fetch-reigns.ts also uses) rather
// than threading the parsed rows through in memory. Only fetches for rows
// clearing MIN_HPI — Pantheon's own corpus (126,582 rows) is far larger
// than the old Wikidata candidate pool ever was, so querying the whole
// thing would be wasted work (fetch-reigns.ts applies the same floor for
// the same reason).
export async function fetchTaglines(): Promise<void> {
  const csvPath = path.join(RAW_DIR, "people-pantheon.raw.csv");
  const rows = parsePantheonCsv(await readFile(csvPath, "utf8"));
  const personIds = [...new Set(rows.filter((row) => row.hpi >= MIN_HPI).map((row) => row.wdId))];

  console.log(`Fetching taglines for ${personIds.length} people at or above HPI ${MIN_HPI}...`);

  const output = await batchedSparqlFetch(personIds, buildTaglinesQuery);

  const outputPath = path.join(RAW_DIR, "people-taglines.raw.json");
  await writeFile(outputPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${output.results.bindings.length} rows to ${outputPath}`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  fetchTaglines().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
