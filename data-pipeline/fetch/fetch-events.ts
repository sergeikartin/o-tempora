import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAllPages } from "./wikidata-client.js";
import { buildHistoricalEventsQuery } from "./queries/historical-events.js";
import { buildInventionsQuery } from "./queries/inventions.js";

const PAGE_SIZE = 500;
const MAX_PAGES = 10;
const RAW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "raw");

// Wars/battles/treaties and inventions/discoveries come from two structurally
// different SPARQL queries (different classification signals, different
// variable sets). Each is written as its own untouched raw snapshot rather
// than combined into one file — combining them here would mean Fetch is
// reshaping data, which Invariant 8 reserves for Transform.
export async function fetchEvents(): Promise<void> {
  await mkdir(RAW_DIR, { recursive: true });

  console.log("Fetching candidate historical events (wars, battles, treaties, ...) from the Wikidata Query Service...");
  const historicalEvents = await fetchAllPages(buildHistoricalEventsQuery, PAGE_SIZE, MAX_PAGES);
  const historicalEventsPath = path.join(RAW_DIR, "events-historical.raw.json");
  await writeFile(historicalEventsPath, JSON.stringify(historicalEvents, null, 2));
  console.log(`Wrote ${historicalEvents.results.bindings.length} rows to ${historicalEventsPath}`);

  console.log("Fetching candidate inventions/discoveries from the Wikidata Query Service...");
  const inventions = await fetchAllPages(buildInventionsQuery, PAGE_SIZE, MAX_PAGES);
  const inventionsPath = path.join(RAW_DIR, "events-inventions.raw.json");
  await writeFile(inventionsPath, JSON.stringify(inventions, null, 2));
  console.log(`Wrote ${inventions.results.bindings.length} rows to ${inventionsPath}`);
}
