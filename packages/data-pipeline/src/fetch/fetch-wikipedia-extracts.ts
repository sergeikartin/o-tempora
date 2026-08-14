import fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MIN_HPI } from "./queries/min-hpi.js";
import { parsePantheonCsv } from "./pantheon-row-shape.js";
import { validateEnrichedConflictsFile } from "./fetch-conflicts-enrichment.js";
import { validateEnrichedMilestonesFile } from "./fetch-milestones-enrichment.js";
import { validateSparqlResultShape } from "./validate-sparql-result.js";
import { extractWikipediaArticleTitle } from "./batched-pageviews-fetch.js";
import { batchedWikipediaExtractFetch, type WikipediaExtractEntry } from "./batched-wikipedia-extract-fetch.js";
import type { WikipediaLanguage } from "./wikipedia-client.js";
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

const ENTITY_URI_PATTERN = /\/entity\/(Q\d+)$/;

function extractQid(uri: string): string | undefined {
  return ENTITY_URI_PATTERN.exec(uri)?.[1];
}

// People's Russian article title has no CSV-column equivalent to
// loadPeopleEntries' Pantheon slug — it comes back as ?articleRu on
// queries/taglines.ts's own enrichment query (the only per-language
// article title People fetches; Conflicts/Milestones already have one for
// every pageviews-basket language, "ru" included, via their own enrichment
// pass — see loadConflictsEntriesRu/loadMilestonesEntriesRu below). Reads
// fetch-taglines.ts's raw SPARQL output back in, the same "raw file is the
// handoff" pattern loadPeopleEntries already uses for Pantheon's CSV.
async function loadPeopleEntriesRu(): Promise<WikipediaExtractEntry[]> {
  const raw = validateSparqlResultShape(
    JSON.parse(await fsPromises.readFile(path.join(RAW_DIR, "people-taglines.raw.json"), "utf8")),
  );
  const seen = new Set<string>();
  const entries: WikipediaExtractEntry[] = [];
  for (const row of raw.results.bindings) {
    const personUri = row.person?.value;
    const articleUrl = row.articleRu?.value;
    if (!personUri || !articleUrl) continue;
    const id = extractQid(personUri);
    if (!id || seen.has(id)) continue;
    const title = extractWikipediaArticleTitle(articleUrl);
    if (!title) continue;
    seen.add(id);
    entries.push({ id, title });
  }
  return entries;
}

async function loadConflictsEntriesRu(): Promise<WikipediaExtractEntry[]> {
  const enrichedPath = path.join(RAW_DIR, "conflicts-curated-enriched.raw.json");
  const { conflicts } = validateEnrichedConflictsFile(JSON.parse(await fsPromises.readFile(enrichedPath, "utf8")));
  const entries: WikipediaExtractEntry[] = [];
  for (const conflict of conflicts) {
    const articleUrlRu = conflict.articleUrls.ru;
    if (!articleUrlRu) continue;
    const title = extractWikipediaArticleTitle(articleUrlRu);
    if (title) entries.push({ id: conflict.id, title });
  }
  return entries;
}

async function loadMilestonesEntriesRu(): Promise<WikipediaExtractEntry[]> {
  const enrichedPath = path.join(RAW_DIR, "milestones-curated-enriched.raw.json");
  const { milestones } = validateEnrichedMilestonesFile(JSON.parse(await fsPromises.readFile(enrichedPath, "utf8")));
  const entries: WikipediaExtractEntry[] = [];
  for (const milestone of milestones) {
    const articleUrlRu = milestone.articleUrls.ru;
    if (!articleUrlRu) continue;
    const title = extractWikipediaArticleTitle(articleUrlRu);
    if (title) entries.push({ id: milestone.id, title });
  }
  return entries;
}

const LOAD_EXTRACT_ENTRIES_RU: Record<Lane, () => Promise<WikipediaExtractEntry[]>> = {
  people: loadPeopleEntriesRu,
  conflicts: loadConflictsEntriesRu,
  milestones: loadMilestonesEntriesRu,
};

