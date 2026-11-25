import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ConflictCategory,
  MilestoneCategory,
  Region,
} from '@o-tempora/shared-types';
import { validateEnrichedConflictsFile } from '../fetch/fetch-conflicts-enrichment.ts';
import { validateEnrichedMilestonesFile } from '../fetch/fetch-milestones-enrichment.ts';
import {
  type PantheonPersonRow,
  parsePantheonCsv,
} from '../fetch/pantheon-row-shape.ts';
import { validateSparqlResultShape } from '../fetch/validate-sparql-result.ts';
import { correctPersonDates } from './person-date-corrections.ts';
import { rankByFameScore, scoreAndRankByHpi } from './score.ts';
import { tagCuratedConflict, tagCuratedMilestone } from './tag-milestones.ts';
import {
  type PantheonPersonTags,
  tagPantheonPerson,
} from './tag-pantheon-person.ts';

// Display names come from Wikidata labels, so Pantheon’s name is excluded.
export type TaggedPerson = Omit<PantheonPersonRow, 'name'> &
  PantheonPersonTags & {
    name?: string;
    nameRu?: string;
    tagline?: string;
    taglineRu?: string;
    // Wikipedia lead-paragraph extract (fetch-wikipedia-extracts.ts); independent
    // of tagline, never a fallback for it. Absent never drops the row (only a
    // missing tagline does).
    description?: string;
    descriptionRu?: string;
    wikipediaUrl: string;
    image?: string;
    imageAttribution?: string;
  };

export interface TaggedMilestone {
  id: string;
  label: string;
  labelRu?: string;
  article?: string;
  tagline?: string;
  taglineRu?: string;
  description?: string;
  descriptionRu?: string;
  year?: number;
  month?: number;
  endYear?: number;
  endMonth?: number;
  approximateDate?: true;
  endApproximateDate?: true;

  sitelinks: number;
  fameScore: number;
  category: MilestoneCategory;
  regionTags: Region[];
  image?: string;
  imageAttribution?: string;
}

export interface TaggedConflict {
  id: string;
  label: string;
  labelRu?: string;
  article?: string;
  tagline?: string;
  taglineRu?: string;
  description?: string;
  descriptionRu?: string;
  year?: number;
  month?: number;
  endYear?: number;
  endMonth?: number;
  approximateDate?: true;
  endApproximateDate?: true;
  sitelinks: number;
  fameScore: number;
  category: ConflictCategory;
  regionTags: Region[];
  image?: string;
  imageAttribution?: string;
  parentId?: string;
}

const RAW_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'data',
  'raw',
);

function loadRaw(fileName: string) {
  return validateSparqlResultShape(
    JSON.parse(fs.readFileSync(path.join(RAW_DIR, fileName), 'utf8')),
  );
}

const ENTITY_URI_PATTERN = /\/entity\/(Q\d+)$/;

interface PersonEnrichment {
  name?: string;
  nameRu?: string;
  tagline?: string;
  taglineRu?: string;
  image?: string;
}

// Keyed by Wikidata QID from the tagline query's ?person binding. Also carries
// the P18 image URI and the English+Russian name/tagline the same query
// backfills (queries/taglines.ts); name replaces Pantheon's CSV `name` as the
// source of a person's display name. Every field is single-valued
// (FILTER(LANG=..) per language) except P18: a person with several image
// claims yields several binding rows, so the first value per person per field
// wins (as in fetchMilestonesEnrichment's merge) instead of the last row
// overwriting it.
function loadPeopleEnrichmentMap(): Map<string, PersonEnrichment> {
  const raw = loadRaw('people-taglines.raw.json');
  const map = new Map<string, PersonEnrichment>();
  for (const row of raw.results.bindings) {
    const personUri = row.person?.value;
    if (!personUri) continue;
    const match = ENTITY_URI_PATTERN.exec(personUri);
    if (!match?.[1]) continue;
    const id = match[1];
    const existing = map.get(id);
    map.set(id, {
      name: existing?.name ?? row.nameEn?.value,
      nameRu: existing?.nameRu ?? row.nameRu?.value,
      tagline: existing?.tagline ?? row.tagline?.value,
      taglineRu: existing?.taglineRu ?? row.taglineRu?.value,
      image: existing?.image ?? row.image?.value,
    });
  }
  return map;
}

// fetch-image-attribution.ts, fetch-pageviews.ts and
// fetch-wikipedia-extracts.ts each write one raw file per lane
// (docs/adr/0012-lane-scoped-fetch.md), keyed by Wikidata QID for People and
// by the curated row's id for Conflicts/Milestones. A missing id means that
// stage resolved nothing for this entity: image attribution and Wikipedia
// extract become absent fields, never a dropped row (only a missing `tagline`
// drops). Pageviews coerce to 0 at the call site, so score.ts's blend degrades
// to a sitelinks-only score (docs/adr/0010).
function loadRawRecord<T>(fileName: string): Record<string, T> {
  return (
    (JSON.parse(fs.readFileSync(path.join(RAW_DIR, fileName), 'utf8')) as
      | Record<string, T>
      | undefined) ?? {}
  );
}

