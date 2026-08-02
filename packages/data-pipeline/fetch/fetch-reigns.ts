import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runSparqlQuery } from "./wikidata-client.js";
import { validateSparqlResultShape } from "./validate-sparql-result.js";
import { buildReignsQuery } from "./queries/reigns.js";
import type { SparqlResults } from "./sparql-result-shape.js";

const RAW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "raw");

// Kept well under any practical VALUES-clause size limit; batching also
// bounds how much a single request can cost the query service, consistent
// with the courtesy delay pattern in wikidata-client.ts's fetchAllPages.
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 500;

const ENTITY_URI_PATTERN = /\/entity\/(Q\d+)$/;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  let vars: string[] = [];
  const bindings: SparqlResults["results"]["bindings"] = [];

  for (let i = 0; i < personIds.length; i += BATCH_SIZE) {
    const batch = personIds.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    try {
      const result = await runSparqlQuery(buildReignsQuery(batch));
      vars = result.head.vars;
      bindings.push(...result.results.bindings);
      console.log(`    batch ${batchNumber}: +${result.results.bindings.length} rows (total ${bindings.length})`);
    } catch (error) {
      // Best-effort, per the product decision — a failed batch just means
      // those ~50 people get no reign data, not a fatal pipeline error.
      console.warn(`    batch ${batchNumber}: failed (${(error as Error).message}); skipping.`);
    }
    if (i + BATCH_SIZE < personIds.length) await sleep(BATCH_DELAY_MS);
  }

  const output: SparqlResults = { head: { vars }, results: { bindings } };
  const outputPath = path.join(RAW_DIR, "people-reigns.raw.json");
  await writeFile(outputPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${bindings.length} rows to ${outputPath}`);
}
