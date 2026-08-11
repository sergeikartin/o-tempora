import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MILESTONE_CATEGORIES, type MilestoneCategory } from "@same-sky/shared-types";
import { buildMilestonesEnrichmentQuery } from "./queries/milestones-enrichment.js";
import { batchedSparqlFetch } from "./batched-sparql-fetch.js";
import { PAGEVIEWS_LANGUAGES, articleVar, isArticleUrlsRecord, type PageviewsLanguage } from "./pageviews-languages.js";

const RAW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "raw");

// tagline/description-split: the curated file still carries its old
// hand-typed `tagline` text (left on disk, unused — see
// milestones-curated.raw.json), but Fetch no longer reads it as authoritative;
// EnrichedMilestone's tagline below is live-fetched instead, matching how
// Conflicts already sources it. Not part of this interface any more,
// deliberately — referencing it here would tempt a future reader into
// wiring it back in.
interface CuratedMilestone {
  id: string;
  name: string;
  year: number;
  category: MilestoneCategory;
}

interface CuratedMilestonesFile {
  milestones: CuratedMilestone[];
}

export interface EnrichedMilestone {
  id: string;
  name: string;
  year: number;
  category: MilestoneCategory;
  // Absent means the enrichment pass couldn't resolve an English tagline
  // for this QID — Output drops the row (write-datasets.ts's
  // validateMilestoneRow), no fallback to the curated file's old text, the
  // same "no fallback, drop instead" behavior Conflicts/People already have.
  tagline?: string;
  // Absent means the enrichment pass couldn't resolve this QID (e.g. a
  // stale/redirected id) — Output drops the row rather than guessing (see
  // write-datasets.ts's buildMilestones).
  sitelinks?: number;
  wikipediaUrl?: string;
  // Per pageviews-basket-language Wikipedia article URL (raw, verbatim —
  // same "store the URI, let the reader extract a title" convention `image`
  // uses), keyed by language code. Absent per-language keys mean this QID
  // has no sitelink in that language — fetch-pageviews.ts treats that as 0
  // pageviews for the language, no redirect-resolution (ADR 0010).
  articleUrls: Partial<Record<PageviewsLanguage, string>>;
  countries: string[];
  // Raw Wikidata P18 Commons Special:FilePath URI, stored verbatim — absent
  // means no P18 claim (dynamic-tooltips spec §4.1/§4.3).
  image?: string;
}

// Validated at the boundary before Fetch reads it (docs/code-conventions.md's
// "Validate unknown external input... at system boundaries") — the curated
// file is hand-authored, not machine-generated, so a typo'd `category` value
// is a real risk a bare `JSON.parse(...) as CuratedMilestonesFile` cast would
// silently let through, only to break rendering downstream in MilestonesLane.
function isCuratedMilestone(value: unknown): value is CuratedMilestone {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.year === "number" &&
    typeof candidate.category === "string" &&
    (MILESTONE_CATEGORIES as readonly string[]).includes(candidate.category)
  );
}

function validateCuratedMilestonesFile(data: unknown): CuratedMilestonesFile {
  const milestones = (data as Record<string, unknown> | null)?.milestones;
  if (!Array.isArray(milestones) || !milestones.every(isCuratedMilestone)) {
    throw new Error("milestones-curated.raw.json is missing a valid milestones array.");
  }
  return { milestones };
}

// Same boundary-validation reasoning as validateCuratedMilestonesFile, applied
// where Transform (transform/index.ts) and the region-tagging maintenance
// script (list-unmapped-countries.ts) read this file back in — it's Fetch's
// own output, but still an external file on disk, same as every other raw
// snapshot this pipeline validates on read (validateSparqlResultShape,
// parsePantheonCsv).
function isEnrichedMilestone(value: unknown): value is EnrichedMilestone {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.year === "number" &&
    (candidate.tagline === undefined || typeof candidate.tagline === "string") &&
    typeof candidate.category === "string" &&
    (MILESTONE_CATEGORIES as readonly string[]).includes(candidate.category) &&
    (candidate.sitelinks === undefined || typeof candidate.sitelinks === "number") &&
    (candidate.wikipediaUrl === undefined || typeof candidate.wikipediaUrl === "string") &&
    isArticleUrlsRecord(candidate.articleUrls) &&
    Array.isArray(candidate.countries) &&
    candidate.countries.every((country) => typeof country === "string") &&
    (candidate.image === undefined || typeof candidate.image === "string")
  );
}

