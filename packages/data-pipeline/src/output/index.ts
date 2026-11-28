import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type ConflictEntry,
  DETAIL_LEVEL_FAME_SCORE_FLOORS,
  type Milestone,
  meetsFameScoreFloor,
  type Person,
  type ProfileLane,
  type SearchIndex,
} from '@o-tempora/shared-types';
import {
  buildProfileSubjects,
  formatDates,
  indexProfileSources,
  statSubjectInputs,
  writeSubjectsCache,
} from '../profiles/subjects.ts';
import {
  transformConflicts,
  transformMilestones,
  transformPeople,
} from '../transform/index.ts';
import {
  type ProfileTarget,
  readRawProfiles,
  shipProfiles,
  verifyBuiltProfiles,
  withProfileFlags,
  writeProfiles,
} from './profiles.ts';
import {
  assignConflictsMilestonesRows,
  assignPersonRows,
} from './row-assignment.ts';
import { assignSlugs } from './slugs.ts';
import {
  buildConflicts,
  buildMilestones,
  buildPeople,
  type DropReport,
  splitByDetailLevel,
} from './write-datasets.ts';

// The pipeline owns its own output — generating a dataset is a separate,
// inspectable step from publishing it for consumers to read. `publish.ts`
// copies this directory's contents into packages/shared-types/src/data/.
const DATA_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'data',
  'output',
);
const RAW_PROFILES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'data',
  'raw',
  'profiles',
);

function logReport(label: string, kept: number, report: DropReport): void {
  console.log(`${label}: kept ${kept}, dropped ${report.dropped}`);
  for (const [reason, count] of Object.entries(report.reasons)) {
    console.log(`    ${reason}: ${count}`);
  }
}

async function writeDataset(fileName: string, data: unknown): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(path.join(DATA_DIR, fileName), JSON.stringify(data, null, 2));
}

function searchFields({
  id,
  slug,
  name,
  tagline,
  fameScore,
  regionTags,
}: SearchIndex['conflicts'][number]): SearchIndex['conflicts'][number] {
  return { id, slug, name, tagline, fameScore, regionTags };
}

function buildSearchIndex(
  people: Person[],
  conflicts: ConflictEntry[],
  milestones: Milestone[],
): SearchIndex {
  const floors = DETAIL_LEVEL_FAME_SCORE_FLOORS;
  return {
    people: people
      .filter((entry) => meetsFameScoreFloor(entry, 'people', floors.people[3]))
      .map((entry) => ({
        ...searchFields(entry),
        occupationDomain: entry.occupationDomain,
      })),
    conflicts: conflicts
      .filter((entry) =>
        meetsFameScoreFloor(entry, 'conflicts', floors.conflicts[3]),
      )
      .map(searchFields),
    milestones: milestones
      .filter((entry) =>
        meetsFameScoreFloor(entry, 'milestones', floors.milestones[3]),
      )
      .map((entry) => ({ ...searchFields(entry), category: entry.category })),
  };
}

function withSlugs<T extends { id: string }>(
  entries: T[],
  slugOf: ReadonlyMap<string, string>,
): (T & { slug: string })[] {
  return entries.map((entry) => ({
    ...entry,
    slug: slugOf.get(entry.id) ?? entry.id,
  }));
}

// Assign rows before splitting deltas so opening a deeper Detail Level cannot move existing marks.
function withRows<T extends { id: string }>(
  entries: T[],
  rowOf: ReadonlyMap<string, number>,
): (T & { row: number })[] {
  return entries.map((entry) => ({ ...entry, row: rowOf.get(entry.id) ?? 0 }));
}

async function writeDetailLevelDataset<T extends { fameScore: number }>(
  fileNameFor: (level: 1 | 2 | 3 | 4) => string,
  entries: T[],
  levelFloors: readonly [number, number, number, number],
): Promise<void> {
  const { detail1, detail2, detail3, detail4 } = splitByDetailLevel(
    entries,
    levelFloors,
  );
  await writeDataset(fileNameFor(1), detail1);
  await writeDataset(fileNameFor(2), detail2);
  await writeDataset(fileNameFor(3), detail3);
  await writeDataset(fileNameFor(4), detail4);
  console.log(
    `  -> ${fileNameFor(1)}: ${detail1.length}, ${fileNameFor(2)}: ${detail2.length}, ` +
      `${fileNameFor(3)}: ${detail3.length}, ${fileNameFor(4)}: ${detail4.length}`,
  );
}

