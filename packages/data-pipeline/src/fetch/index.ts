import { fetchPantheon } from "./fetch-pantheon.js";
import { fetchTaglines } from "./fetch-taglines.js";
import { fetchReigns } from "./fetch-reigns.js";
import { fetchEventsEnrichment } from "./fetch-events-enrichment.js";
import { fetchWarsEnrichment } from "./fetch-wars-enrichment.js";
import { fetchImageAttribution } from "./fetch-image-attribution.js";
import { fetchPageviews } from "./fetch-pageviews.js";
import { fetchWikipediaExtracts } from "./fetch-wikipedia-extracts.js";

async function main(): Promise<void> {
  await fetchPantheon();
  // Both depend on people-pantheon.raw.csv already being on disk (each
  // reads the HPI-filtered candidate wd_id list back out of it) — must run
  // after fetchPantheon().
  await fetchTaglines();
  await fetchReigns();
  // Both read a checked-in curated list, independent of the above and of
  // each other — ordered last just to keep the log output grouped by lane.
  await fetchEventsEnrichment();
  await fetchWarsEnrichment();
  // Depends on fetchTaglines', fetchEventsEnrichment's, and
  // fetchWarsEnrichment's raw output already being on disk (each now
  // carries a P18 image URI) — must run after all three.
  await fetchImageAttribution();
  // Depends on fetchEventsEnrichment's/fetchWarsEnrichment's raw output
  // being on disk (each now carries per-language sitelink article URLs) —
  // must run after both. Independent of fetchImageAttribution, but ordered
  // after it just to keep the log output grouped by "depends on
  // enrichment" stages.
  await fetchPageviews();
  // Depends on people-pantheon.raw.csv (People's slug source) and
  // fetchEventsEnrichment's/fetchWarsEnrichment's wikipediaUrl output —
  // ordered last since it's by far the slowest stage (~2 req/sec, paced
  // one entity at a time across all three lanes combined; see
  // batched-wikipedia-extract-fetch.ts) and every other stage's raw output
  // it depends on is already on disk well before this point. Not yet
  // consumed by Transform/Output/the web app — this ticket only produces
  // and persists the raw wikipedia-extracts.raw.json file.
  await fetchWikipediaExtracts();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
