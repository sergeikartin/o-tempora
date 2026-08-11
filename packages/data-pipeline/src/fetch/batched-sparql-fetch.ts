import { runSparqlQuery } from "./wikidata-client.js";
import type { SparqlResults } from "./sparql-result-shape.js";

// Kept well under any practical VALUES-clause size limit; batching also
// bounds how much a single request can cost the query service, consistent
// with the courtesy delay pattern in wikidata-client.ts's fetchAllPages.
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Runs a VALUES-clause query in batches over a list of Wikidata QIDs,
// tolerating individual batch failures (best-effort — a failed batch just
// means those ~50 entities get no data for this pass, not a fatal pipeline
// error). Shared by fetch-reigns.ts and fetch-taglines.ts, which both
// batch a different predicate over the same kind of candidate-QID list.
export async function batchedSparqlFetch(
  ids: string[],
  buildQuery: (batch: string[]) => string,
): Promise<SparqlResults> {
  let vars: string[] = [];
  const bindings: SparqlResults["results"]["bindings"] = [];

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    try {
      const result = await runSparqlQuery(buildQuery(batch));
      vars = result.head.vars;
      bindings.push(...result.results.bindings);
      console.log(`    batch ${batchNumber}: +${result.results.bindings.length} rows (total ${bindings.length})`);
    } catch (error) {
      console.warn(`    batch ${batchNumber}: failed (${(error as Error).message}); skipping.`);
    }
    if (i + BATCH_SIZE < ids.length) await sleep(BATCH_DELAY_MS);
  }

  return { head: { vars }, results: { bindings } };
}
