import type { ProfileLane } from '@o-tempora/shared-types';
import {
  buildConflicts,
  buildMilestones,
  buildPeople,
} from '../output/write-datasets.js';
import {
  type TaggedConflict,
  type TaggedMilestone,
  type TaggedPerson,
  transformConflicts,
  transformMilestones,
  transformPeople,
} from '../transform/index.js';

export interface ProfileSubject {
  // Wikidata QID; a Person's dataset `id` is Pantheon's, so it is not this.
  qid: string;
  lane: ProfileLane;
  name: string;
  dateSpan: DateSpan;
  wikipediaUrl: string;
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

interface DateSpan {
  startYear: number;
  endYear?: number;
  ongoing?: boolean;
  approximate?: boolean;
  endApproximate?: boolean;
}

export function subjectBrief({
  qid,
  lane,
  name,
  dateSpan,
  wikipediaUrl,
}: ProfileSubject) {
  return { qid, lane, name, dates: formatDates(dateSpan), wikipediaUrl };
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
        dateSpan:
          row.year === undefined
            ? undefined
            : {
                startYear: row.year,
                endYear: row.endYear,
                approximate: row.approximateDate,
                endApproximate: row.endApproximateDate,
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
          dateSpan:
            row.birthyear === undefined
              ? undefined
              : {
                  startYear: row.birthyear,
                  endYear: row.deathyear,
                  ongoing: row.alive,
                },
        },
      ]),
    ),
    conflicts: indexEventSources(conflicts),
    milestones: indexEventSources(milestones),
  };
}

// The writer only gets subjects included in Output with an English Wikipedia article.
export function loadSubjects(): ProfileSubject[] {
  const people = transformPeople();
  const conflicts = transformConflicts();
  const milestones = transformMilestones();
  const sources = indexProfileSources(people, conflicts, milestones);

  function subjectsFor(
    lane: ProfileLane,
    entries: readonly { id: string; name: string }[],
  ) {
    return entries.flatMap(({ id, name }): ProfileSubject[] => {
      const source = sources[lane].get(id);
      if (!source?.dateSpan || !source.wikipediaUrl) return [];
      const { qid, dateSpan, wikipediaUrl } = source;
      return [{ qid, lane, name, dateSpan, wikipediaUrl }];
    });
  }

  return [
    ...subjectsFor('people', buildPeople(people, 'en').people),
    ...subjectsFor('conflicts', buildConflicts(conflicts).entries),
    ...subjectsFor('milestones', buildMilestones(milestones).milestones),
  ];
}
