import { fetchPantheon } from "./fetch-pantheon.js";
import { fetchDescriptions } from "./fetch-descriptions.js";
import { fetchReigns } from "./fetch-reigns.js";
import { fetchHistoricalEvents } from "./fetch-historical-events.js";
import { fetchEventsEnrichment } from "./fetch-events-enrichment.js";

async function main(): Promise<void> {
  await fetchPantheon();
  // Both depend on people-pantheon.raw.csv already being on disk (each
  // reads the HPI-filtered candidate wd_id list back out of it) — must run
  // after fetchPantheon().
  await fetchDescriptions();
  await fetchReigns();
  await fetchHistoricalEvents();
  // Reads the checked-in curated events list, independent of the above —
  // ordered last just to keep the log output grouped by lane.
  await fetchEventsEnrichment();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
