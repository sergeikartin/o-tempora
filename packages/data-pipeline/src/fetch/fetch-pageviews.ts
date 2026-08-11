import fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateEnrichedEventsFile } from "./fetch-events-enrichment.js";
import { validateEnrichedWarsFile } from "./fetch-wars-enrichment.js";
import { batchedPageviewsFetch } from "./batched-pageviews-fetch.js";
import type { PageviewsLanguage } from "./pageviews-languages.js";
import type { Lane } from "./lane.js";

const RAW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "raw");

// People has no pageviews stage — Score's People path uses Pantheon HPI
// directly, untouched by ADR 0010.
export type PageviewsLane = Exclude<Lane, "people">;
const PAGEVIEWS_LANES: readonly PageviewsLane[] = ["wars", "discoveries"];

interface PageviewsEntry {
  id: string;
  articleUrls: Partial<Record<PageviewsLanguage, string>>;
}

async function loadWarsPageviewsEntries(): Promise<PageviewsEntry[]> {
  const enrichedWars = validateEnrichedWarsFile(
    JSON.parse(await fsPromises.readFile(path.join(RAW_DIR, "wars-curated-enriched.raw.json"), "utf8")),
  );
  return enrichedWars.wars.map((war) => ({ id: war.id, articleUrls: war.articleUrls }));
}

async function loadDiscoveriesPageviewsEntries(): Promise<PageviewsEntry[]> {
  const enrichedEvents = validateEnrichedEventsFile(
    JSON.parse(await fsPromises.readFile(path.join(RAW_DIR, "events-curated-enriched.raw.json"), "utf8")),
  );
  return enrichedEvents.events.map((event) => ({ id: event.id, articleUrls: event.articleUrls }));
}

const LOAD_PAGEVIEWS_ENTRIES: Record<PageviewsLane, () => Promise<PageviewsEntry[]>> = {
  wars: loadWarsPageviewsEntries,
  discoveries: loadDiscoveriesPageviewsEntries,
};

// Reads the wars/events enriched raw files (now widened with per-language
// sitelink article URLs — see wars-enrichment.ts's/events-enrichment.ts's
// articleUrls fields) and, for every curated Wars/Discoveries entity, sums
// trailing-4-year monthly Wikimedia pageviews across the fixed 7-language
// basket via a new REST client (pageviews-client.ts) — the data-acquisition
// half of ADR 0010's fameScore blend (packages/data-pipeline/docs/adr/
// 0010-blend-sitelinks-and-pageviews-for-wars-discoveries-fame-score.md).
// Ordered in fetch/index.ts after fetchWarsEnrichment/fetchEventsEnrichment,
// since it depends on their (now-widened) output being on disk — same
// dependency shape fetchImageAttribution already has on those two stages.
//
// A lane arg scopes the whole pass to one lane; omitted runs both
// concurrently (each already paces its own requests internally via
// batched-pageviews-fetch.ts's BATCH_DELAY_MS, same reasoning
// fetchImageAttribution's concurrent Promise.all uses) — same behavior as
// before this stage was lane-scoped.
export async function fetchPageviews(lane?: PageviewsLane): Promise<void> {
  const lanes = lane ? [lane] : PAGEVIEWS_LANES;
  await Promise.all(
    lanes.map(async (l) => {
      const entries = await LOAD_PAGEVIEWS_ENTRIES[l]();
      console.log(`Fetching trailing-4-year pageviews for ${entries.length} curated ${l}...`);
      const pageviews = await batchedPageviewsFetch(entries);
      const outputPath = path.join(RAW_DIR, `${l}-pageviews.raw.json`);
      await fsPromises.writeFile(outputPath, JSON.stringify(Object.fromEntries(pageviews), null, 2));
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
