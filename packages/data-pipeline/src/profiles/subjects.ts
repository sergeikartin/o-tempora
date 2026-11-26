import { randomUUID } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {
  DETAIL_LEVEL_FAME_SCORE_FLOORS,
  type ProfileLane,
} from '@o-tempora/shared-types';
import { assignSlugs } from '../output/slugs.ts';
import {
  buildConflicts,
  buildMilestones,
  buildPeople,
  detailLevelOf,
} from '../output/write-datasets.ts';
import {
  type TaggedConflict,
  type TaggedMilestone,
  type TaggedPerson,
  transformConflicts,
  transformMilestones,
  transformPeople,
} from '../transform/index.ts';
import { PACKAGE_DIR, SUBJECTS_CACHE_PATH } from './paths.ts';

export interface ProfileSubjectRu {
  name?: string;
  tagline?: string;
  description?: string;
}

export interface DateSpan {
  startYear: number;
  endYear?: number;
  ongoing?: boolean;
  approximate?: boolean;
  endApproximate?: boolean;
}

export interface ProfileSubject {
  // Wikidata QID; a Person's dataset `id` is Pantheon's, so it is not this.
  qid: string;
  lane: ProfileLane;
  slug: string;
  name: string;
  tagline?: string;
  dateSpan: DateSpan;
  wikipediaUrl: string;
  fameScore: number;
  detailLevel: 1 | 2 | 3 | 4;
  ru?: ProfileSubjectRu;
}

export const SUBJECT_TYPE: Record<ProfileLane, string> = {
  people: 'person',
  conflicts: 'conflict',
  milestones: 'milestone',
};

// Years are astronomical (docs/adr/0001-astronomical-year-numbering.md); the
// writer is briefed in BC/AD, so the "no year 0" conversion happens here.
function bcOrAd(year: number): { value: number; bc: boolean } {
  return year <= 0 ? { value: 1 - year, bc: true } : { value: year, bc: false };
}

export function subjectBrief({
  qid,
  lane,
  slug,
  name,
  tagline,
  dateSpan,
  wikipediaUrl,
}: ProfileSubject) {
  return {
    qid,
    lane,
    slug,
    name,
    ...(tagline ? { tagline } : {}),
    dates: formatDates(dateSpan),
    wikipediaUrl,
  };
}

// "1969", "1789–1799", "551–479 BC", "44 BC–AD 14", "1950–present"; "c. "
// leads an approximate date. A CE year below 1000 is written "AD 476" so it
// is not read as a bare number.
export function formatDates(span: DateSpan): string {
  const start = bcOrAd(span.startYear);
  const end = span.endYear === undefined ? undefined : bcOrAd(span.endYear);
  const lead = span.approximate ? 'c. ' : '';
  const endLead = span.endApproximate ? 'c. ' : '';
  const ce = (year: number) => (year < 1000 ? `AD ${year}` : `${year}`);

  if (
    !end ||
    (span.endYear === span.startYear &&
      !!span.approximate === !!span.endApproximate)
  ) {
    const label = start.bc ? `${start.value} BC` : ce(start.value);
    return `${lead}${label}${span.ongoing && !end ? '–present' : ''}`;
  }
  if (start.bc && end.bc)
    return `${lead}${start.value}–${endLead}${end.value} BC`;
  if (start.bc) return `${lead}${start.value} BC–${endLead}AD ${end.value}`;
  return `${lead}${ce(start.value)}–${endLead}${end.value}`;
}

interface ProfileSource {
  qid: string;
  dateSpan?: DateSpan;
  wikipediaUrl?: string;
  tagline?: string;
  ru?: ProfileSubjectRu;
}

function russianMetadata(
  name: string | undefined,
  { taglineRu, descriptionRu }: TaggedPerson | TaggedConflict | TaggedMilestone,
): ProfileSubjectRu | undefined {
  if (!name && !taglineRu && !descriptionRu) return;
  return {
    ...(name ? { name } : {}),
    ...(taglineRu ? { tagline: taglineRu } : {}),
    ...(descriptionRu ? { description: descriptionRu } : {}),
  };
}

function indexEventSources(
  rows: readonly (TaggedConflict | TaggedMilestone)[],
) {
  return new Map<string, ProfileSource>(
    rows.map((row) => [
      row.id,
      {
        qid: row.id,
        wikipediaUrl: row.article,
        tagline: row.tagline,
        ru: russianMetadata(row.labelRu, row),
        dateSpan:
          row.year === undefined
            ? undefined
            : {
                startYear: row.year,
                ...(row.endYear === undefined ? {} : { endYear: row.endYear }),
                ...(row.approximateDate ? { approximate: true } : {}),
                ...(row.endApproximateDate ? { endApproximate: true } : {}),
              },
      },
    ]),
  );
}

