import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSparqlResultShape } from "./validate-sparql-result.js";
import { buildReignsQuery } from "./queries/reigns.js";
import { batchedSparqlFetch } from "./batched-sparql-fetch.js";
import type { SparqlResults } from "./sparql-result-shape.js";

const RAW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "raw");

const ENTITY_URI_PATTERN = /\/entity\/(Q\d+)$/;

function extractPersonIds(raw: SparqlResults): string[] {
  const ids = new Set<string>();
  for (const row of raw.results.bindings) {
    const uri = row.person?.value;
    const match = uri ? ENTITY_URI_PATTERN.exec(uri) : null;
    if (match?.[1]) ids.add(match[1]);
  }
  return [...ids];
}

// Runs after fetchPeople() — reads the candidate person IDs straight back
// out of the raw file it just wrote (rather than threading the in-memory
// result through), the same "raw file is the handoff" pattern Transform
// already uses to read Fetch's output. Deliberately queries the full
// candidate pool, not just the eventual top-N cut (that cut doesn't exist
// yet at Fetch time), so this stays ordered before Score/Tag like the rest
// of Fetch.
export async function fetchReigns(): Promise<void> {
  const peopleRawPath = path.join(RAW_DIR, "people.raw.json");
  const peopleRaw = validateSparqlResultShape(
    JSON.parse(await readFile(peopleRawPath, "utf8")),
  );
  const personIds = extractPersonIds(peopleRaw);

  console.log(`Fetching reign/term-of-office periods for ${personIds.length} candidate people...`);

  const output = await batchedSparqlFetch(personIds, buildReignsQuery);

  const outputPath = path.join(RAW_DIR, "people-reigns.raw.json");
  await writeFile(outputPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${output.results.bindings.length} rows to ${outputPath}`);
}
