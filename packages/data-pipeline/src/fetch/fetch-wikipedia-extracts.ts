import fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MIN_HPI } from "./queries/min-hpi.js";
import { parsePantheonCsv } from "./pantheon-row-shape.js";
import { validateEnrichedConflictsFile } from "./fetch-conflicts-enrichment.js";
import { validateEnrichedMilestonesFile } from "./fetch-milestones-enrichment.js";
import { extractWikipediaArticleTitle } from "./batched-pageviews-fetch.js";
import { batchedWikipediaExtractFetch, type WikipediaExtractEntry } from "./batched-wikipedia-extract-fetch.js";
import { LANES, type Lane } from "./lane.js";

const RAW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "raw");

// People's article title comes straight from Pantheon's own `slug` column
// (no enrichment/SPARQL round-trip needed to resolve it — unlike Conflicts/
// Milestones, whose titles are recovered from their enrichment pass's
// wikipediaUrl via extractWikipediaArticleTitle). Filtered to MIN_HPI, same
// floor fetch-taglines.ts/fetch-reigns.ts apply for the same reason:
// anything below it never survives Score. Keyed by wdId, matching this
// lane's other enrichment maps (loadPeopleEnrichmentMap in
// transform/index.ts) rather than Pantheon's own id.
async function loadPeopleEntries(): Promise<WikipediaExtractEntry[]> {
  const csvPath = path.join(RAW_DIR, "people-pantheon.raw.csv");
  const rows = parsePantheonCsv(await fsPromises.readFile(csvPath, "utf8"));
  const seen = new Set<string>();
  const entries: WikipediaExtractEntry[] = [];
  for (const row of rows) {
    if (row.hpi < MIN_HPI || seen.has(row.wdId)) continue;
    seen.add(row.wdId);
    entries.push({ id: row.wdId, title: row.slug });
  }
  return entries;
}

async function loadConflictsEntries(): Promise<WikipediaExtractEntry[]> {
  const enrichedPath = path.join(RAW_DIR, "conflicts-curated-enriched.raw.json");
  const { conflicts } = validateEnrichedConflictsFile(JSON.parse(await fsPromises.readFile(enrichedPath, "utf8")));
  const entries: WikipediaExtractEntry[] = [];
  for (const conflict of conflicts) {
    if (!conflict.wikipediaUrl) continue;
    const title = extractWikipediaArticleTitle(conflict.wikipediaUrl);
    if (title) entries.push({ id: conflict.id, title });
  }
  return entries;
}

async function loadMilestonesEntries(): Promise<WikipediaExtractEntry[]> {
  const enrichedPath = path.join(RAW_DIR, "milestones-curated-enriched.raw.json");
  const { milestones } = validateEnrichedMilestonesFile(JSON.parse(await fsPromises.readFile(enrichedPath, "utf8")));
  const entries: WikipediaExtractEntry[] = [];
  for (const milestone of milestones) {
    if (!milestone.wikipediaUrl) continue;
    const title = extractWikipediaArticleTitle(milestone.wikipediaUrl);
    if (title) entries.push({ id: milestone.id, title });
  }
  return entries;
}

const LOAD_EXTRACT_ENTRIES: Record<Lane, () => Promise<WikipediaExtractEntry[]>> = {
  people: loadPeopleEntries,
  conflicts: loadConflictsEntries,
  milestones: loadMilestonesEntries,
};

function toRecord(map: Map<string, string>): Record<string, string> {
  return Object.fromEntries(map);
}

// Fetches a Wikipedia lead-paragraph extract for every People/Conflicts/
// Milestones entity with a resolvable English Wikipedia article — the raw
// foundation for the `description` field (tagline-description-split
// spec), consumed by transform/index.ts's loadWikipediaExtractsFile calls
// (transformPeople/transformConflicts/transformMilestones). Runs after
// fetchPantheon() (People's slug source), fetchConflictsEnrichment(), and
// fetchMilestonesEnrichment() (Conflicts'/Milestones' wikipediaUrl source) are
// already on disk.
//
// A lane arg scopes the source-file read and output to one lane; the
// ~2/second courtesy pace (batchedWikipediaExtractFetch) is preserved
// within that lane-scoped run. Omitted, all three lanes' entries are
// paced together in one sequential run rather than three concurrent ones —
// this is a real global ceiling only when lane-scoped fetches also aren't
// run concurrently in separate processes (see the "don't run concurrent
// lane fetches" convention, packages/data-pipeline/CLAUDE.md and
// docs/adr/0012-lane-scoped-fetch.md).
export async function fetchWikipediaExtracts(lane?: Lane): Promise<void> {
  const lanes = lane ? [lane] : LANES;
  const entriesByLane = new Map(
    await Promise.all(lanes.map(async (l) => [l, await LOAD_EXTRACT_ENTRIES[l]()] as const)),
  );

  console.log(
    `Fetching Wikipedia extracts for ${lanes
      .map((l) => `${entriesByLane.get(l)!.length} ${l}`)
      .join(" + ")} (paced ~2/sec, this takes a while)...`,
  );

  const allEntries = lanes.flatMap((l) =>
    entriesByLane.get(l)!.map((entry) => ({ ...entry, id: `${l}:${entry.id}` })),
  );

  const extractByPrefixedId = await batchedWikipediaExtractFetch(allEntries);

  const extractsByLane = new Map<Lane, Map<string, string>>(lanes.map((l) => [l, new Map()]));
  for (const [prefixedId, extract] of extractByPrefixedId) {
    const [laneName, ...rest] = prefixedId.split(":");
    const id = rest.join(":");
    extractsByLane.get(laneName as Lane)?.set(id, extract);
  }

  await Promise.all(
    lanes.map(async (l) => {
      const extracts = extractsByLane.get(l)!;
      const outputPath = path.join(RAW_DIR, `${l}-wikipedia-extracts.raw.json`);
      await fsPromises.writeFile(outputPath, JSON.stringify(toRecord(extracts), null, 2));
      console.log(`Wrote ${extracts.size} ${l} extracts to ${outputPath}`);
    }),
  );
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  fetchWikipediaExtracts().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
