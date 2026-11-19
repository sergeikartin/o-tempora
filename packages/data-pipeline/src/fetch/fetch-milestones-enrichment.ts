import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MILESTONE_CATEGORIES,
  type MilestoneCategory,
} from '@o-tempora/shared-types';
import { parseIsoYear, parseMonthIfKnown } from '../transform/wikidata-date.js';
import { batchedSparqlFetch } from './batched-sparql-fetch.js';
import {
  articleVar,
  isArticleUrlsRecord,
  PAGEVIEWS_LANGUAGES,
  type PageviewsLanguage,
} from './pageviews-languages.js';
import { filterByQids, mergeEnriched, type QidFilter } from './qid-filter.js';
import { buildMilestonesEnrichmentQuery } from './queries/milestones-enrichment.js';

const RAW_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'data',
  'raw',
);

interface CuratedMilestone {
  id: string;
  // For curator reference. Output uses the Wikidata label or displayName.
  name: string;
  category: MilestoneCategory;
  // Use when Wikidata names the artifact rather than the Milestone it represents.
  displayName?: { en: string; ru: string };
  // Borrow Fame Score inputs from the concept a Milestone introduced.
  fameSource?: string;
  // The override replaces the whole date. Omitting endYear yields a point even if
  // Wikidata supplies an end date.
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
  name?: string;
  nameRu?: string;
  category: MilestoneCategory;
  approximateDate?: true;
  endApproximateDate?: true;
  year?: number;
  // Wikidata dates include a month only when the claim supports that precision.
  month?: number;
  // Without an end date, Output builds a point-shaped Milestone.
  endYear?: number;
  endMonth?: number;
  tagline?: string;
  taglineRu?: string;
  sitelinks?: number;
  wikipediaUrl?: string;
  // Wikipedia article URL per pageviews-basket language, stored verbatim (like
  // `image`; the reader extracts the title), keyed by language code. A missing
  // key means no sitelink in that language: fetch-pageviews.ts counts 0
  // pageviews, with no redirect resolution (docs/adr/0010).
  articleUrls: Partial<Record<PageviewsLanguage, string>>;
  fameSitelinks?: number;
  fameArticleUrls?: Partial<Record<PageviewsLanguage, string>>;
  countries: string[];
  // Raw Wikidata P18 Commons Special:FilePath URI, stored verbatim; absent means
  // no P18 claim.
  image?: string;
}

function isCuratedMilestone(value: unknown): value is CuratedMilestone {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.category === 'string' &&
    (MILESTONE_CATEGORIES as readonly string[]).includes(candidate.category) &&
    (candidate.displayName === undefined ||
      isDisplayName(candidate.displayName)) &&
    (candidate.fameSource === undefined ||
      typeof candidate.fameSource === 'string') &&
    (candidate.date === undefined || isDateOverride(candidate.date))
  );
}

const isMonth = (value: unknown): boolean =>
  value === undefined ||
  (Number.isInteger(value) &&
    (value as number) >= 1 &&
    (value as number) <= 12);

function isDateOverride(value: unknown): value is DateOverride {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    Number.isInteger(candidate.year) &&
    isMonth(candidate.month) &&
    (candidate.endYear === undefined || Number.isInteger(candidate.endYear)) &&
    isMonth(candidate.endMonth) &&
    (candidate.endMonth === undefined || candidate.endYear !== undefined) &&
    (candidate.approximate === undefined ||
      typeof candidate.approximate === 'boolean')
  );
}

type EnrichedDate = Pick<
  EnrichedMilestone,
  | 'year'
  | 'month'
  | 'endYear'
  | 'endMonth'
  | 'approximateDate'
  | 'endApproximateDate'
>;

export function resolveDate(
  override: DateOverride | undefined,
  enriched: EnrichedDate | undefined,
): EnrichedDate {
  const source = override ?? enriched;
  return {
    ...(!override && enriched?.endApproximateDate
      ? { endApproximateDate: true as const }
      : {}),
    year: source?.year,
    month: source?.month,
    endYear: source?.endYear,
    endMonth: source?.endMonth,
    ...((override ? override.approximate : enriched?.approximateDate)
      ? { approximateDate: true as const }
      : {}),
  };
}

function isDisplayName(value: unknown): value is { en: string; ru: string } {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.en === 'string' && typeof candidate.ru === 'string';
}

function validateCuratedMilestonesFile(data: unknown): CuratedMilestonesFile {
  const milestones = (data as Record<string, unknown> | null)?.milestones;
  if (!Array.isArray(milestones) || !milestones.every(isCuratedMilestone)) {
    throw new Error(
      'milestones-curated.raw.json is missing a valid milestones array.',
    );
  }
  return { milestones };
}

