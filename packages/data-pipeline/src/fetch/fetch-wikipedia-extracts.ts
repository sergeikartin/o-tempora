import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MIN_HPI } from "./queries/min-hpi.js";
import { parsePantheonCsv } from "./pantheon-row-shape.js";
import { validateEnrichedWarsFile } from "./fetch-wars-enrichment.js";
import { validateEnrichedEventsFile } from "./fetch-events-enrichment.js";
import { extractWikipediaArticleTitle } from "./batched-pageviews-fetch.js";
import { batchedWikipediaExtractFetch, type WikipediaExtractEntry } from "./batched-wikipedia-extract-fetch.js";

const RAW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "raw");

export interface WikipediaExtractsFile {
  people: Record<string, string>;
  wars: Record<string, string>;
  discoveries: Record<string, string>;
}

// People's article title comes straight from Pantheon's own `slug` column
// (no enrichment/SPARQL round-trip needed to resolve it — unlike Wars/
// Discoveries, whose titles are recovered from their enrichment pass's
// wikipediaUrl via extractWikipediaArticleTitle). Filtered to MIN_HPI, same
// floor fetch-taglines.ts/fetch-reigns.ts apply for the same reason:
// anything below it never survives Score. Keyed by wdId, matching this
// lane's other enrichment maps (loadPeopleEnrichmentMap in
// transform/index.ts) rather than Pantheon's own id.
async function loadPeopleEntries(): Promise<WikipediaExtractEntry[]> {
  const csvPath = path.join(RAW_DIR, "people-pantheon.raw.csv");
  const rows = parsePantheonCsv(await readFile(csvPath, "utf8"));
  const seen = new Set<string>();
  const entries: WikipediaExtractEntry[] = [];
  for (const row of rows) {
    if (row.hpi < MIN_HPI || seen.has(row.wdId)) continue;
    seen.add(row.wdId);
    entries.push({ id: row.wdId, title: row.slug });
  }
  return entries;
}

async function loadWarsEntries(): Promise<WikipediaExtractEntry[]> {
  const enrichedPath = path.join(RAW_DIR, "wars-curated-enriched.raw.json");
  const { wars } = validateEnrichedWarsFile(JSON.parse(await readFile(enrichedPath, "utf8")));
  const entries: WikipediaExtractEntry[] = [];
  for (const war of wars) {
    if (!war.wikipediaUrl) continue;
    const title = extractWikipediaArticleTitle(war.wikipediaUrl);
    if (title) entries.push({ id: war.id, title });
  }
  return entries;
}

async function loadDiscoveriesEntries(): Promise<WikipediaExtractEntry[]> {
  const enrichedPath = path.join(RAW_DIR, "events-curated-enriched.raw.json");
  const { events } = validateEnrichedEventsFile(JSON.parse(await readFile(enrichedPath, "utf8")));
  const entries: WikipediaExtractEntry[] = [];
  for (const event of events) {
    if (!event.wikipediaUrl) continue;
    const title = extractWikipediaArticleTitle(event.wikipediaUrl);
    if (title) entries.push({ id: event.id, title });
  }
  return entries;
}

function toRecord(map: Map<string, string>): Record<string, string> {
  return Object.fromEntries(map);
}

// Fetches a Wikipedia lead-paragraph extract for every People/Wars/
// Discoveries entity with a resolvable English Wikipedia article — the raw
// foundation for the new `description` field (tagline-description-split
// spec). Runs after fetchPantheon() (People's slug source),
// fetchWarsEnrichment(), and fetchEventsEnrichment() (Wars'/Discoveries'
// wikipediaUrl source) are already on disk. Deliberately paced one request
// at a time across all three lanes combined (batchedWikipediaExtractFetch),
// not run as three separate concurrent passes, so the ~2/second courtesy
// rate is a real global ceiling rather than three lanes each independently
// hitting it. Not yet consumed by Transform/Output or the web app — this
// stage only produces and persists the raw data.
export async function fetchWikipediaExtracts(): Promise<void> {
  const [peopleEntries, warsEntries, discoveriesEntries] = await Promise.all([
    loadPeopleEntries(),
    loadWarsEntries(),
    loadDiscoveriesEntries(),
  ]);

  console.log(
    `Fetching Wikipedia extracts for ${peopleEntries.length} people + ${warsEntries.length} wars + ${discoveriesEntries.length} discoveries (paced ~2/sec, this takes a while)...`,
  );

  const allEntries = [
    ...peopleEntries.map((entry) => ({ ...entry, id: `people:${entry.id}` })),
    ...warsEntries.map((entry) => ({ ...entry, id: `wars:${entry.id}` })),
    ...discoveriesEntries.map((entry) => ({ ...entry, id: `discoveries:${entry.id}` })),
  ];

  const extractByPrefixedId = await batchedWikipediaExtractFetch(allEntries);

  const people = new Map<string, string>();
  const wars = new Map<string, string>();
  const discoveries = new Map<string, string>();
  for (const [prefixedId, extract] of extractByPrefixedId) {
    const [lane, ...rest] = prefixedId.split(":");
    const id = rest.join(":");
    if (lane === "people") people.set(id, extract);
    else if (lane === "wars") wars.set(id, extract);
    else if (lane === "discoveries") discoveries.set(id, extract);
  }

  const output: WikipediaExtractsFile = {
    people: toRecord(people),
    wars: toRecord(wars),
    discoveries: toRecord(discoveries),
  };

  const outputPath = path.join(RAW_DIR, "wikipedia-extracts.raw.json");
  await writeFile(outputPath, JSON.stringify(output, null, 2));
  console.log(
    `Wrote ${people.size} people + ${wars.size} wars + ${discoveries.size} discovery extracts to ${outputPath}`,
  );
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  fetchWikipediaExtracts().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
