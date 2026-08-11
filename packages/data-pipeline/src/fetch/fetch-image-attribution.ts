import fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSparqlResultShape } from "./validate-sparql-result.js";
import { validateEnrichedEventsFile } from "./fetch-events-enrichment.js";
import { validateEnrichedWarsFile } from "./fetch-wars-enrichment.js";
import { batchedCommonsImageAttributionFetch } from "./batched-commons-image-attribution-fetch.js";
import { LANES, type Lane } from "./lane.js";

const RAW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "raw");

const ENTITY_URI_PATTERN = /\/entity\/(Q\d+)$/;

function extractQid(uri: string): string | undefined {
  return ENTITY_URI_PATTERN.exec(uri)?.[1];
}

interface ImageEntry {
  id: string;
  imageUri: string;
}

async function loadPeopleImageEntries(): Promise<ImageEntry[]> {
  const taglinesRaw = validateSparqlResultShape(
    JSON.parse(await fsPromises.readFile(path.join(RAW_DIR, "people-taglines.raw.json"), "utf8")),
  );
  return taglinesRaw.results.bindings
    .map((row) => {
      const personUri = row.person?.value;
      const imageUri = row.image?.value;
      const id = personUri ? extractQid(personUri) : undefined;
      return id && imageUri ? { id, imageUri } : undefined;
    })
    .filter((entry): entry is ImageEntry => entry !== undefined);
}

async function loadWarsImageEntries(): Promise<ImageEntry[]> {
  const enrichedWars = validateEnrichedWarsFile(
    JSON.parse(await fsPromises.readFile(path.join(RAW_DIR, "wars-curated-enriched.raw.json"), "utf8")),
  );
  return enrichedWars.wars
    .filter((war): war is typeof war & { image: string } => Boolean(war.image))
    .map((war) => ({ id: war.id, imageUri: war.image }));
}

async function loadDiscoveriesImageEntries(): Promise<ImageEntry[]> {
  const enrichedEvents = validateEnrichedEventsFile(
    JSON.parse(await fsPromises.readFile(path.join(RAW_DIR, "events-curated-enriched.raw.json"), "utf8")),
  );
  return enrichedEvents.events
    .filter((event): event is typeof event & { image: string } => Boolean(event.image))
    .map((event) => ({ id: event.id, imageUri: event.image }));
}

const LOAD_IMAGE_ENTRIES: Record<Lane, () => Promise<ImageEntry[]>> = {
  people: loadPeopleImageEntries,
  wars: loadWarsImageEntries,
  discoveries: loadDiscoveriesImageEntries,
};

// Reads the raw files fetch-taglines.ts/fetch-events-enrichment.ts/
// fetch-wars-enrichment.ts already wrote (each now carrying a raw P18
// `image` URI) and, for every entity that resolved an image, runs a second
// batched Commons `imageinfo` pass to resolve `imageAttribution`
// (dynamic-tooltips spec §4.2) — a distinct MediaWiki REST API from
// Wikidata SPARQL, so this is new fetch machinery, not a reuse of
// batched-sparql-fetch.ts. Ordered after all three in fetch/index.ts, since
// it depends on their output being on disk.
//
// A lane arg scopes the whole pass (source file read, Commons fetch, raw
// file written) to one lane; omitted runs all three lanes concurrently
// (each already paces its own requests internally via
// batched-commons-image-attribution-fetch.ts's BATCH_DELAY_MS, so awaiting
// them one at a time would only add wall-clock time, not correctness or
// rate-limit safety) — same behavior as before this stage was lane-scoped.
export async function fetchImageAttribution(lane?: Lane): Promise<void> {
  const lanes = lane ? [lane] : LANES;
  await Promise.all(
    lanes.map(async (l) => {
      const entries = await LOAD_IMAGE_ENTRIES[l]();
      console.log(`Fetching Commons attribution for ${entries.length} ${l} images...`);
      const attribution = await batchedCommonsImageAttributionFetch(entries);
      const outputPath = path.join(RAW_DIR, `${l}-image-attribution.raw.json`);
      await fsPromises.writeFile(outputPath, JSON.stringify(Object.fromEntries(attribution), null, 2));
      console.log(`Wrote ${attribution.size} ${l} attributions to ${outputPath}`);
    }),
  );
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  fetchImageAttribution().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
