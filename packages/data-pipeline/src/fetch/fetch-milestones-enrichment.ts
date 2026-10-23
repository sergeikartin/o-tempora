import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MILESTONE_CATEGORIES, type MilestoneCategory } from "@o-tempora/shared-types";
import { buildMilestonesEnrichmentQuery } from "./queries/milestones-enrichment.js";
import { batchedSparqlFetch } from "./batched-sparql-fetch.js";
import { parseIsoYear, parseMonthIfKnown } from "../transform/wikidata-date.js";
import { filterByQids, mergeEnriched, type QidFilter } from "./qid-filter.js";
import { PAGEVIEWS_LANGUAGES, articleVar, isArticleUrlsRecord, type PageviewsLanguage } from "./pageviews-languages.js";

const RAW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "raw");

// The curated file carries id/name/category (curator-authored); everything
// else, including the date via DATE_PROPERTIES' priority-ordered COALESCE in
// queries/milestones-enrichment.ts, is live-fetched, as Conflicts does (see
// conflicts-curated.raw.json's meta.description).
interface CuratedMilestone {
  id: string;
  // Curator-typed but unread: name comes from Wikidata's rdfs:label (en and ru)
  // via the enrichment pass below, like tagline. Kept in the curated file and
  // this shape, as with Conflicts' unused curated `name`.
  name: string;
  category: MilestoneCategory;
  // Replaces the Wikidata label (en/ru) for entries whose own item is named
  // for the artifact rather than the milestone it stands for (e.g. "First
  // car" for the Benz Patent-Motorwagen). Tagline, article and date still
  // come from the entry's own item.
  displayName?: { en: string; ru: string };
  // QID of a broader concept item whose sitelinks and pageviews stand in for
  // this entry's own when scoring fame, so a "first X" entry ranks as
  // prominently as the concept it introduced.
  fameSource?: string;
  // Replaces the date Wikidata resolves (or fills in one it doesn't have)
  // for entries whose own item carries no usable date claim, or a wrong one.
  // Replaces all four fields together: an absent `endYear` makes the entry
  // point-shaped even when Wikidata has an end date.
  date?: DateOverride;
}

export interface DateOverride {
  year: number;
  month?: number;
  endYear?: number;
  endMonth?: number;
  // Marks the overridden date as a scholarly estimate; the UI prefixes it
  // with "ca.".
  approximate?: boolean;
}

interface CuratedMilestonesFile {
  milestones: CuratedMilestone[];
}

export interface EnrichedMilestone {
  id: string;
  // Wikidata's rdfs:label(en); absent only when the QID couldn't be resolved,
  // and Output then drops the row (write-datasets.ts's buildMilestones).
  name?: string;
  // Wikidata's rdfs:label(ru); absent when none resolves. Output falls back to
  // `name` (English) per field when building the Russian file.
  nameRu?: string;
  category: MilestoneCategory;
  // Absent means DATE_PROPERTIES' COALESCE (queries/milestones-enrichment.ts)
  // found no claim on any of the 10 candidate properties; Output drops the row
  // (write-datasets.ts's validateEventRow), as for a missing tagline.
  year?: number;
  // Wikidata's claim precision decides whether month is present (see
  // wikidata-date.ts's MONTH_OR_FINER_PRECISION); never defaulted to January,
  // as for Conflicts.
  month?: number;
  // Absent endYear means no P582 claim resolved (a point-in-time event, or a
  // start with no recorded end); Output builds a point-shaped Milestone, the
  // same shape rule as buildConflicts.
  endYear?: number;
  endMonth?: number;
  // Set only by a curated `date` override marked approximate.
  approximateDate?: true;
  // Absent means enrichment couldn't resolve an English tagline for this QID;
  // Output drops the row (write-datasets.ts's validateMilestoneRow), as for
  // Conflicts and People.
  tagline?: string;
  // Russian schema:description; same fallback contract as nameRu.
  taglineRu?: string;
  // Absent means enrichment couldn't resolve this QID (e.g. a stale or
  // redirected id); Output drops the row (write-datasets.ts's buildMilestones).
  sitelinks?: number;
  wikipediaUrl?: string;
  // Wikipedia article URL per pageviews-basket language, stored verbatim (like
  // `image`; the reader extracts the title), keyed by language code. A missing
  // key means no sitelink in that language: fetch-pageviews.ts counts 0
  // pageviews, with no redirect resolution (docs/adr/0010).
  articleUrls: Partial<Record<PageviewsLanguage, string>>;
  // Sitelinks and article URLs of the curated entry's `fameSource` item;
  // absent for entries scored on their own.
  fameSitelinks?: number;
  fameArticleUrls?: Partial<Record<PageviewsLanguage, string>>;
  countries: string[];
  // Raw Wikidata P18 Commons Special:FilePath URI, stored verbatim; absent means
  // no P18 claim.
  image?: string;
}

