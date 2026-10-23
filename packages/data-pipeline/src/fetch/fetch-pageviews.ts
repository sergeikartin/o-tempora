import fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateEnrichedMilestonesFile } from "./fetch-milestones-enrichment.js";
import { validateEnrichedConflictsFile } from "./fetch-conflicts-enrichment.js";
import { batchedPageviewsFetch } from "./batched-pageviews-fetch.js";
import { filterByQids, writeRecordFile, type QidFilter } from "./qid-filter.js";
import type { PageviewsLanguage } from "./pageviews-languages.js";
import type { Lane } from "./lane.js";

const RAW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "raw");

// People has no pageviews stage: Score's People path uses Pantheon HPI directly
// (docs/adr/0010).
export type PageviewsLane = Exclude<Lane, "people">;
const PAGEVIEWS_LANES: readonly PageviewsLane[] = ["conflicts", "milestones"];

interface PageviewsEntry {
  id: string;
  articleUrls: Partial<Record<PageviewsLanguage, string>>;
}

async function loadConflictsPageviewsEntries(): Promise<PageviewsEntry[]> {
  const enrichedConflicts = validateEnrichedConflictsFile(
    JSON.parse(await fsPromises.readFile(path.join(RAW_DIR, "conflicts-curated-enriched.raw.json"), "utf8")),
  );
  return enrichedConflicts.conflicts.map((conflict) => ({ id: conflict.id, articleUrls: conflict.articleUrls }));
}

async function loadMilestonesPageviewsEntries(): Promise<PageviewsEntry[]> {
  const enrichedMilestones = validateEnrichedMilestonesFile(
    JSON.parse(await fsPromises.readFile(path.join(RAW_DIR, "milestones-curated-enriched.raw.json"), "utf8")),
  );
  return enrichedMilestones.milestones.map((milestone) => ({ id: milestone.id, articleUrls: milestone.fameArticleUrls ?? milestone.articleUrls }));
}

const LOAD_PAGEVIEWS_ENTRIES: Record<PageviewsLane, () => Promise<PageviewsEntry[]>> = {
  conflicts: loadConflictsPageviewsEntries,
  milestones: loadMilestonesPageviewsEntries,
};

// Reads the enriched Conflicts/Milestones raw files (with per-language sitelink
// article URLs, the articleUrls fields) and, for every curated entity, sums
// trailing-4-year monthly Wikimedia pageviews across the fixed 7-language
// basket via pageviews-client.ts: the data-acquisition half of the fameScore
// blend (docs/adr/0010-blend-sitelinks-and-pageviews-for-wars-discoveries-fame-score.md).
// Runs after fetchConflictsEnrichment/fetchMilestonesEnrichment in
// fetch/index.ts, like fetchImageAttribution.
//
// A lane arg scopes the pass to one lane; omitted runs both concurrently, each
// pacing its own requests (batched-pageviews-fetch.ts's BATCH_DELAY_MS, as
// fetchImageAttribution's Promise.all does).
export async function fetchPageviews(lane?: PageviewsLane, qids?: QidFilter): Promise<void> {
  const lanes = lane ? [lane] : PAGEVIEWS_LANES;
  await Promise.all(
    lanes.map(async (l) => {
      const entries = filterByQids(await LOAD_PAGEVIEWS_ENTRIES[l](), qids);
      if (qids && entries.length === 0) return;
      console.log(`Fetching trailing-4-year pageviews for ${entries.length} curated ${l}...`);
      const pageviews = await batchedPageviewsFetch(entries);
      const outputPath = path.join(RAW_DIR, `${l}-pageviews.raw.json`);
      await writeRecordFile(outputPath, pageviews, qids);
      console.log(`Wrote ${pageviews.size} ${l} pageview totals to ${outputPath}`);
    }),
  );
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  fetchPageviews().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
