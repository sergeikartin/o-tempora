import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateEnrichedEventsFile } from "./fetch-events-enrichment.js";
import { validateEnrichedWarsFile } from "./fetch-wars-enrichment.js";
import { batchedPageviewsFetch } from "./batched-pageviews-fetch.js";

const RAW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "raw");

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
// People are out of scope: Pantheon's HPI scoring is untouched by ADR 0010.
export async function fetchPageviews(): Promise<void> {
  const enrichedWars = validateEnrichedWarsFile(
    JSON.parse(await readFile(path.join(RAW_DIR, "wars-curated-enriched.raw.json"), "utf8")),
  );
  const warsEntries = enrichedWars.wars.map((war) => ({ id: war.id, articleUrls: war.articleUrls }));

  const enrichedEvents = validateEnrichedEventsFile(
    JSON.parse(await readFile(path.join(RAW_DIR, "events-curated-enriched.raw.json"), "utf8")),
  );
  const discoveryEntries = enrichedEvents.events.map((event) => ({ id: event.id, articleUrls: event.articleUrls }));

  console.log(`Fetching trailing-4-year pageviews for ${warsEntries.length} curated wars...`);
  console.log(`Fetching trailing-4-year pageviews for ${discoveryEntries.length} curated discoveries...`);
  // Two independent batched pageviews passes, run concurrently rather than
  // sequentially — each already paces its own requests internally
  // (batched-pageviews-fetch.ts's BATCH_DELAY_MS), same reasoning
  // fetchImageAttribution's concurrent Promise.all uses.
  const [warsPageviews, discoveriesPageviews] = await Promise.all([
    batchedPageviewsFetch(warsEntries),
    batchedPageviewsFetch(discoveryEntries),
  ]);

  const output = {
    wars: Object.fromEntries(warsPageviews),
    discoveries: Object.fromEntries(discoveriesPageviews),
  };

  const outputPath = path.join(RAW_DIR, "pageviews.raw.json");
  await writeFile(outputPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${warsPageviews.size} wars + ${discoveriesPageviews.size} discoveries pageview totals to ${outputPath}`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  fetchPageviews().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