export function indexProfileSources(
  people: readonly TaggedPerson[],
  conflicts: readonly TaggedConflict[],
  milestones: readonly TaggedMilestone[],
): Record<ProfileLane, ReadonlyMap<string, ProfileSource>> {
  return {
    people: new Map(
      people.map((row) => [
        row.id,
        {
          qid: row.wdId,
          wikipediaUrl: row.wikipediaUrl,
          tagline: row.tagline,
          ru: russianMetadata(row.nameRu, row),
          dateSpan:
            row.birthyear === undefined
              ? undefined
              : {
                  startYear: row.birthyear,
                  ...(row.deathyear === undefined
                    ? {}
                    : { endYear: row.deathyear }),
                  ongoing: row.alive,
                },
        },
      ]),
    ),
    conflicts: indexEventSources(conflicts),
    milestones: indexEventSources(milestones),
  };
}

// Subjects included in Output with an English Wikipedia article, enriched with
// their dataset slug and Detail Level for offline Connection lookup and status.
export function buildProfileSubjects(
  sources: ReturnType<typeof indexProfileSources>,
  entries: Record<
    ProfileLane,
    readonly { id: string; name: string; fameScore: number; slug?: string }[]
  >,
): ProfileSubject[] {
  const needsSlugs = (['people', 'conflicts', 'milestones'] as const).some(
    (lane) => entries[lane].some((entry) => !entry.slug),
  );
  const slugOf = needsSlugs
    ? assignSlugs([
        ...entries.people,
        ...entries.conflicts,
        ...entries.milestones,
      ])
    : undefined;

  return (['people', 'conflicts', 'milestones'] as const).flatMap((lane) =>
    entries[lane].flatMap(({ id, name, fameScore, slug }): ProfileSubject[] => {
      const source = sources[lane].get(id);
      if (!source?.dateSpan || !source.wikipediaUrl) return [];
      const { qid, dateSpan, wikipediaUrl, tagline, ru } = source;
      return [
        {
          qid,
          lane,
          slug: slug ?? slugOf?.get(id) ?? id,
          name,
          ...(tagline ? { tagline } : {}),
          dateSpan,
          wikipediaUrl,
          fameScore,
          detailLevel: detailLevelOf(
            fameScore,
            DETAIL_LEVEL_FAME_SCORE_FLOORS[lane],
          ),
          ...(ru ? { ru } : {}),
        },
      ];
    }),
  );
}

function computeSubjects(): ProfileSubject[] {
  const people = transformPeople();
  const conflicts = transformConflicts();
  const milestones = transformMilestones();
  return buildProfileSubjects(
    indexProfileSources(people, conflicts, milestones),
    {
      people: buildPeople(people, 'en').people,
      conflicts: buildConflicts(conflicts).entries,
      milestones: buildMilestones(milestones).milestones,
    },
  );
}

type InputStats = Record<string, { size: number; mtimeMs: number }>;
interface CacheOptions {
  cachePath?: string;
  statInputs?: () => InputStats;
}

const CACHE_VERSION = 3;

export function statSubjectInputs(): InputStats {
  const files = [
    'people-pantheon.raw.csv',
    'people-taglines.raw.json',
    ...['conflicts', 'milestones'].flatMap((lane) => [
      `${lane}-curated-enriched.raw.json`,
      `${lane}-pageviews.raw.json`,
    ]),
    ...['people', 'conflicts', 'milestones'].flatMap((lane) => [
      `${lane}-image-attribution.raw.json`,
      `${lane}-wikipedia-extracts.raw.json`,
      `${lane}-wikipedia-extracts.ru.raw.json`,
    ]),
  ].map((file) => `data/raw/${file}`);
  files.push('src/transform/person-date-corrections.ts');
  return Object.fromEntries(
    files.map((file) => {
      const { size, mtimeMs } = statSync(path.join(PACKAGE_DIR, file));
      return [file, { size, mtimeMs }];
    }),
  );
}

function sameInputs(
  saved: InputStats | undefined,
  current: InputStats,
): boolean {
  return (
    !!saved &&
    Object.keys(saved).length === Object.keys(current).length &&
    Object.entries(current).every(
      ([file, stat]) =>
        saved[file]?.size === stat.size &&
        saved[file]?.mtimeMs === stat.mtimeMs,
    )
  );
}

export function writeSubjectsCache(
  subjects: ProfileSubject[],
  {
    cachePath = SUBJECTS_CACHE_PATH,
    statInputs = statSubjectInputs,
  }: CacheOptions = {},
  inputsBeforeBuild?: InputStats,
): void {
  const temporary = `${cachePath}.${randomUUID()}.tmp`;
  try {
    const inputs = statInputs();
    if (inputsBeforeBuild && !sameInputs(inputsBeforeBuild, inputs)) return;
    mkdirSync(path.dirname(cachePath), { recursive: true });
    writeFileSync(
      temporary,
      JSON.stringify({ schema_version: CACHE_VERSION, inputs, subjects }),
    );
    renameSync(temporary, cachePath);
  } catch {
    try {
      rmSync(temporary, { force: true });
    } catch {}
  }
}

