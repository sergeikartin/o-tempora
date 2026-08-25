import { expect, test } from 'vitest';
import { today } from '../../shared/lib/date';
import type {
  Conflict,
  ConflictEvent,
  Milestone,
  Person,
} from '../../shared/types';
import {
  compactRows,
  computeRowAssignment,
  mapConflicts,
  mapMilestones,
  mapPeople,
} from './map-to-items';

const person: Person = {
  id: 'Q868',
  name: 'Aristotle',
  lifespan: { start: { year: -383 }, end: { year: -321 } },
  occupationDomain: 'humanities',
  regionTags: [],
  fameScore: 317,
  tagline: '4th-century BCE Classical Greek philosopher and polymath',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Aristotle',
};

const personWithoutDeathYear: Person = {
  ...person,
  id: 'Q40939',
  name: 'Hesiod',
  lifespan: { start: { year: -750 }, end: undefined },
};

test('mapPeople maps a person with both years to an item with matching start/end', () => {
  const [item] = mapPeople([person]);
  expect(item?.id).toBe(person.id);
  expect(item?.name).toBe('Aristotle');
  expect(item?.startYear).toBe(-383);
  expect(item?.endYear).toBe(-321);
  expect(item?.occupationDomain).toBe('humanities');
  expect(item?.fameScore).toBe(317);
});

test('mapPeople falls back to today when lifespan.end is missing — still alive, not a collapsed bar', () => {
  const [item] = mapPeople([personWithoutDeathYear]);
  expect(item?.endYear).toBe(today());
});

const personWithMonths: Person = {
  ...person,
  id: 'Q1000',
  name: 'Someone',
  lifespan: { start: { year: 1900, month: 7 }, end: { year: 1980, month: 1 } },
};

test('mapPeople offsets startYear/endYear within their year when lifespan dates carry a month', () => {
  const [item] = mapPeople([personWithMonths]);
  expect(item?.startYear).toBeCloseTo(1900 + 6 / 12);
  expect(item?.endYear).toBe(1980);
});

const conflictWithEndYear: Conflict = {
  id: 'Q8214',
  name: 'Korean War',
  period: { start: { year: 1950 }, end: { year: 1953 } },
  category: 'war',
  regionTags: ['eastern-asia'],
  fameScore: 350,
  tagline: 'war on the Korean peninsula',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Korean_War',
};

const conflictZeroWidth: Conflict = {
  ...conflictWithEndYear,
  id: 'Q166376',
  name: 'Six-Day War',
  period: { start: { year: 1967 }, end: { year: 1967 } },
};

const battle: ConflictEvent = {
  id: 'Q217799',
  name: 'Battle of Megiddo',
  at: { year: -1457 },
  category: 'war',
  regionTags: ['northern-america'],
  fameScore: 250,
  tagline: 'ancient battle',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Battle_of_Megiddo',
};

test('mapConflicts maps a Conflict to a range item (isPoint: false)', () => {
  const [item] = mapConflicts([conflictWithEndYear]);
  expect(item?.isPoint).toBe(false);
  expect(item?.startYear).toBe(1950);
  expect(item?.endYear).toBe(1953);
  expect(item?.category).toBe('war');
  expect(item?.fameScore).toBe(350);
});

test('mapConflicts widens a zero-width conflict range (start === end) by one year', () => {
  const [item] = mapConflicts([conflictZeroWidth]);
  expect(item?.isPoint).toBe(false);
  expect(item?.startYear).toBe(1967);
  expect(item?.endYear).toBe(1968);
});

test('mapConflicts maps a ConflictEvent to a point item', () => {
  const [item] = mapConflicts([battle]);
  expect(item?.isPoint).toBe(true);
  expect(item?.startYear).toBe(-1457);
  expect(item?.endYear).toBe(-1457);
});

const conflictWithMonths: Conflict = {
  ...conflictWithEndYear,
  id: 'Q9000',
  name: 'Conflict with known months',
  period: { start: { year: 1950, month: 6 }, end: { year: 1953, month: 7 } },
};

test('mapConflicts offsets startYear/endYear within their year when period dates carry a month', () => {
  const [item] = mapConflicts([conflictWithMonths]);
  expect(item?.startYear).toBeCloseTo(1950 + 5 / 12);
  expect(item?.endYear).toBeCloseTo(1953 + 6 / 12);
});

const battleWithMonth: ConflictEvent = {
  ...battle,
  id: 'Q9001',
  name: 'Battle with known month',
  at: { year: 1457, month: 4 },
};

test('mapConflicts offsets a ConflictEvent point within its year when at carries a month', () => {
  const [item] = mapConflicts([battleWithMonth]);
  expect(item?.startYear).toBeCloseTo(1457 + 3 / 12);
  expect(item?.endYear).toBe(item?.startYear);
});

