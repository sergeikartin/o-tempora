import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONFLICT_CATEGORIES,
  type ConflictCategory,
} from '@o-tempora/shared-types';
import { parseIsoYear, parseMonthIfKnown } from '../transform/wikidata-date.ts';
import { batchedSparqlFetch } from './batched-sparql-fetch.ts';
import {
  articleVar,
  isArticleUrlsRecord,
  PAGEVIEWS_LANGUAGES,
  type PageviewsLanguage,
} from './pageviews-languages.ts';
import { filterByQids, mergeEnriched, type QidFilter } from './qid-filter.ts';
import { buildConflictsEnrichmentQuery } from './queries/conflicts-enrichment.ts';

const RAW_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'data',
  'raw',
);

export interface CuratedConflict {
  id: string;
  // For curator reference. Display names come from Wikidata.
  name: string;
  category: ConflictCategory;
  // Another curated row's id; always a Conflict, capped at 3 levels. Validated at
  // Output (write-datasets.ts's buildConflicts), not here.
  parentId?: string;
}

interface CuratedConflictsFile {
  conflicts: CuratedConflict[];
}

export interface EnrichedConflict {
  id: string;
  name?: string;
  nameRu?: string;
  category: ConflictCategory;
  parentId?: string;
  sitelinks?: number;
  wikipediaUrl?: string;
  // Wikipedia article URL per pageviews-basket language, stored verbatim (like
  // `image`; the reader extracts the title), keyed by language code. A missing
  // key means no sitelink in that language: fetch-pageviews.ts counts 0
  // pageviews, with no redirect resolution (docs/adr/0010).
  articleUrls: Partial<Record<PageviewsLanguage, string>>;
  countries: string[];
  // Raw Wikidata P18 Commons Special:FilePath URI, stored verbatim.
  image?: string;
  tagline?: string;
  taglineRu?: string;
  // Wikidata's claim precision decides whether month is present (see
  // wikidata-date.ts's MONTH_OR_FINER_PRECISION); never defaulted to January.
  approximateDate?: true;
  endApproximateDate?: true;
  year?: number;
  month?: number;
  // With only one resolved date, Output builds a ConflictEvent.
  endYear?: number;
  endMonth?: number;
}

function isCuratedConflict(value: unknown): value is CuratedConflict {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.category === 'string' &&
    (CONFLICT_CATEGORIES as readonly string[]).includes(candidate.category) &&
    (candidate.parentId === undefined || typeof candidate.parentId === 'string')
  );
}

export function validateCuratedConflictsFile(
  data: unknown,
): CuratedConflictsFile {
  const conflicts = (data as Record<string, unknown> | null)?.conflicts;
  if (!Array.isArray(conflicts) || !conflicts.every(isCuratedConflict)) {
    throw new Error(
      'conflicts-curated.raw.json is missing a valid conflicts array.',
    );
  }
  return { conflicts };
}

// Same boundary validation as validateCuratedConflictsFile, for where
// Transform reads this file back: it is Fetch's own output, but still an
// external file on disk.
function isEnrichedConflict(value: unknown): value is EnrichedConflict {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    (candidate.name === undefined || typeof candidate.name === 'string') &&
    (candidate.nameRu === undefined || typeof candidate.nameRu === 'string') &&
    typeof candidate.category === 'string' &&
    (CONFLICT_CATEGORIES as readonly string[]).includes(candidate.category) &&
    (candidate.parentId === undefined ||
      typeof candidate.parentId === 'string') &&
    (candidate.sitelinks === undefined ||
      typeof candidate.sitelinks === 'number') &&
    (candidate.wikipediaUrl === undefined ||
      typeof candidate.wikipediaUrl === 'string') &&
    isArticleUrlsRecord(candidate.articleUrls) &&
    Array.isArray(candidate.countries) &&
    candidate.countries.every((country) => typeof country === 'string') &&
    (candidate.image === undefined || typeof candidate.image === 'string') &&
    (candidate.tagline === undefined ||
      typeof candidate.tagline === 'string') &&
    (candidate.taglineRu === undefined ||
      typeof candidate.taglineRu === 'string') &&
    (candidate.approximateDate === undefined ||
      candidate.approximateDate === true) &&
    (candidate.endApproximateDate === undefined ||
      candidate.endApproximateDate === true) &&
    (candidate.year === undefined || typeof candidate.year === 'number') &&
    (candidate.month === undefined || typeof candidate.month === 'number') &&
    (candidate.endYear === undefined ||
      typeof candidate.endYear === 'number') &&
    (candidate.endMonth === undefined || typeof candidate.endMonth === 'number')
  );
}

export function validateEnrichedConflictsFile(data: unknown): {
  conflicts: EnrichedConflict[];
} {
  const conflicts = (data as Record<string, unknown> | null)?.conflicts;
  if (!Array.isArray(conflicts) || !conflicts.every(isEnrichedConflict)) {
    throw new Error(
      'conflicts-curated-enriched.raw.json is missing a valid conflicts array.',
    );
  }
  return { conflicts };
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

export async function fetchConflictsEnrichment(
  qids?: QidFilter,
): Promise<void> {
  const curatedPath = path.join(RAW_DIR, 'conflicts-curated.raw.json');
  const curated = validateCuratedConflictsFile(
    JSON.parse(await readFile(curatedPath, 'utf8')),
  );
  const selected = filterByQids(curated.conflicts, qids);
  const ids = selected.map((conflict) => conflict.id);

  console.log(
    `Fetching sitelinks/article/country/image/name/tagline/date enrichment for ${ids.length} curated conflicts...`,
  );
  if (qids && ids.length === 0) return;
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

  const enriched: EnrichedConflict[] = selected.map((conflict) => {
    const enrichment = enrichmentById.get(conflict.id);
    return {
      id: conflict.id,
      name: enrichment?.name,
      nameRu: enrichment?.nameRu,
      category: conflict.category,
      parentId: conflict.parentId,
      sitelinks: enrichment?.sitelinks,
      wikipediaUrl: enrichment?.wikipediaUrl,
      articleUrls: enrichment?.articleUrls ?? {},
      countries: enrichment?.countries ?? [],
      image: enrichment?.image,
      tagline: enrichment?.tagline,
      taglineRu: enrichment?.taglineRu,
      approximateDate: enrichment?.approximateDate,
      endApproximateDate: enrichment?.endApproximateDate,
      year: enrichment?.year,
      month: enrichment?.month,
      endYear: enrichment?.endYear,
      endMonth: enrichment?.endMonth,
    };
  });

  const outputPath = path.join(RAW_DIR, 'conflicts-curated-enriched.raw.json');
  const conflicts = await mergeEnriched(
    outputPath,
    'conflicts',
    curated.conflicts.map((conflict) => conflict.id),
    enriched,
    qids,
  );
  await writeFile(outputPath, JSON.stringify({ conflicts }, null, 2));
  console.log(`Wrote ${conflicts.length} enriched conflicts to ${outputPath}`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  fetchConflictsEnrichment().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