function isEnrichedMilestone(value: unknown): value is EnrichedMilestone {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    (candidate.name === undefined || typeof candidate.name === 'string') &&
    (candidate.nameRu === undefined || typeof candidate.nameRu === 'string') &&
    (candidate.approximateDate === undefined ||
      candidate.approximateDate === true) &&
    (candidate.endApproximateDate === undefined ||
      candidate.endApproximateDate === true) &&
    (candidate.year === undefined || typeof candidate.year === 'number') &&
    (candidate.month === undefined || typeof candidate.month === 'number') &&
    (candidate.endYear === undefined ||
      typeof candidate.endYear === 'number') &&
    (candidate.endMonth === undefined ||
      typeof candidate.endMonth === 'number') &&
    (candidate.tagline === undefined ||
      typeof candidate.tagline === 'string') &&
    (candidate.taglineRu === undefined ||
      typeof candidate.taglineRu === 'string') &&
    typeof candidate.category === 'string' &&
    (MILESTONE_CATEGORIES as readonly string[]).includes(candidate.category) &&
    (candidate.sitelinks === undefined ||
      typeof candidate.sitelinks === 'number') &&
    (candidate.wikipediaUrl === undefined ||
      typeof candidate.wikipediaUrl === 'string') &&
    isArticleUrlsRecord(candidate.articleUrls) &&
    (candidate.fameSitelinks === undefined ||
      typeof candidate.fameSitelinks === 'number') &&
    (candidate.fameArticleUrls === undefined ||
      isArticleUrlsRecord(candidate.fameArticleUrls)) &&
    Array.isArray(candidate.countries) &&
    candidate.countries.every((country) => typeof country === 'string') &&
    (candidate.image === undefined || typeof candidate.image === 'string')
  );
}

export function validateEnrichedMilestonesFile(data: unknown): {
  milestones: EnrichedMilestone[];
} {
  const milestones = (data as Record<string, unknown> | null)?.milestones;
  if (!Array.isArray(milestones) || !milestones.every(isEnrichedMilestone)) {
    throw new Error(
      'milestones-curated-enriched.raw.json is missing a valid milestones array.',
    );
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
  approximateDate?: true;
  endApproximateDate?: true;
  year?: number;
  month?: number;
  endYear?: number;
  endMonth?: number;
}

export async function fetchMilestonesEnrichment(
  qids?: QidFilter,
): Promise<void> {
  const curatedPath = path.join(RAW_DIR, 'milestones-curated.raw.json');
  const curated = validateCuratedMilestonesFile(
    JSON.parse(await readFile(curatedPath, 'utf8')),
  );
  const selected = filterByQids(curated.milestones, qids);
  const fameSourceIds = selected.flatMap((milestone) =>
    milestone.fameSource ? [milestone.fameSource] : [],
  );
  const ids = [
    ...new Set([
      ...selected.map((milestone) => milestone.id),
      ...fameSourceIds,
    ]),
  ];

  console.log(
    `Fetching sitelinks/article/country/image/name/tagline/date enrichment for ${ids.length} curated milestones...`,
  );
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

    if (entry.sitelinks === undefined && row.sitelinks?.value)
      entry.sitelinks = Number(row.sitelinks.value);
    for (const lang of PAGEVIEWS_LANGUAGES) {
      const url = row[articleVar(lang)]?.value;
      if (url && entry.articleUrls[lang] === undefined)
        entry.articleUrls[lang] = url;
    }
    if (entry.wikipediaUrl === undefined && entry.articleUrls.en !== undefined)
      entry.wikipediaUrl = entry.articleUrls.en;
    if (entry.image === undefined && row.image?.value)
      entry.image = row.image.value;
    if (entry.name === undefined && row.nameEn?.value)
      entry.name = row.nameEn.value;
    if (entry.nameRu === undefined && row.nameRu?.value)
      entry.nameRu = row.nameRu.value;
    if (entry.tagline === undefined && row.tagline?.value)
      entry.tagline = row.tagline.value;
    if (entry.taglineRu === undefined && row.taglineRu?.value)
      entry.taglineRu = row.taglineRu.value;
    const countryId = row.country?.value
      ? extractQid(row.country.value)
      : undefined;
    if (countryId && !entry.countries.includes(countryId))
      entry.countries.push(countryId);

    if (entry.year === undefined && row.date?.value) {
      if (row.dateCirca?.value === 'true') entry.approximateDate = true;
      entry.year = parseIsoYear(row.date.value);
      entry.month = parseMonthIfKnown(row.date.value, row.datePrecision?.value);
    }
    if (entry.endYear === undefined && row.endDate?.value) {
      if (row.endDateCirca?.value === 'true') entry.endApproximateDate = true;
      entry.endYear = parseIsoYear(row.endDate.value);
      entry.endMonth = parseMonthIfKnown(
        row.endDate.value,
        row.endDatePrecision?.value,
      );
    }
  }

  const enriched: EnrichedMilestone[] = selected.map((milestone) => {
    const enrichment = enrichmentById.get(milestone.id);
    const fameSource = milestone.fameSource
      ? enrichmentById.get(milestone.fameSource)
      : undefined;
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

  const outputPath = path.join(RAW_DIR, 'milestones-curated-enriched.raw.json');
  const milestones = await mergeEnriched(
    outputPath,
    'milestones',
    curated.milestones.map((milestone) => milestone.id),
    enriched,
    qids,
  );
  await writeFile(outputPath, JSON.stringify({ milestones }, null, 2));
  console.log(
    `Wrote ${milestones.length} enriched milestones to ${outputPath}`,
  );
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  fetchMilestonesEnrichment().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