const milestone: Milestone = {
  id: 'Q11042',
  name: 'Printing press',
  at: { year: 1440 },
  category: 'communication',
  regionTags: ['western-europe'],
  fameScore: 386,
  tagline: 'device for applying pressure to transfer ink onto paper',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Printing_press',
};

test('mapMilestones maps a milestone to a point item at its at.year', () => {
  const [item] = mapMilestones([milestone]);
  expect(item?.id).toBe(milestone.id);
  expect(item?.name).toBe('Printing press');
  expect(item?.startYear).toBe(1440);
  expect(item?.category).toBe('communication');
  expect(item?.fameScore).toBe(386);
});

const milestoneWithMonth: Milestone = {
  ...milestone,
  id: 'Q9002',
  name: 'Milestone with known month',
  at: { year: 1440, month: 10 },
};

test('mapMilestones offsets startYear within its year when at carries a month', () => {
  const [item] = mapMilestones([milestoneWithMonth]);
  expect(item?.startYear).toBeCloseTo(1440 + 9 / 12);
});

const blackDeath: Milestone = {
  id: 'Q42005',
  name: 'Black Death',
  period: { start: { year: 1346 }, end: { year: 1353 } },
  category: 'medicine-health',
  regionTags: ['western-europe'],
  fameScore: 84,
  tagline: '1346-1353 pandemic in Eurasia and North Africa',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Black_Death',
};

test('mapMilestones maps a period-shaped milestone to a range item (isPoint: false)', () => {
  const [item] = mapMilestones([blackDeath]);
  expect(item?.isPoint).toBe(false);
  expect(item?.startYear).toBe(1346);
  expect(item?.endYear).toBe(1353);
});

test('mapMilestones widens a zero-width milestone range (start === end) by one year', () => {
  const zeroWidth: Milestone = {
    ...blackDeath,
    id: 'Q9003',
    period: { start: { year: 1346 }, end: { year: 1346 } },
  };
  const [item] = mapMilestones([zeroWidth]);
  expect(item?.isPoint).toBe(false);
  expect(item?.startYear).toBe(1346);
  expect(item?.endYear).toBe(1347);
});

// computeRowAssignment / compactRows — reads each entry's permanent
// TimelineEntry.row (data-pipeline's Output-stage row-packing, moved there
// by docs/adr/0005-row-assignment-moves-to-the-pipeline.md — see
// packages/data-pipeline/src/output/row-assignment.test.ts for the packing
// algorithm's own tests) and compacts it down to whatever's currently
// visible (PeopleLane/ConflictsMilestonesLane's use of personRowFor/
// eventsRowFor).

test('computeRowAssignment gives two time-overlapping people different rows, the more famous one row 0', () => {
  const famous: Person = { ...person, id: 'Q-famous', fameScore: 999, row: 0 };
  const obscure: Person = { ...person, id: 'Q-obscure', fameScore: 1, row: 1 };
  const rows = computeRowAssignment([famous, obscure], [], []).personRowFor([
    'Q-famous',
    'Q-obscure',
  ]);
  expect(rows.get('Q-famous')).toBe(0);
  expect(rows.get('Q-obscure')).not.toBe(0);
});

test('computeRowAssignment reads each entry off its own precomputed row, unaffected by fameScore or overlap', () => {
  const rowedConflict: Conflict = { ...conflictWithEndYear, row: 3 };
  const rowedMilestone: Milestone = { ...milestone, row: 3 };
  const rows = computeRowAssignment(
    [],
    [rowedConflict],
    [rowedMilestone],
  ).eventsRowFor([rowedConflict.id, rowedMilestone.id]);
  expect(rows.get(rowedConflict.id)).toBe(rows.get(rowedMilestone.id));
});

test('compactRows re-indexes to consecutive integers starting at 0, in the same relative order as the static rows', () => {
  const staticRowOf = new Map([
    ['a', 2],
    ['b', 5],
    ['c', 9],
  ]);
  const compacted = compactRows(['a', 'b', 'c'], staticRowOf);
  expect(compacted.get('a')).toBe(0);
  expect(compacted.get('b')).toBe(1);
  expect(compacted.get('c')).toBe(2);
});

test('compactRows closes a gap left by a filtered-out item without reordering the remaining two', () => {
  const staticRowOf = new Map([
    ['a', 2],
    ['b', 5],
    ['c', 9],
  ]);
  const compacted = compactRows(['a', 'c'], staticRowOf); // 'b' filtered out
  expect(compacted.get('a')).toBe(0);
  expect(compacted.get('c')).toBe(1);
});

test('compactRows keeps two items that share the same static row in the same compacted row', () => {
  const staticRowOf = new Map([
    ['a', 0],
    ['b', 0],
    ['c', 3],
  ]);
  const compacted = compactRows(['a', 'b', 'c'], staticRowOf);
  expect(compacted.get('a')).toBe(compacted.get('b'));
  expect(compacted.get('c')).not.toBe(compacted.get('a'));
});