export function transformPeople(): TaggedPerson[] {
  const csvPath = path.join(RAW_DIR, 'people-pantheon.raw.csv');
  const rows = parsePantheonCsv(fs.readFileSync(csvPath, 'utf8')).map(
    correctPersonDates,
  );
  const enrichment = loadPeopleEnrichmentMap();
  const imageAttribution = loadRawRecord<string>(
    'people-image-attribution.raw.json',
  );
  const wikipediaExtracts = loadRawRecord<string>(
    'people-wikipedia-extracts.raw.json',
  );
  const wikipediaExtractsRu = loadRawRecord<string>(
    'people-wikipedia-extracts.ru.raw.json',
  );

  const tagged = rows.map((row) => ({
    ...row,
    ...tagPantheonPerson(row),
    name: enrichment.get(row.wdId)?.name,
    nameRu: enrichment.get(row.wdId)?.nameRu,
    tagline: enrichment.get(row.wdId)?.tagline,
    taglineRu: enrichment.get(row.wdId)?.taglineRu,
    description: wikipediaExtracts[row.wdId],
    descriptionRu: wikipediaExtractsRu[row.wdId],
    wikipediaUrl: `https://en.wikipedia.org/wiki/${row.slug}`,
    image: enrichment.get(row.wdId)?.image,
    imageAttribution: imageAttribution[row.wdId],
  }));

  return scoreAndRankByHpi(tagged);
}

// From the hand-curated, enriched conflicts list (fetch-conflicts-enrichment.ts
// output), already one row per conflict, so no groupRows step (as for
// People/Milestones). A missing enriched `sitelinks` means enrichment couldn't
// resolve the QID; it is coerced to 0 so the row sorts last and
// buildConflicts drops it explicitly (as transformMilestones does).
// name/tagline/year/endYear are enrichment-sourced, left `undefined` (label
// falls back to `""`, matching validateEventRow's `!row.label` check) so
// buildConflicts can tell "no date" (drop) from "one date" (ConflictEvent) from
// "two dates" (Conflict). Milestones' year/endYear work the same way for
// buildMilestones' point-vs-period split.
export function transformConflicts(): TaggedConflict[] {
  const enrichedPath = path.join(
    RAW_DIR,
    'conflicts-curated-enriched.raw.json',
  );
  const { conflicts } = validateEnrichedConflictsFile(
    JSON.parse(fs.readFileSync(enrichedPath, 'utf8')),
  );
  const imageAttribution = loadRawRecord<string>(
    'conflicts-image-attribution.raw.json',
  );
  const pageviews = loadRawRecord<number>('conflicts-pageviews.raw.json');
  const wikipediaExtracts = loadRawRecord<string>(
    'conflicts-wikipedia-extracts.raw.json',
  );
  const wikipediaExtractsRu = loadRawRecord<string>(
    'conflicts-wikipedia-extracts.ru.raw.json',
  );

  const tagged = conflicts.map((conflict) => {
    const { category, regionTags } = tagCuratedConflict(
      conflict.category,
      conflict.countries,
    );
    return {
      id: conflict.id,
      label: conflict.name ?? '',
      labelRu: conflict.nameRu,
      article: conflict.wikipediaUrl,
      tagline: conflict.tagline,
      taglineRu: conflict.taglineRu,
      description: wikipediaExtracts[conflict.id],
      descriptionRu: wikipediaExtractsRu[conflict.id],
      approximateDate: conflict.approximateDate,
      endApproximateDate: conflict.endApproximateDate,
      year: conflict.year,
      month: conflict.month,
      endYear: conflict.endYear,
      endMonth: conflict.endMonth,
      sitelinks: conflict.sitelinks ?? 0,
      pageviews: pageviews[conflict.id] ?? 0,
      category,
      regionTags,
      image: conflict.image,
      imageAttribution: imageAttribution[conflict.id],
      parentId: conflict.parentId,
    };
  });

  return rankByFameScore(tagged);
}

// From the hand-curated, enriched milestones list (fetch-milestones-enrichment.ts
// output), one row per milestone, so no groupRows step. A missing enriched
// `sitelinks` is coerced to 0 so the row sorts last and buildMilestones drops
// it explicitly. name is enrichment-sourced too: label falls back to `""`
// (matching validateEventRow's `!row.label`) when no English label resolved.
export function transformMilestones(): TaggedMilestone[] {
  const enrichedPath = path.join(
    RAW_DIR,
    'milestones-curated-enriched.raw.json',
  );
  const { milestones } = validateEnrichedMilestonesFile(
    JSON.parse(fs.readFileSync(enrichedPath, 'utf8')),
  );
  const imageAttribution = loadRawRecord<string>(
    'milestones-image-attribution.raw.json',
  );
  const pageviews = loadRawRecord<number>('milestones-pageviews.raw.json');
  const wikipediaExtracts = loadRawRecord<string>(
    'milestones-wikipedia-extracts.raw.json',
  );
  const wikipediaExtractsRu = loadRawRecord<string>(
    'milestones-wikipedia-extracts.ru.raw.json',
  );

  const tagged = milestones.map((milestone) => {
    const { category, regionTags } = tagCuratedMilestone(
      milestone.category,
      milestone.countries,
    );
    return {
      id: milestone.id,
      label: milestone.name ?? '',
      labelRu: milestone.nameRu,
      article: milestone.wikipediaUrl,
      tagline: milestone.tagline,
      taglineRu: milestone.taglineRu,
      description: wikipediaExtracts[milestone.id],
      descriptionRu: wikipediaExtractsRu[milestone.id],
      year: milestone.year,
      month: milestone.month,
      endYear: milestone.endYear,
      endMonth: milestone.endMonth,
      approximateDate: milestone.approximateDate,
      endApproximateDate: milestone.endApproximateDate,
      sitelinks: milestone.fameSitelinks ?? milestone.sitelinks ?? 0,
      pageviews: pageviews[milestone.id] ?? 0,
      category,
      regionTags,
      image: milestone.image,
      imageAttribution: imageAttribution[milestone.id],
    };
  });

  return rankByFameScore(tagged);
}