function toRecord(map: Map<string, string>): Record<string, string> {
  return Object.fromEntries(map);
}

// Runs one language's extract pass across the given lanes — same "prefix
// the id with its lane, merge, then split back apart" shape for both the
// English and Russian passes below, since batchedWikipediaExtractFetch
// paces its titles as one flat list regardless of which lane they came
// from.
async function runExtractPass(
  lanes: readonly Lane[],
  loadEntries: Record<Lane, () => Promise<WikipediaExtractEntry[]>>,
  lang: WikipediaLanguage,
  fileSuffix: string,
): Promise<void> {
  const entriesByLane = new Map(await Promise.all(lanes.map(async (l) => [l, await loadEntries[l]()] as const)));

  console.log(
    `Fetching ${lang} Wikipedia extracts for ${lanes
      .map((l) => `${entriesByLane.get(l)!.length} ${l}`)
      .join(" + ")} (paced ~2/sec, this takes a while)...`,
  );

  const allEntries = lanes.flatMap((l) =>
    entriesByLane.get(l)!.map((entry) => ({ ...entry, id: `${l}:${entry.id}` })),
  );

  const extractByPrefixedId = await batchedWikipediaExtractFetch(allEntries, lang);

  const extractsByLane = new Map<Lane, Map<string, string>>(lanes.map((l) => [l, new Map()]));
  for (const [prefixedId, extract] of extractByPrefixedId) {
    const [laneName, ...rest] = prefixedId.split(":");
    const id = rest.join(":");
    extractsByLane.get(laneName as Lane)?.set(id, extract);
  }

  await Promise.all(
    lanes.map(async (l) => {
      const extracts = extractsByLane.get(l)!;
      const outputPath = path.join(RAW_DIR, `${l}-wikipedia-extracts${fileSuffix}.raw.json`);
      await fsPromises.writeFile(outputPath, JSON.stringify(toRecord(extracts), null, 2));
      console.log(`Wrote ${extracts.size} ${l} ${lang} extracts to ${outputPath}`);
    }),
  );
}

// Fetches a Wikipedia lead-paragraph extract for every People/Conflicts/
// Milestones entity with a resolvable English Wikipedia article, and a
// second, parallel pass against ru.wikipedia.org for whichever of those
// entities also has a resolvable Russian article — the raw foundation for
// the `description` field's per-language fallback (tagline-description-
// split spec, extended for Russian), consumed by transform/index.ts's
// loadRawRecord calls (transformPeople/transformConflicts/
// transformMilestones). Runs after fetchPantheon() (People's slug/
// ?articleRu source via fetch-taglines.ts), fetchConflictsEnrichment(), and
// fetchMilestonesEnrichment() (Conflicts'/Milestones' wikipediaUrl/
// articleUrls.ru source) are already on disk. Materially lower Russian
// coverage than English is expected here — the per-field English fallback
// this ticket introduces exists exactly for that gap, not treated as an
// error.
//
// A lane arg scopes the source-file read and output to one lane; the
// ~2/second courtesy pace (batchedWikipediaExtractFetch) is preserved
// within that lane-scoped run, per language pass. Omitted, all three
// lanes' entries are paced together in one sequential run per language
// rather than three concurrent ones — this is a real global ceiling only
// when lane-scoped fetches also aren't run concurrently in separate
// processes (see the "don't run concurrent lane fetches" convention,
// packages/data-pipeline/CLAUDE.md and docs/adr/0012-lane-scoped-fetch.md).
// The English and Russian passes themselves run sequentially, not
// concurrently, for the same reason.
export async function fetchWikipediaExtracts(lane?: Lane): Promise<void> {
  const lanes: readonly Lane[] = lane ? [lane] : LANES;
  await runExtractPass(lanes, LOAD_EXTRACT_ENTRIES, "en", "");
  await runExtractPass(lanes, LOAD_EXTRACT_ENTRIES_RU, "ru", ".ru");
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  fetchWikipediaExtracts().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
