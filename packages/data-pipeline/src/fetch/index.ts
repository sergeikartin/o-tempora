import { fetchPantheon } from "./fetch-pantheon.js";
import { fetchTaglines } from "./fetch-taglines.js";
import { fetchMilestonesEnrichment } from "./fetch-milestones-enrichment.js";
import { fetchConflictsEnrichment } from "./fetch-conflicts-enrichment.js";
import { fetchImageAttribution } from "./fetch-image-attribution.js";
import { fetchPageviews } from "./fetch-pageviews.js";
import { fetchWikipediaExtracts } from "./fetch-wikipedia-extracts.js";
import { parseLaneFlag, type Lane } from "./lane.js";

// Depends on people-pantheon.raw.csv already being on disk (fetchTaglines
// reads the HPI-filtered candidate wd_id list back out of it) — must run
// after fetchPantheon(). People has no pageviews stage (Score's People path
// uses Pantheon HPI directly, untouched by ADR 0010).
async function fetchPeopleLane(): Promise<void> {
  await fetchPantheon();
  await fetchTaglines();
  await fetchImageAttribution("people");
  await fetchWikipediaExtracts("people");
}

async function fetchConflictsLane(): Promise<void> {
  await fetchConflictsEnrichment();
  await fetchImageAttribution("conflicts");
  await fetchPageviews("conflicts");
  await fetchWikipediaExtracts("conflicts");
}

async function fetchMilestonesLane(): Promise<void> {
  await fetchMilestonesEnrichment();
  await fetchImageAttribution("milestones");
  await fetchPageviews("milestones");
  await fetchWikipediaExtracts("milestones");
}

const LANE_RUNNERS: Record<Lane, () => Promise<void>> = {
  people: fetchPeopleLane,
  conflicts: fetchConflictsLane,
  milestones: fetchMilestonesLane,
};

// No `--lane` flag: today's unchanged behavior and timing — all three
// lanes, same order as before this pipeline was lane-scoped. Deliberately
// not composed from fetchPeopleLane/fetchConflictsLane/fetchMilestonesLane
// above: those call fetchImageAttribution/fetchPageviews/
// fetchWikipediaExtracts scoped to one lane at a time, which would
// serialize what these three stages otherwise run concurrently across all
// three lanes internally (see each stage's own comments) — a real
// wall-clock regression for the common "fetch everything" case. Calling
// each stage once, unscoped, keeps that concurrency intact.
async function fetchAllLanes(): Promise<void> {
  await fetchPantheon();
  // Depends on people-pantheon.raw.csv already being on disk (reads the
  // HPI-filtered candidate wd_id list back out of it) — must run after
  // fetchPantheon().
  await fetchTaglines();
  // Both read a checked-in curated list, independent of the above and of
  // each other — ordered last just to keep the log output grouped by lane.
  await fetchMilestonesEnrichment();
  await fetchConflictsEnrichment();
  // Depends on fetchTaglines', fetchMilestonesEnrichment's, and
  // fetchConflictsEnrichment's raw output already being on disk (each now
  // carries a P18 image URI) — must run after all three.
  await fetchImageAttribution();
  // Depends on fetchMilestonesEnrichment's/fetchConflictsEnrichment's raw output
  // being on disk (each now carries per-language sitelink article URLs) —
  // must run after both. Independent of fetchImageAttribution, but ordered
  // after it just to keep the log output grouped by "depends on
  // enrichment" stages.
  await fetchPageviews();
  // Depends on people-pantheon.raw.csv (People's slug source) and
  // fetchMilestonesEnrichment's/fetchConflictsEnrichment's wikipediaUrl output —
  // ordered last since it's by far the slowest stage (~2 req/sec, paced
  // one entity at a time across all three lanes combined; see
  // batched-wikipedia-extract-fetch.ts) and every other stage's raw output
  // it depends on is already on disk well before this point.
  await fetchWikipediaExtracts();
}

async function main(): Promise<void> {
  const lane = parseLaneFlag(process.argv.slice(2));
  await (lane ? LANE_RUNNERS[lane] : fetchAllLanes)();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
