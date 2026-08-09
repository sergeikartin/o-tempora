import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DISCOVERY_CATEGORIES, type DiscoveryCategory } from "@same-sky/shared-types";
import { buildEventsEnrichmentQuery } from "./queries/events-enrichment.js";
import { batchedSparqlFetch } from "./batched-sparql-fetch.js";

const RAW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "raw");

interface CuratedEvent {
  id: string;
  name: string;
  year: number;
  category: DiscoveryCategory;
  description: string;
}

interface CuratedEventsFile {
  events: CuratedEvent[];
}

export interface EnrichedEvent {
  id: string;
  name: string;
  year: number;
  category: DiscoveryCategory;
  description: string;
  // Absent means the enrichment pass couldn't resolve this QID (e.g. a
  // stale/redirected id) — Output drops the row rather than guessing (see
  // write-datasets.ts's buildDiscoveries).
  sitelinks?: number;
  wikipediaUrl?: string;
  countries: string[];
  // Raw Wikidata P18 Commons Special:FilePath URI, stored verbatim — absent
  // means no P18 claim (dynamic-tooltips spec §4.1/§4.3).
  image?: string;
}

// Validated at the boundary before Fetch reads it (docs/code-conventions.md's
// "Validate unknown external input... at system boundaries") — the curated
// file is hand-authored, not machine-generated, so a typo'd `category` value
// is a real risk a bare `JSON.parse(...) as CuratedEventsFile` cast would
// silently let through, only to break rendering downstream in EventsLane.
function isCuratedEvent(value: unknown): value is CuratedEvent {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.year === "number" &&
    typeof candidate.description === "string" &&
    typeof candidate.category === "string" &&
    (DISCOVERY_CATEGORIES as readonly string[]).includes(candidate.category)
  );
}

function validateCuratedEventsFile(data: unknown): CuratedEventsFile {
  const events = (data as Record<string, unknown> | null)?.events;
  if (!Array.isArray(events) || !events.every(isCuratedEvent)) {
    throw new Error("events-curated.raw.json is missing a valid events array.");
  }
  return { events };
}

// Same boundary-validation reasoning as validateCuratedEventsFile, applied
// where Transform (transform/index.ts) and the region-tagging maintenance
// script (list-unmapped-countries.ts) read this file back in — it's Fetch's
// own output, but still an external file on disk, same as every other raw
// snapshot this pipeline validates on read (validateSparqlResultShape,
// parsePantheonCsv).
function isEnrichedEvent(value: unknown): value is EnrichedEvent {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.year === "number" &&
    typeof candidate.description === "string" &&
    typeof candidate.category === "string" &&
    (DISCOVERY_CATEGORIES as readonly string[]).includes(candidate.category) &&
    (candidate.sitelinks === undefined || typeof candidate.sitelinks === "number") &&
    (candidate.wikipediaUrl === undefined || typeof candidate.wikipediaUrl === "string") &&
    Array.isArray(candidate.countries) &&
    candidate.countries.every((country) => typeof country === "string") &&
    (candidate.image === undefined || typeof candidate.image === "string")
  );
}

export function validateEnrichedEventsFile(data: unknown): { events: EnrichedEvent[] } {
  const events = (data as Record<string, unknown> | null)?.events;
  if (!Array.isArray(events) || !events.every(isEnrichedEvent)) {
    throw new Error("events-curated-enriched.raw.json is missing a valid events array.");
  }
  return { events };
}

const ENTITY_URI_PATTERN = /\/entity\/(Q\d+)$/;

function extractQid(uri: string): string | undefined {
  return ENTITY_URI_PATTERN.exec(uri)?.[1];
}

interface EnrichmentFields {
  sitelinks?: number;
  wikipediaUrl?: string;
  countries: string[];
  image?: string;
}

// Reads the checked-in curated list (data/raw/events-curated.raw.json) and
// backfills sitelinks/wikipediaUrl/country/image via a batched per-QID
// SPARQL pass (same VALUES-clause pattern as
// fetch-reigns.ts/fetch-descriptions.ts) — dateProperty/source are
// curation-time provenance and are dropped here, not carried into the
// merged output.
export async function fetchEventsEnrichment(): Promise<void> {
  const curatedPath = path.join(RAW_DIR, "events-curated.raw.json");
  const curated = validateCuratedEventsFile(JSON.parse(await readFile(curatedPath, "utf8")));
  const ids = curated.events.map((event) => event.id);

  console.log(`Fetching sitelinks/article/country/image enrichment for ${ids.length} curated events...`);
  const result = await batchedSparqlFetch(ids, buildEventsEnrichmentQuery);

  const enrichmentById = new Map<string, EnrichmentFields>();
  for (const row of result.results.bindings) {
    const eventUri = row.event?.value;
    if (!eventUri) continue;
    const id = extractQid(eventUri);
    if (!id) continue;

    let entry = enrichmentById.get(id);
    if (!entry) {
      entry = { countries: [] };
      enrichmentById.set(id, entry);
    }

    if (entry.sitelinks === undefined && row.sitelinks?.value) entry.sitelinks = Number(row.sitelinks.value);
    if (entry.wikipediaUrl === undefined && row.article?.value) entry.wikipediaUrl = row.article.value;
    if (entry.image === undefined && row.image?.value) entry.image = row.image.value;
    const countryId = row.country?.value ? extractQid(row.country.value) : undefined;
    if (countryId && !entry.countries.includes(countryId)) entry.countries.push(countryId);
  }

  const events: EnrichedEvent[] = curated.events.map((event) => {
    const enrichment = enrichmentById.get(event.id);
    return {
      id: event.id,
      name: event.name,
      year: event.year,
      category: event.category,
      description: event.description,
      sitelinks: enrichment?.sitelinks,
      wikipediaUrl: enrichment?.wikipediaUrl,
      countries: enrichment?.countries ?? [],
      image: enrichment?.image,
    };
  });

  const outputPath = path.join(RAW_DIR, "events-curated-enriched.raw.json");
  await writeFile(outputPath, JSON.stringify({ events }, null, 2));
  console.log(`Wrote ${events.length} enriched events to ${outputPath}`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  fetchEventsEnrichment().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
