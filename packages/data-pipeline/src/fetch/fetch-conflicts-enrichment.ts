import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONFLICT_CATEGORIES, type ConflictCategory } from "@same-sky/shared-types";
import { buildConflictsEnrichmentQuery } from "./queries/conflicts-enrichment.js";
import { batchedSparqlFetch } from "./batched-sparql-fetch.js";
import { parseIsoYear, parseMonthIfKnown } from "../transform/wikidata-date.js";
import { PAGEVIEWS_LANGUAGES, articleVar, isArticleUrlsRecord, type PageviewsLanguage } from "./pageviews-languages.js";

const RAW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "raw");

export interface CuratedConflict {
  id: string;
  name: string;
  category: ConflictCategory;
  // Another curated row's id — always resolves to a Conflict, capped at 3 levels
  // deep. Validated at Output (write-datasets.ts's buildConflicts), not here.
  parentId?: string;
}

interface CuratedConflictsFile {
  conflicts: CuratedConflict[];
}

export interface EnrichedConflict {
  id: string;
  name: string;
  category: ConflictCategory;
  parentId?: string;
  // Absent means the enrichment pass couldn't resolve this QID (e.g. a
  // stale/redirected id) — Output drops the row rather than guessing (see
  // write-datasets.ts's buildConflicts).
  sitelinks?: number;
  wikipediaUrl?: string;
  // Per pageviews-basket-language Wikipedia article URL (raw, verbatim —
  // same "store the URI, let the reader extract a title" convention `image`
  // uses), keyed by language code. Absent per-language keys mean this QID
  // has no sitelink in that language — fetch-pageviews.ts treats that as 0
  // pageviews for the language, no redirect-resolution (ADR 0010).
  articleUrls: Partial<Record<PageviewsLanguage, string>>;
  countries: string[];
  // Raw Wikidata P18 Commons Special:FilePath URI, stored verbatim.
  image?: string;
  tagline?: string;
  // Wikidata's own claim precision decides whether month is present (see
  // wikidata-date.ts's MONTH_OR_FINER_PRECISION) — never defaulted to
  // January to paper over an unknown month.
  year?: number;
  month?: number;
  // Absent endYear means this row resolved only one date (a point-in-time
  // claim, or a start with no recorded end) — Output builds a ConflictEvent
  // rather than a Conflict for it (see buildConflicts's shape rule).
  endYear?: number;
  endMonth?: number;
}

// Validated at the boundary before Fetch reads it (docs/code-conventions.md's
// "Validate unknown external input... at system boundaries") — the curated
// file is hand-authored, not machine-generated, so a typo'd `category` value
// is a real risk a bare `JSON.parse(...) as CuratedConflictsFile` cast would
// silently let through, only to break rendering downstream in ConflictsLane.
function isCuratedConflict(value: unknown): value is CuratedConflict {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.category === "string" &&
    (CONFLICT_CATEGORIES as readonly string[]).includes(candidate.category) &&
    (candidate.parentId === undefined || typeof candidate.parentId === "string")
  );
}

export function validateCuratedConflictsFile(data: unknown): CuratedConflictsFile {
  const conflicts = (data as Record<string, unknown> | null)?.conflicts;
  if (!Array.isArray(conflicts) || !conflicts.every(isCuratedConflict)) {
    throw new Error("conflicts-curated.raw.json is missing a valid conflicts array.");
  }
  return { conflicts };
}

// Same boundary-validation reasoning as validateCuratedConflictsFile, applied
// where Transform reads this file back in — it's Fetch's own output, but
// still an external file on disk, same as every other raw snapshot this
// pipeline validates on read.
function isEnrichedConflict(value: unknown): value is EnrichedConflict {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.category === "string" &&
    (CONFLICT_CATEGORIES as readonly string[]).includes(candidate.category) &&
    (candidate.parentId === undefined || typeof candidate.parentId === "string") &&
    (candidate.sitelinks === undefined || typeof candidate.sitelinks === "number") &&
    (candidate.wikipediaUrl === undefined || typeof candidate.wikipediaUrl === "string") &&
    isArticleUrlsRecord(candidate.articleUrls) &&
    Array.isArray(candidate.countries) &&
    candidate.countries.every((country) => typeof country === "string") &&
    (candidate.image === undefined || typeof candidate.image === "string") &&
    (candidate.tagline === undefined || typeof candidate.tagline === "string") &&
    (candidate.year === undefined || typeof candidate.year === "number") &&
    (candidate.month === undefined || typeof candidate.month === "number") &&
    (candidate.endYear === undefined || typeof candidate.endYear === "number") &&
    (candidate.endMonth === undefined || typeof candidate.endMonth === "number")
  );
}