// Validated at the boundary before Fetch reads it (docs/code-conventions.md):
// the curated file is hand-authored, so a typo'd `category` would pass a bare
// `JSON.parse(...) as CuratedMilestonesFile` cast and break rendering
// downstream.
function isCuratedMilestone(value: unknown): value is CuratedMilestone {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.category === "string" &&
    (MILESTONE_CATEGORIES as readonly string[]).includes(candidate.category) &&
    (candidate.displayName === undefined || isDisplayName(candidate.displayName)) &&
    (candidate.fameSource === undefined || typeof candidate.fameSource === "string") &&
    (candidate.date === undefined || isDateOverride(candidate.date))
  );
}

const isMonth = (value: unknown): boolean => value === undefined || (Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 12);

function isDateOverride(value: unknown): value is DateOverride {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    Number.isInteger(candidate.year) &&
    isMonth(candidate.month) &&
    (candidate.endYear === undefined || Number.isInteger(candidate.endYear)) &&
    isMonth(candidate.endMonth) &&
    (candidate.endMonth === undefined || candidate.endYear !== undefined) &&
    (candidate.approximate === undefined || typeof candidate.approximate === "boolean")
  );
}

export function resolveDate(
  override: DateOverride | undefined,
  enriched: { year?: number; month?: number; endYear?: number; endMonth?: number } | undefined,
): { year?: number; month?: number; endYear?: number; endMonth?: number; approximateDate?: true } {
  const source = override ?? enriched;
  return {
    year: source?.year,
    month: source?.month,
    endYear: source?.endYear,
    endMonth: source?.endMonth,
    ...(override?.approximate ? { approximateDate: true as const } : {}),
  };
}

function isDisplayName(value: unknown): value is { en: string; ru: string } {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.en === "string" && typeof candidate.ru === "string";
}

function validateCuratedMilestonesFile(data: unknown): CuratedMilestonesFile {
  const milestones = (data as Record<string, unknown> | null)?.milestones;
  if (!Array.isArray(milestones) || !milestones.every(isCuratedMilestone)) {
    throw new Error("milestones-curated.raw.json is missing a valid milestones array.");
  }
  return { milestones };
}

// Same boundary validation as validateCuratedMilestonesFile, for where
// Transform (transform/index.ts) and list-unmapped-countries.ts read this file
// back: it is Fetch's own output, but still an external file on disk, like every
// raw snapshot validated on read (validateSparqlResultShape, parsePantheonCsv).
function isEnrichedMilestone(value: unknown): value is EnrichedMilestone {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    (candidate.name === undefined || typeof candidate.name === "string") &&
    (candidate.nameRu === undefined || typeof candidate.nameRu === "string") &&
    (candidate.year === undefined || typeof candidate.year === "number") &&
    (candidate.month === undefined || typeof candidate.month === "number") &&
    (candidate.endYear === undefined || typeof candidate.endYear === "number") &&
    (candidate.endMonth === undefined || typeof candidate.endMonth === "number") &&
    (candidate.tagline === undefined || typeof candidate.tagline === "string") &&
    (candidate.taglineRu === undefined || typeof candidate.taglineRu === "string") &&
    typeof candidate.category === "string" &&
    (MILESTONE_CATEGORIES as readonly string[]).includes(candidate.category) &&
    (candidate.sitelinks === undefined || typeof candidate.sitelinks === "number") &&
    (candidate.wikipediaUrl === undefined || typeof candidate.wikipediaUrl === "string") &&
    isArticleUrlsRecord(candidate.articleUrls) &&
    (candidate.fameSitelinks === undefined || typeof candidate.fameSitelinks === "number") &&
    (candidate.fameArticleUrls === undefined || isArticleUrlsRecord(candidate.fameArticleUrls)) &&
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
  name?: string;
  nameRu?: string;
  sitelinks?: number;
  wikipediaUrl?: string;
  articleUrls: Partial<Record<PageviewsLanguage, string>>;
  countries: string[];
  image?: string;
  tagline?: string;
  taglineRu?: string;
  year?: number;
  month?: number;
  endYear?: number;
  endMonth?: number;
}

