import { fetchPantheon } from "./fetch-pantheon.js";
import { fetchDescriptions } from "./fetch-descriptions.js";
import { fetchEvents } from "./fetch-events.js";

// fetchReigns() is deliberately not called here — it reads people.raw.json
// (the old Wikidata-format people snapshot), which no longer exists now
// that People is sourced from Pantheon. Its query mechanism itself is
// unchanged and still valid; only its input Q-ID source needs to switch
// to Pantheon's retained wd_id column, tracked as a separate follow-up
// (People: reign-period secondary enrichment,
// .scratch/alt-data-sources/issues/19-people-reign-periods-enrichment.md).
async function main(): Promise<void> {
  await fetchPantheon();
  // Depends on people-pantheon.raw.csv already being on disk (reads the
  // HPI-filtered candidate wd_id list back out of it) — must run after
  // fetchPantheon().
  await fetchDescriptions();
  await fetchEvents();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
