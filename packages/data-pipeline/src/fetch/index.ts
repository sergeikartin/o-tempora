import { fetchPantheon } from "./fetch-pantheon.js";
import { fetchTaglines } from "./fetch-taglines.js";
import { fetchMilestonesEnrichment } from "./fetch-milestones-enrichment.js";
import { fetchConflictsEnrichment } from "./fetch-conflicts-enrichment.js";
import { fetchImageAttribution } from "./fetch-image-attribution.js";
import { fetchPageviews } from "./fetch-pageviews.js";
import { fetchWikipediaExtracts } from "./fetch-wikipedia-extracts.js";
import { parseLaneFlag, type Lane } from "./lane.js";
import { parseQidsFlag, type QidFilter } from "./qid-filter.js";

// Depends on people-pantheon.raw.csv being on disk (fetchTaglines reads the
// HPI-filtered wd_id candidates from it), so it runs after fetchPantheon().
// People has no pageviews stage: Score's People path uses Pantheon HPI directly
// (docs/adr/0010).
async function fetchPeopleLane(qids: QidFilter): Promise<void> {
  // A QID-scoped run reuses the Pantheon CSV already on disk.
  if (!qids) await fetchPantheon();
  await fetchTaglines(qids);
  await fetchImageAttribution("people", qids);
  await fetchWikipediaExtracts("people", qids);
}

async function fetchConflictsLane(qids: QidFilter): Promise<void> {
  await fetchConflictsEnrichment(qids);
  await fetchImageAttribution("conflicts", qids);
  await fetchPageviews("conflicts", qids);
  await fetchWikipediaExtracts("conflicts", qids);
}

async function fetchMilestonesLane(qids: QidFilter): Promise<void> {
  await fetchMilestonesEnrichment(qids);
  await fetchImageAttribution("milestones", qids);
  await fetchPageviews("milestones", qids);
  await fetchWikipediaExtracts("milestones", qids);
}

const LANE_RUNNERS: Record<Lane, (qids: QidFilter) => Promise<void>> = {
  people: fetchPeopleLane,
  conflicts: fetchConflictsLane,
  milestones: fetchMilestonesLane,
};

// No `--lane` flag: all three lanes. Deliberately not composed from
// fetchPeopleLane/fetchConflictsLane/fetchMilestonesLane above: those scope
// fetchImageAttribution/fetchPageviews/fetchWikipediaExtracts to one lane at a
// time, serializing what these stages otherwise run concurrently across lanes
// (see each stage's comments), a wall-clock regression for the common "fetch
// everything" case. Calling each stage once, unscoped, keeps the concurrency.
async function fetchAllLanes(qids: QidFilter): Promise<void> {
  if (!qids) await fetchPantheon();
  // Depends on people-pantheon.raw.csv (reads the HPI-filtered wd_id candidates);
  // must run after fetchPantheon().
  await fetchTaglines(qids);
  // Both read a checked-in curated list, independent of the above and of each
  // other; ordered last only to group log output by lane.
  await fetchMilestonesEnrichment(qids);
  await fetchConflictsEnrichment(qids);
  // Depends on the raw output of fetchTaglines, fetchMilestonesEnrichment and
  // fetchConflictsEnrichment (each carries a P18 image URI), so runs after all
  // three.
  await fetchImageAttribution(undefined, qids);
  // Depends on fetchMilestonesEnrichment's and fetchConflictsEnrichment's raw
  // output (per-language sitelink article URLs), so runs after both. Independent
  // of fetchImageAttribution; ordered after it to group the "depends on
  // enrichment" stages in the log.
  await fetchPageviews(undefined, qids);
  // Depends on people-pantheon.raw.csv (People's slug source) and the Conflicts/
  // Milestones wikipediaUrl output. Ordered last: by far the slowest stage (~2
  // req/sec, one entity at a time across all three lanes; see
  // batched-wikipedia-extract-fetch.ts), and its inputs are on disk well before.
  await fetchWikipediaExtracts(undefined, qids);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const lane = parseLaneFlag(argv);
  const qids = parseQidsFlag(argv);
  await (lane ? LANE_RUNNERS[lane] : fetchAllLanes)(qids);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