export function validateEnrichedConflictsFile(data: unknown): { conflicts: EnrichedConflict[] } {
  const conflicts = (data as Record<string, unknown> | null)?.conflicts;
  if (!Array.isArray(conflicts) || !conflicts.every(isEnrichedConflict)) {
    throw new Error("conflicts-curated-enriched.raw.json is missing a valid conflicts array.");
  }
  return { conflicts };
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
  year?: number;
  month?: number;
  endYear?: number;
  endMonth?: number;
}

// Reads the checked-in curated list (data/raw/conflicts-curated.raw.json) and
// backfills sitelinks/wikipediaUrl/country/image/tagline/dates via a
// batched per-QID SPARQL pass (same VALUES-clause pattern as
// fetch-milestones-enrichment.ts). Unlike Milestones, tagline and dates
// are never curator-authored here — the curated file carries only
// id/name/category/parentId (see conflicts-curated.raw.json's meta.description).
export async function fetchConflictsEnrichment(): Promise<void> {
  const curatedPath = path.join(RAW_DIR, "conflicts-curated.raw.json");
  const curated = validateCuratedConflictsFile(JSON.parse(await readFile(curatedPath, "utf8")));
  const ids = curated.conflicts.map((conflict) => conflict.id);

  console.log(`Fetching sitelinks/article/country/image/tagline/date enrichment for ${ids.length} curated conflicts...`);
  const result = await batchedSparqlFetch(ids, buildConflictsEnrichmentQuery);

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
    // other consumer of EnrichedConflict already expects wikipediaUrl.
    if (entry.wikipediaUrl === undefined && entry.articleUrls.en !== undefined) entry.wikipediaUrl = entry.articleUrls.en;
    if (entry.image === undefined && row.image?.value) entry.image = row.image.value;
    if (entry.tagline === undefined && row.tagline?.value) entry.tagline = row.tagline.value;
    const countryId = row.country?.value ? extractQid(row.country.value) : undefined;
    if (countryId && !entry.countries.includes(countryId)) entry.countries.push(countryId);

    if (entry.year === undefined && row.date?.value) {
      entry.year = parseIsoYear(row.date.value);
      entry.month = parseMonthIfKnown(row.date.value, row.datePrecision?.value);
    }
    if (entry.endYear === undefined && row.endDate?.value) {
      entry.endYear = parseIsoYear(row.endDate.value);
      entry.endMonth = parseMonthIfKnown(row.endDate.value, row.endDatePrecision?.value);
    }
  }

  const conflicts: EnrichedConflict[] = curated.conflicts.map((conflict) => {
    const enrichment = enrichmentById.get(conflict.id);
    return {
      id: conflict.id,
      name: conflict.name,
      category: conflict.category,
      parentId: conflict.parentId,
      sitelinks: enrichment?.sitelinks,
      wikipediaUrl: enrichment?.wikipediaUrl,
      articleUrls: enrichment?.articleUrls ?? {},
      countries: enrichment?.countries ?? [],
      image: enrichment?.image,
      tagline: enrichment?.tagline,
      year: enrichment?.year,
      month: enrichment?.month,
      endYear: enrichment?.endYear,
      endMonth: enrichment?.endMonth,
    };
  });

  const outputPath = path.join(RAW_DIR, "conflicts-curated-enriched.raw.json");
  await writeFile(outputPath, JSON.stringify({ conflicts }, null, 2));
  console.log(`Wrote ${conflicts.length} enriched conflicts to ${outputPath}`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  fetchConflictsEnrichment().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
