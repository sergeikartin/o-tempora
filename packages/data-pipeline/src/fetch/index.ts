import { fetchConflictsEnrichment } from './fetch-conflicts-enrichment.js';
import { fetchImageAttribution } from './fetch-image-attribution.js';
import { fetchMilestonesEnrichment } from './fetch-milestones-enrichment.js';
import { fetchPageviews } from './fetch-pageviews.js';
import { fetchPantheon } from './fetch-pantheon.js';
import { fetchTaglines } from './fetch-taglines.js';
import { fetchWikipediaExtracts } from './fetch-wikipedia-extracts.js';
import { type Lane, parseLaneFlag } from './lane.js';
import { parseQidsFlag, type QidFilter } from './qid-filter.js';

// Tagline enrichment reads the Pantheon snapshot from disk.
async function fetchPeopleLane(qids: QidFilter): Promise<void> {
  // A QID-scoped run reuses the Pantheon CSV already on disk.
  if (!qids) await fetchPantheon();
  await fetchTaglines(qids);
  await fetchImageAttribution('people', qids);
  await fetchWikipediaExtracts('people', qids);
}

async function fetchConflictsLane(qids: QidFilter): Promise<void> {
  await fetchConflictsEnrichment(qids);
  await fetchImageAttribution('conflicts', qids);
  await fetchPageviews('conflicts', qids);
  await fetchWikipediaExtracts('conflicts', qids);
}

async function fetchMilestonesLane(qids: QidFilter): Promise<void> {
  await fetchMilestonesEnrichment(qids);
  await fetchImageAttribution('milestones', qids);
  await fetchPageviews('milestones', qids);
  await fetchWikipediaExtracts('milestones', qids);
}

const LANE_RUNNERS: Record<Lane, (qids: QidFilter) => Promise<void>> = {
  people: fetchPeopleLane,
  conflicts: fetchConflictsLane,
  milestones: fetchMilestonesLane,
};

// Run each stage once across all lanes so each stage can manage request concurrency and pacing.
async function fetchAllLanes(qids: QidFilter): Promise<void> {
  if (!qids) await fetchPantheon();
  // Depends on people-pantheon.raw.csv (reads the HPI-filtered wd_id candidates);
  // must run after fetchPantheon().
  await fetchTaglines(qids);
  await fetchMilestonesEnrichment(qids);
  await fetchConflictsEnrichment(qids);
  // Image attribution needs the P18 image URLs written by enrichment.
  await fetchImageAttribution(undefined, qids);
  // Pageviews needs the article URLs written by Conflicts and Milestones enrichment.
  await fetchPageviews(undefined, qids);
  // Extracts need Pantheon’s English slugs and the article URLs written by enrichment.
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
