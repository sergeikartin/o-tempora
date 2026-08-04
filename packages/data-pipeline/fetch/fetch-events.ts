import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAllPages } from "./wikidata-client.js";
import { buildHistoricalEventsQuery } from "./queries/historical-events.js";
import { buildInventionsQuery } from "./queries/inventions.js";
import type { SparqlResults } from "./sparql-result-shape.js";

const PAGE_SIZE = 500;

// Per-bucket page cap, same reasoning as the (now-retired) people fetcher's
// MAX_PAGES_PER_BUCKET: generous per bucket while keeping OFFSET depth
// inside the query service's empirically reliable range, now that the
// corpus is split across ERA_BUCKETS instead of one unbounded scan.
const MAX_PAGES_PER_BUCKET = 20;

// Birth/point-in-time-style year buckets ([minYear, maxYearExclusive)),
// fetched independently so every era gets its own page budget — same root
// cause and same bucket boundaries as the people fetcher used before the
// Pantheon switch: with no ORDER BY, the live query service returns matches
// in an order that tracks ascending Wikidata QID, so an unbucketed scan
// starves modern-era rows by exhausting its whole page budget in antiquity.
const ERA_BUCKETS: ReadonlyArray<readonly [number, number]> = [
  [-4000, -800],
  [-800, -400],
  [-400, 1],
  [1, 400],
  [400, 800],
  [800, 1200],
  [1200, 1500],
  [1500, 1600],
  [1600, 1700],
  [1700, 1750],
  [1750, 1800],
  [1800, 1825],
  [1825, 1850],
  [1850, 1875],
  [1875, 1900],
  [1900, 1910],
  [1910, 1920],
  [1920, 1930],
  [1930, 1940],
  [1940, 1950],
  [1950, 1960],
  [1960, 1970],
  [1970, 1980],
  [1980, 1990],
  [1990, 2000],
  [2000, new Date().getUTCFullYear() + 1],
];

const RAW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "raw");

// Fetches one era-bucketed query, tolerating individual bucket failures — a
// bucket's first page failing (live service instability, well documented for
// this endpoint) shouldn't lose every other bucket already collected, so
// each bucket's fetchAllPages call gets its own try/catch, matching the
// per-bucket pattern the (now-retired) people fetcher established and the
// per-batch pattern fetch-reigns.ts/fetch-descriptions.ts still use.
async function fetchBucketed(
  label: string,
  buildQuery: (limit: number, offset: number, minYear: number, maxYearExclusive: number) => string,
): Promise<SparqlResults> {
  let vars: string[] = [];
  const bindings: SparqlResults["results"]["bindings"] = [];

  for (const [minYear, maxYearExclusive] of ERA_BUCKETS) {
    console.log(`  ${label} era ${minYear} to ${maxYearExclusive}:`);
    try {
      const result = await fetchAllPages(
        (limit, offset) => buildQuery(limit, offset, minYear, maxYearExclusive),
        PAGE_SIZE,
        MAX_PAGES_PER_BUCKET,
      );
      if (result.head.vars.length > 0) vars = result.head.vars;
      bindings.push(...result.results.bindings);
    } catch (error) {
      console.warn(`    bucket failed (${(error as Error).message}); skipping.`);
    }
  }

  return { head: { vars }, results: { bindings } };
}

// Wars/battles/treaties and inventions/discoveries come from two structurally
// different SPARQL queries (different classification signals, different
// variable sets). Each is written as its own untouched raw snapshot rather
// than combined into one file — combining them here would mean Fetch is
// reshaping data, which Invariant 8 reserves for Transform.
export async function fetchEvents(): Promise<void> {
  await mkdir(RAW_DIR, { recursive: true });

  console.log("Fetching candidate historical events (wars, battles, treaties, ...) from the Wikidata Query Service, bucketed by era...");
  const historicalEvents = await fetchBucketed("historical events", buildHistoricalEventsQuery);
  const historicalEventsPath = path.join(RAW_DIR, "events-historical.raw.json");
  await writeFile(historicalEventsPath, JSON.stringify(historicalEvents, null, 2));
  console.log(`Wrote ${historicalEvents.results.bindings.length} rows to ${historicalEventsPath}`);

  console.log("Fetching candidate inventions/discoveries from the Wikidata Query Service, bucketed by era...");
  const inventions = await fetchBucketed("inventions", buildInventionsQuery);
  const inventionsPath = path.join(RAW_DIR, "events-inventions.raw.json");
  await writeFile(inventionsPath, JSON.stringify(inventions, null, 2));
  console.log(`Wrote ${inventions.results.bindings.length} rows to ${inventionsPath}`);
}