// Reads the checked-in curated list (data/raw/milestones-curated.raw.json) and
// backfills sitelinks/wikipediaUrl/country/image/name/tagline/date via a
// batched per-QID SPARQL pass (VALUES-clause pattern as in fetch-taglines.ts).
// Tagline, name and date are live-fetched, not read from the curated file, as
// for Conflicts.
export async function fetchMilestonesEnrichment(qids?: QidFilter): Promise<void> {
  const curatedPath = path.join(RAW_DIR, "milestones-curated.raw.json");
  const curated = validateCuratedMilestonesFile(JSON.parse(await readFile(curatedPath, "utf8")));
  const selected = filterByQids(curated.milestones, qids);
  const fameSourceIds = selected.flatMap((milestone) => (milestone.fameSource ? [milestone.fameSource] : []));
  const ids = [...new Set([...selected.map((milestone) => milestone.id), ...fameSourceIds])];

  console.log(`Fetching sitelinks/article/country/image/name/tagline/date enrichment for ${ids.length} curated milestones...`);
  if (qids && ids.length === 0) return;
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
    // wikipediaUrl is the English-basket article, kept as its own field because
    // every consumer of EnrichedMilestone reads it rather than articleUrls.en.
    if (entry.wikipediaUrl === undefined && entry.articleUrls.en !== undefined) entry.wikipediaUrl = entry.articleUrls.en;
    if (entry.image === undefined && row.image?.value) entry.image = row.image.value;
    if (entry.name === undefined && row.nameEn?.value) entry.name = row.nameEn.value;
    if (entry.nameRu === undefined && row.nameRu?.value) entry.nameRu = row.nameRu.value;
    if (entry.tagline === undefined && row.tagline?.value) entry.tagline = row.tagline.value;
    if (entry.taglineRu === undefined && row.taglineRu?.value) entry.taglineRu = row.taglineRu.value;
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

  const enriched: EnrichedMilestone[] = selected.map((milestone) => {
    const enrichment = enrichmentById.get(milestone.id);
    const fameSource = milestone.fameSource ? enrichmentById.get(milestone.fameSource) : undefined;
    const date = resolveDate(milestone.date, enrichment);
    return {
      id: milestone.id,
      name: milestone.displayName?.en ?? enrichment?.name,
      nameRu: milestone.displayName?.ru ?? enrichment?.nameRu,
      category: milestone.category,
      ...date,
      tagline: enrichment?.tagline,
      taglineRu: enrichment?.taglineRu,
      sitelinks: enrichment?.sitelinks,
      wikipediaUrl: enrichment?.wikipediaUrl,
      articleUrls: enrichment?.articleUrls ?? {},
      fameSitelinks: fameSource?.sitelinks,
      fameArticleUrls: fameSource?.articleUrls,
      countries: enrichment?.countries ?? [],
      image: enrichment?.image,
    };
  });

  const outputPath = path.join(RAW_DIR, "milestones-curated-enriched.raw.json");
  const milestones = await mergeEnriched(outputPath, "milestones", curated.milestones.map((milestone) => milestone.id), enriched, qids);
  await writeFile(outputPath, JSON.stringify({ milestones }, null, 2));
  console.log(`Wrote ${milestones.length} enriched milestones to ${outputPath}`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  fetchMilestonesEnrichment().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
