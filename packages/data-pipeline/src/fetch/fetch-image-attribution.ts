import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSparqlResultShape } from "./validate-sparql-result.js";
import { validateEnrichedEventsFile } from "./fetch-events-enrichment.js";
import { validateEnrichedWarsFile } from "./fetch-wars-enrichment.js";
import { batchedCommonsImageAttributionFetch } from "./batched-commons-image-attribution-fetch.js";

const RAW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "raw");

const ENTITY_URI_PATTERN = /\/entity\/(Q\d+)$/;

function extractQid(uri: string): string | undefined {
  return ENTITY_URI_PATTERN.exec(uri)?.[1];
}

// Reads the raw files fetch-descriptions.ts/fetch-events-enrichment.ts/
// fetch-wars-enrichment.ts already wrote (each now carrying a raw P18
// `image` URI) and, for every entity that resolved an image, runs a second
// batched Commons `imageinfo` pass to resolve `imageAttribution`
// (dynamic-tooltips spec §4.2) — a distinct MediaWiki REST API from
// Wikidata SPARQL, so this is new fetch machinery, not a reuse of
// batched-sparql-fetch.ts. Ordered after all three in fetch/index.ts, since
// it depends on their output being on disk.
export async function fetchImageAttribution(): Promise<void> {
  const descriptionsRaw = validateSparqlResultShape(
    JSON.parse(await readFile(path.join(RAW_DIR, "people-descriptions.raw.json"), "utf8")),
  );
  const peopleEntries = descriptionsRaw.results.bindings
    .map((row) => {
      const personUri = row.person?.value;
      const imageUri = row.image?.value;
      const id = personUri ? extractQid(personUri) : undefined;
      return id && imageUri ? { id, imageUri } : undefined;
    })
    .filter((entry): entry is { id: string; imageUri: string } => entry !== undefined);

  const enrichedEvents = validateEnrichedEventsFile(
    JSON.parse(await readFile(path.join(RAW_DIR, "events-curated-enriched.raw.json"), "utf8")),
  );
  const discoveryEntries = enrichedEvents.events
    .filter((event): event is typeof event & { image: string } => Boolean(event.image))
    .map((event) => ({ id: event.id, imageUri: event.image }));

  const enrichedWars = validateEnrichedWarsFile(
    JSON.parse(await readFile(path.join(RAW_DIR, "wars-curated-enriched.raw.json"), "utf8")),
  );
  const warsEntries = enrichedWars.wars
    .filter((war): war is typeof war & { image: string } => Boolean(war.image))
    .map((war) => ({ id: war.id, imageUri: war.image }));

  console.log(`Fetching Commons attribution for ${peopleEntries.length} people images...`);
  console.log(`Fetching Commons attribution for ${discoveryEntries.length} discovery images...`);
  console.log(`Fetching Commons attribution for ${warsEntries.length} wars images...`);
  // Three independent batched Commons passes, run concurrently rather than
  // sequentially — each already paces its own requests internally
  // (batched-commons-image-attribution-fetch.ts's BATCH_DELAY_MS), so
  // awaiting them one at a time would only add wall-clock time, not
  // correctness or rate-limit safety.
  const [peopleAttribution, discoveriesAttribution, warsAttribution] = await Promise.all([
    batchedCommonsImageAttributionFetch(peopleEntries),
    batchedCommonsImageAttributionFetch(discoveryEntries),
    batchedCommonsImageAttributionFetch(warsEntries),
  ]);

  const output = {
    people: Object.fromEntries(peopleAttribution),
    discoveries: Object.fromEntries(discoveriesAttribution),
    wars: Object.fromEntries(warsAttribution),
  };

  const outputPath = path.join(RAW_DIR, "image-attribution.raw.json");
  await writeFile(outputPath, JSON.stringify(output, null, 2));
  console.log(
    `Wrote ${peopleAttribution.size} people + ${discoveriesAttribution.size} discovery + ${warsAttribution.size} wars attributions to ${outputPath}`,
  );
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  fetchImageAttribution().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
