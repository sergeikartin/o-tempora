import type { ProfileLane } from '@o-tempora/shared-types';
import {
  buildConflicts,
  buildMilestones,
  buildPeople,
} from '../output/write-datasets.js';
import {
  transformConflicts,
  transformMilestones,
  transformPeople,
} from '../transform/index.js';

// An entity in the dataset that can have a Profile, as the profile-writer
// agent is briefed about it.
export interface ProfileSubject {
  // Wikidata QID; a Person's dataset `id` is Pantheon's, so it is not this.
  qid: string;
  lane: ProfileLane;
  name: string;
  dates: string;
  wikipediaUrl: string;
}

// The prompt's `{type}` for each lane.
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
  // A living person: the span runs to now.
  ongoing?: boolean;
  approximate?: boolean;
}

// "1969", "1789–1799", "551–479 BC", "44 BC–AD 14", "1950–present"; "c. "
// leads an approximate date. A CE year below 1000 is written "AD 476" so it
// is not read as a bare number.
export function formatDates(span: DateSpan): string {
  const start = bcOrAd(span.startYear);
  const end = span.endYear === undefined ? undefined : bcOrAd(span.endYear);
  const lead = span.approximate ? 'c. ' : '';
  const ce = (year: number) => (year < 1000 ? `AD ${year}` : `${year}`);

  if (!end || span.endYear === span.startYear) {
    const label = start.bc ? `${start.value} BC` : ce(start.value);
    return `${lead}${label}${span.ongoing && !end ? '–present' : ''}`;
  }
  if (start.bc && end.bc) return `${lead}${start.value}–${end.value} BC`;
  if (start.bc) return `${lead}${start.value} BC–AD ${end.value}`;
  return `${lead}${ce(start.value)}–${end.value}`;
}

// Entities that made the dataset (Output's inclusion rules), in a stable
// order. One without an English Wikipedia article cannot be briefed to the
// writer and is left out.
export function loadSubjects(): ProfileSubject[] {
  const subjects: ProfileSubject[] = [];

  const peopleRows = transformPeople();
  const personRowById = new Map(peopleRows.map((row) => [row.id, row]));
  for (const person of buildPeople(peopleRows, 'en').people) {
    const row = personRowById.get(person.id);
    if (row?.birthyear === undefined) continue;
    subjects.push({
      qid: row.wdId,
      lane: 'people',
      name: person.name,
      dates: formatDates({
        startYear: row.birthyear,
        endYear: row.deathyear,
        ongoing: row.alive,
      }),
      wikipediaUrl: row.wikipediaUrl,
    });
  }

  const conflictRowById = new Map(
    transformConflicts().map((row) => [row.id, row]),
  );
  const { entries: conflicts } = buildConflicts([...conflictRowById.values()]);
  for (const conflict of conflicts) {
    const row = conflictRowById.get(conflict.id);
    if (row?.year === undefined || !row.article) continue;
    subjects.push({
      qid: conflict.id,
      lane: 'conflicts',
      name: conflict.name,
      dates: formatDates({ startYear: row.year, endYear: row.endYear }),
      wikipediaUrl: row.article,
    });
  }

  const milestoneRowById = new Map(
    transformMilestones().map((row) => [row.id, row]),
  );
  const { milestones } = buildMilestones([...milestoneRowById.values()]);
  for (const milestone of milestones) {
    const row = milestoneRowById.get(milestone.id);
    if (row?.year === undefined || !row.article) continue;
    subjects.push({
      qid: milestone.id,
      lane: 'milestones',
      name: milestone.name,
      dates: formatDates({
        startYear: row.year,
        endYear: row.endYear,
        approximate: row.approximateDate,
      }),
      wikipediaUrl: row.article,
    });
  }

  return subjects;
}
