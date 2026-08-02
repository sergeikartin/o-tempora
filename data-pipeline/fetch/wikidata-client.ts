import { validateSparqlResultShape } from "./validate-sparql-result.js";
import type { SparqlResults } from "./sparql-result-shape.js";

const ENDPOINT = "https://query.wikidata.org/sparql";

// Wikidata asks all query traffic to identify itself; an unidentified or
// generic User-Agent is more likely to be throttled.
const USER_AGENT =
  "same-sky-data-pipeline/0.1 (personal project; contact sergei.kartin@gmail.com)";

const MAX_RETRIES = 3;
const PAGE_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const REQUEST_TIMEOUT_MS = 30_000;

export async function runSparqlQuery(query: string, attempt = 1): Promise<SparqlResults> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/sparql-results+json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({ query }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (response.status === 429 && attempt <= MAX_RETRIES) {
    const retryAfterHeader = Number(response.headers.get("retry-after"));
    const retryAfterSeconds = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
      ? retryAfterHeader
      : 5 * attempt;
    await sleep(retryAfterSeconds * 1000);
    return runSparqlQuery(query, attempt + 1);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Wikidata Query Service returned HTTP ${response.status}: ${body.slice(0, 500)}`);
  }

  const json: unknown = await response.json();
  return validateSparqlResultShape(json);
}

/**
 * Pages through a query using LIMIT/OFFSET, since a single unbounded request
 * (or an ORDER BY over the full join) reliably times out against a corpus
 * this size. Stops as soon as a page comes back short of pageSize.
 *
 * OFFSET cost on the query service grows with depth (no index-assisted skip
 * for an arbitrary FILTER), so deep pages can time out even though shallow
 * ones are fast. Once at least one page has succeeded, a failed deeper page
 * is treated as "pool exhausted for practical purposes" rather than a fatal
 * error — it stops paging and keeps what was already collected.
 */
export async function fetchAllPages(
  buildQuery: (limit: number, offset: number) => string,
  pageSize: number,
  maxPages: number,
): Promise<SparqlResults> {
  let vars: string[] = [];
  const bindings: SparqlResults["results"]["bindings"] = [];

  for (let page = 0; page < maxPages; page++) {
    const offset = page * pageSize;

    let result: SparqlResults;
    try {
      result = await runSparqlQuery(buildQuery(pageSize, offset));
    } catch (error) {
      if (bindings.length > 0) {
        console.warn(
          `    page ${page + 1}: failed (${(error as Error).message}); stopping with ${bindings.length} rows collected so far.`,
        );
        break;
      }
      throw error;
    }

    vars = result.head.vars;
    bindings.push(...result.results.bindings);
    console.log(`    page ${page + 1}: +${result.results.bindings.length} rows (total ${bindings.length})`);

    if (result.results.bindings.length < pageSize) {
      break;
    }
    await sleep(PAGE_DELAY_MS);
  }

  return { head: { vars }, results: { bindings } };
}