function isCachedSubject(subject: ProfileSubject | null): boolean {
  return (
    !!subject &&
    typeof subject.qid === 'string' &&
    typeof subject.slug === 'string' &&
    Object.hasOwn(SUBJECT_TYPE, subject.lane) &&
    typeof subject.name === 'string' &&
    typeof subject.wikipediaUrl === 'string' &&
    typeof subject.fameScore === 'number' &&
    (subject.detailLevel === 1 ||
      subject.detailLevel === 2 ||
      subject.detailLevel === 3 ||
      subject.detailLevel === 4) &&
    Number.isFinite(subject.dateSpan?.startYear) &&
    (subject.dateSpan.endYear === undefined ||
      Number.isFinite(subject.dateSpan.endYear))
  );
}

export function loadSubjects({
  cachePath = SUBJECTS_CACHE_PATH,
  bypassCache = false,
  compute = computeSubjects,
  readOnly = false,
  statInputs = statSubjectInputs,
}: CacheOptions & {
  bypassCache?: boolean;
  readOnly?: boolean;
  compute?: () => ProfileSubject[];
} = {}): ProfileSubject[] {
  if (bypassCache) return compute();
  let inputs: InputStats | undefined;
  try {
    inputs = statInputs();
    const cache = JSON.parse(readFileSync(cachePath, 'utf8'));
    if (
      cache?.schema_version === CACHE_VERSION &&
      sameInputs(cache.inputs, inputs) &&
      Array.isArray(cache.subjects) &&
      cache.subjects.every(isCachedSubject)
    )
      return cache.subjects;
  } catch {
    // Missing or stale cache rebuilds below.
  }
  const subjects = compute();
  if (inputs && !readOnly)
    writeSubjectsCache(subjects, { cachePath, statInputs }, inputs);
  return subjects;
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function extractWikiTitle(query: string): string | undefined {
  try {
    const url = new URL(query);
    if (
      url.hostname.endsWith('wikipedia.org') &&
      url.pathname.startsWith('/wiki/')
    ) {
      return decodeURIComponent(url.pathname.slice('/wiki/'.length));
    }
  } catch {}
  return undefined;
}

export interface EntityMatch {
  qid: string;
  slug: string;
  name: string;
  lane: ProfileLane;
  dates: string;
  detailLevel: 1 | 2 | 3 | 4;
  tagline?: string;
}

// Offline lookup across all dataset entities for picking Connection QIDs.
export function findEntities(
  subjects: readonly ProfileSubject[],
  query: string,
  limit = 5,
): EntityMatch[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const wikiTitle = extractWikiTitle(trimmed);
  const needle = normalizeSearch(wikiTitle ?? trimmed);
  if (!needle) return [];

  const scored: { subject: ProfileSubject; rank: number }[] = [];
  for (const subject of subjects) {
    const qidNorm = subject.qid.toLowerCase();
    const nameNorm = normalizeSearch(subject.name);
    const slugNorm = normalizeSearch(subject.slug);
    const ruNorm = subject.ru?.name ? normalizeSearch(subject.ru.name) : '';
    const wikiNorm = normalizeSearch(
      extractWikiTitle(subject.wikipediaUrl) ?? '',
    );
    const taglineNorm = subject.tagline ? normalizeSearch(subject.tagline) : '';

    let rank = 0;
    if (
      qidNorm === needle ||
      nameNorm === needle ||
      slugNorm === needle ||
      wikiNorm === needle ||
      (ruNorm && ruNorm === needle)
    ) {
      rank = 4;
    } else if (
      nameNorm.startsWith(needle) ||
      slugNorm.startsWith(needle) ||
      (ruNorm && ruNorm.startsWith(needle))
    ) {
      rank = 3;
    } else if (
      nameNorm.includes(needle) ||
      slugNorm.includes(needle) ||
      wikiNorm.includes(needle) ||
      (ruNorm && ruNorm.includes(needle))
    ) {
      rank = 2;
    } else if (taglineNorm.includes(needle)) {
      rank = 1;
    }

    if (rank > 0) scored.push({ subject, rank });
  }

  scored.sort(
    (a, b) => b.rank - a.rank || b.subject.fameScore - a.subject.fameScore,
  );

  return scored.slice(0, limit).map(({ subject }) => ({
    qid: subject.qid,
    slug: subject.slug,
    name: subject.name,
    lane: subject.lane,
    dates: formatDates(subject.dateSpan),
    detailLevel: subject.detailLevel,
    ...(subject.tagline ? { tagline: subject.tagline } : {}),
  }));
}