async function main(): Promise<void> {
  // Every lane is built in both languages first: slugs are unique across
  // lanes, so they can only be assigned once all three are built. Both
  // language builds resolve from the same rows and decide inclusion off
  // English fields regardless of `lang` (write-datasets.ts's Lang doc
  // comment), which is what keeps the two files' entity sets identical.
  const subjectInputs = statSubjectInputs();
  const peopleRows = transformPeople();
  const { people: peopleEn, report: peopleReport } = buildPeople(
    peopleRows,
    'en',
  );
  logReport('people.json', peopleEn.length, peopleReport);
  const { people: peopleRuBuilt, report: peopleRuReport } = buildPeople(
    peopleRows,
    'ru',
  );
  logReport('people.ru.json', peopleRuBuilt.length, peopleRuReport);

  const conflictRows = transformConflicts();
  const { entries: conflictsEn, report: conflictsReport } = buildConflicts(
    conflictRows,
    'en',
  );
  logReport('conflicts.json', conflictsEn.length, conflictsReport);
  const { entries: conflictsRuBuilt, report: conflictsRuReport } =
    buildConflicts(conflictRows, 'ru');
  logReport('conflicts.ru.json', conflictsRuBuilt.length, conflictsRuReport);

  const milestoneRows = transformMilestones();
  const { milestones: milestonesEn, report: milestonesReport } =
    buildMilestones(milestoneRows, 'en');
  logReport('milestones.json', milestonesEn.length, milestonesReport);
  const { milestones: milestonesRuBuilt, report: milestonesRuReport } =
    buildMilestones(milestoneRows, 'ru');
  logReport('milestones.ru.json', milestonesRuBuilt.length, milestonesRuReport);

  const slugOf = assignSlugs([...peopleEn, ...conflictsEn, ...milestonesEn]);
  const people = withSlugs(peopleEn, slugOf);
  const peopleRu = withSlugs(peopleRuBuilt, slugOf);
  const conflicts = withSlugs(conflictsEn, slugOf);
  const conflictsRu = withSlugs(conflictsRuBuilt, slugOf);
  const milestones = withSlugs(milestonesEn, slugOf);
  const milestonesRu = withSlugs(milestonesRuBuilt, slugOf);

  // The English build supplies the same Connection targets to both Locales.
  const profileSources = indexProfileSources(
    peopleRows,
    conflictRows,
    milestoneRows,
  );
  writeSubjectsCache(
    buildProfileSubjects(profileSources, {
      people: peopleEn,
      conflicts: conflictsEn,
      milestones: milestonesEn,
    }),
    {},
    subjectInputs,
  );
  function profileTargetsFor(
    lane: ProfileLane,
    entries: readonly {
      id: string;
      slug: string;
      name: string;
      fameScore: number;
    }[],
  ): ProfileTarget[] {
    return entries.map((entry) => {
      const source = profileSources[lane].get(entry.id);
      return {
        ...entry,
        qid: source?.qid ?? entry.id,
        dates: source?.dateSpan ? formatDates(source.dateSpan) : '',
        lane,
      };
    });
  }
  const profileTargets = [
    ...profileTargetsFor('people', people),
    ...profileTargetsFor('conflicts', conflicts),
    ...profileTargetsFor('milestones', milestones),
  ];
  const russianNames = new Map(
    [...peopleRu, ...conflictsRu, ...milestonesRu].map((entry) => [
      entry.slug,
      entry.name,
    ]),
  );
  for (const target of profileTargets)
    target.nameRu = russianNames.get(target.slug);
  const rawProfiles = await readRawProfiles(RAW_PROFILES_DIR);
  const profiles = shipProfiles(rawProfiles, profileTargets);
  const profilesRu = shipProfiles(rawProfiles, profileTargets, 'ru');
  await writeProfiles(DATA_DIR, profiles, profilesRu);
  console.log(`profiles: shipped ${profiles.size} en, ${profilesRu.size} ru`);

  const personRowOf = assignPersonRows(people, peopleRu);
  const peopleWithRows = withProfileFlags(
    withRows(people, personRowOf),
    profiles,
  );
  const peopleRuWithRows = withProfileFlags(
    withRows(peopleRu, personRowOf),
    profilesRu,
  );
  await writeDetailLevelDataset(
    (level) => `people.detail${level}.json`,
    peopleWithRows,
    DETAIL_LEVEL_FAME_SCORE_FLOORS.people,
  );
  await writeDetailLevelDataset(
    (level) => `people.detail${level}.ru.json`,
    peopleRuWithRows,
    DETAIL_LEVEL_FAME_SCORE_FLOORS.people,
  );

  // Conflicts and Milestones share the same row space. Reserve room for the widest
  // label across locales so row identities can stay shared.
  const eventsRowOf = assignConflictsMilestonesRows(
    conflicts,
    milestones,
    conflictsRu,
    milestonesRu,
  );
  const conflictsWithRows = withProfileFlags(
    withRows(conflicts, eventsRowOf),
    profiles,
  );
  const conflictsRuWithRows = withProfileFlags(
    withRows(conflictsRu, eventsRowOf),
    profilesRu,
  );
  const milestonesWithRows = withProfileFlags(
    withRows(milestones, eventsRowOf),
    profiles,
  );
  const milestonesRuWithRows = withProfileFlags(
    withRows(milestonesRu, eventsRowOf),
    profilesRu,
  );

  await writeDetailLevelDataset(
    (level) => `conflicts.detail${level}.json`,
    conflictsWithRows,
    DETAIL_LEVEL_FAME_SCORE_FLOORS.conflicts,
  );
  await writeDetailLevelDataset(
    (level) => `conflicts.detail${level}.ru.json`,
    conflictsRuWithRows,
    DETAIL_LEVEL_FAME_SCORE_FLOORS.conflicts,
  );
  await writeDetailLevelDataset(
    (level) => `milestones.detail${level}.json`,
    milestonesWithRows,
    DETAIL_LEVEL_FAME_SCORE_FLOORS.milestones,
  );
  await writeDetailLevelDataset(
    (level) => `milestones.detail${level}.ru.json`,
    milestonesRuWithRows,
    DETAIL_LEVEL_FAME_SCORE_FLOORS.milestones,
  );

  await writeDataset(
    'search-index.json',
    buildSearchIndex(people, conflicts, milestones),
  );
  await writeDataset(
    'search-index.ru.json',
    buildSearchIndex(peopleRu, conflictsRu, milestonesRu),
  );

  await verifyBuiltProfiles(DATA_DIR);
  console.log(
    `Wrote Detail Level delta files for people, conflicts, and milestones (en + ru) to ${DATA_DIR}`,
  );
  console.log(
    'Run `npm run publish-data --workspace packages/data-pipeline` to publish to packages/shared-types.',
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
