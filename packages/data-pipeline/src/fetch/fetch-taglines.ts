import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildTaglinesQuery } from "./queries/taglines.js";
import { MIN_HPI } from "./queries/min-hpi.js";
import { parsePantheonCsv } from "./pantheon-row-shape.js";
import { validateSparqlResultShape } from "./validate-sparql-result.js";
import type { QidFilter } from "./qid-filter.js";
import { batchedSparqlFetch } from "./batched-sparql-fetch.js";

const RAW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "raw");

// Runs after fetch-pantheon.ts, reading the just-downloaded CSV back out
// (same "raw file is the handoff" pattern fetch-reigns.ts also uses) rather
// than threading the parsed rows through in memory. Only fetches for rows
// clearing MIN_HPI — Pantheon's own corpus (126,582 rows) is far larger
// than the old Wikidata candidate pool ever was, so querying the whole
// thing would be wasted work (fetch-reigns.ts applies the same floor for
// the same reason).
export async function fetchTaglines(qids?: QidFilter): Promise<void> {
  const csvPath = path.join(RAW_DIR, "people-pantheon.raw.csv");
  const rows = parsePantheonCsv(await readFile(csvPath, "utf8"));
  const personIds = [...new Set(rows.filter((row) => row.hpi >= MIN_HPI && (!qids || qids.has(row.wdId))).map((row) => row.wdId))];

  console.log(`Fetching taglines for ${personIds.length} people at or above HPI ${MIN_HPI}...`);

  if (qids && personIds.length === 0) return;

  const fetched = await batchedSparqlFetch(personIds, buildTaglinesQuery);

  const outputPath = path.join(RAW_DIR, "people-taglines.raw.json");
  // Scoped runs replace only the selected people's bindings in the existing file.
  const output = qids
    ? {
        ...fetched,
        results: {
          bindings: [
            ...validateSparqlResultShape(JSON.parse(await readFile(outputPath, "utf8"))).results.bindings.filter(
              (row) => !qids.has(row.person?.value.split("/").pop() ?? ""),
            ),
            ...fetched.results.bindings,
          ],
        },
      }
    : fetched;
  await writeFile(outputPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${output.results.bindings.length} rows to ${outputPath}`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  fetchTaglines().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