export function validateEnrichedMilestonesFile(data: unknown): { milestones: EnrichedMilestone[] } {
  const milestones = (data as Record<string, unknown> | null)?.milestones;
  if (!Array.isArray(milestones) || !milestones.every(isEnrichedMilestone)) {
    throw new Error("milestones-curated-enriched.raw.json is missing a valid milestones array.");
  }
  return { milestones };
}

const ENTITY_URI_PATTERN = /\/entity\/(Q\d+)$/;

function extractQid(uri: string): string | undefined {
  return ENTITY_URI_PATTERN.exec(uri)?.[1];
}

interface EnrichmentFields {
  sitelinks?: number;
  wikipediaUrl?: string;
  articleUrls: Partial<Record<PageviewsLanguage, string>>;
  countries: string[];
  image?: string;
  tagline?: string;
}

// Reads the checked-in curated list (data/raw/milestones-curated.raw.json) and
// backfills sitelinks/wikipediaUrl/country/image/tagline via a batched
// per-QID SPARQL pass (same VALUES-clause pattern as
// fetch-reigns.ts/fetch-taglines.ts) — dateProperty/source are
// curation-time provenance and are dropped here, not carried into the
// merged output. tagline is live-fetched here, not read from the curated
// file, matching how Conflicts already sources it (tagline/description split).
export async function fetchMilestonesEnrichment(): Promise<void> {
  const curatedPath = path.join(RAW_DIR, "milestones-curated.raw.json");
  const curated = validateCuratedMilestonesFile(JSON.parse(await readFile(curatedPath, "utf8")));
  const ids = curated.milestones.map((milestone) => milestone.id);

  console.log(`Fetching sitelinks/article/country/image/tagline enrichment for ${ids.length} curated milestones...`);
  const result = await batchedSparqlFetch(ids, buildMilestonesEnrichmentQuery);

  const enrichmentById = new Map<string, EnrichmentFields>();
  for (const row of result.results.bindings) {
    const eventUri = row.event?.value;
    if (!eventUri) continue;
    const id = extractQid(eventUri);
    if (!id) continue;

    let entry = enrichmentById.get(id);
    if (!entry) {
      entry = { countries: [], articleUrls: {} };
      enrichmentById.set(id, entry);
    }

    if (entry.sitelinks === undefined && row.sitelinks?.value) entry.sitelinks = Number(row.sitelinks.value);
    for (const lang of PAGEVIEWS_LANGUAGES) {
      const url = row[articleVar(lang)]?.value;
      if (url && entry.articleUrls[lang] === undefined) entry.articleUrls[lang] = url;
    }
    // wikipediaUrl is the English-basket article, same field the old
    // single-language ?article binding populated — kept as its own field
    // (rather than always reading articleUrls.en downstream) since every
    // other consumer of EnrichedMilestone already expects wikipediaUrl.
    if (entry.wikipediaUrl === undefined && entry.articleUrls.en !== undefined) entry.wikipediaUrl = entry.articleUrls.en;
    if (entry.image === undefined && row.image?.value) entry.image = row.image.value;
    if (entry.tagline === undefined && row.tagline?.value) entry.tagline = row.tagline.value;
    const countryId = row.country?.value ? extractQid(row.country.value) : undefined;
    if (countryId && !entry.countries.includes(countryId)) entry.countries.push(countryId);
  }

  const milestones: EnrichedMilestone[] = curated.milestones.map((milestone) => {
    const enrichment = enrichmentById.get(milestone.id);
    return {
      id: milestone.id,
      name: milestone.name,
      year: milestone.year,
      category: milestone.category,
      tagline: enrichment?.tagline,
      sitelinks: enrichment?.sitelinks,
      wikipediaUrl: enrichment?.wikipediaUrl,
      articleUrls: enrichment?.articleUrls ?? {},
      countries: enrichment?.countries ?? [],
      image: enrichment?.image,
    };
  });

  const outputPath = path.join(RAW_DIR, "milestones-curated-enriched.raw.json");
  await writeFile(outputPath, JSON.stringify({ milestones }, null, 2));
  console.log(`Wrote ${milestones.length} enriched milestones to ${outputPath}`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  fetchMilestonesEnrichment().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
