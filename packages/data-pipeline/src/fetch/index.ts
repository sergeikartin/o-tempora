import { fetchPantheon } from "./fetch-pantheon.js";
import { fetchDescriptions } from "./fetch-descriptions.js";
import { fetchReigns } from "./fetch-reigns.js";
import { fetchEvents } from "./fetch-events.js";

async function main(): Promise<void> {
  await fetchPantheon();
  // Both depend on people-pantheon.raw.csv already being on disk (each
  // reads the HPI-filtered candidate wd_id list back out of it) — must run
  // after fetchPantheon().
  await fetchDescriptions();
  await fetchReigns();
  await fetchEvents();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
