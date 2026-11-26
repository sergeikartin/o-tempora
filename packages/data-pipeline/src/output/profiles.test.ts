import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { assertBoldOnlyMarkup } from '../profiles/markup.ts';
import {
  computeEnglishSourceHash,
  type StoredProfile,
} from '../profiles/schemas.ts';
import {
  type ProfileTarget,
  parseRawProfile,
  type RawProfileRecord,
  readRawProfiles,
  shipProfiles,
  verifyBuiltProfiles,
  withProfileFlags,
  writeProfiles,
} from './profiles.ts';
import { publishBuiltData } from './publish.ts';

const TARGETS: ProfileTarget[] = [
  {
    qid: 'Q935',
    slug: 'isaac-newton',
    name: 'Isaac Newton',
    nameRu: 'Исаак Ньютон',
    lane: 'people',
    dates: '1643–1727',
    fameScore: 95,
  },
  {
    qid: 'Q9047',
    slug: 'gottfried-wilhelm-leibniz',
    name: 'Gottfried Wilhelm Leibniz',
    nameRu: 'Готфрид Вильгельм Лейбниц',
    lane: 'people',
    dates: '1646–1716',
    fameScore: 85,
  },
  {
    qid: 'Q362',
    slug: 'world-war-ii',
    name: 'World War II',
    nameRu: 'Вторая мировая война',
    lane: 'conflicts',
    dates: '1939–1945',
    fameScore: 97,
  },
  {
    qid: 'Q900',
    slug: 'obscure-treaty',
    name: 'Obscure Treaty',
    lane: 'conflicts',
    dates: '1939–1945',
    fameScore: 70,
  },
];

function storedProfile(overrides: Partial<StoredProfile> = {}): StoredProfile {
  return {
    overview: 'Newton was an **English** mathematician.',
    keyMoments: [
      {
        date: '1687',
        title: 'The Principia',
        text: 'He published the **Principia**.',
        sourceUrl: 'https://en.wikipedia.org/wiki/Isaac_Newton#Principia',
      },
    ],
    deepFacts: [{ text: 'No apple hit him.', isLegend: true }],
    connections: [],
    meta: {
      qid: 'Q935',
      locale: 'en',
      subjectDates: '1643–1727',
      approvedAt: '2026-11-26T00:00:00.000Z',
    },
    ...overrides,
  };
}

function rawRecord(
  overrides: Partial<StoredProfile> = {},
  fileName = 'people/Q935-isaac-newton.en.json',
): RawProfileRecord {
  return {
    filePath: `/tmp/${fileName}`,
    fileName,
    lane: 'people',
    profile: storedProfile(overrides),
  };
}

test('committed English Profiles ship cleanly and drop meta fields', () => {
  const [profile] = shipProfiles([rawRecord()], TARGETS).values();

  assert.deepEqual(profile, {
    overview: 'Newton was an **English** mathematician.',
    keyMoments: [
      {
        date: '1687',
        title: 'The Principia',
        text: 'He published the **Principia**.',
        sourceUrl: 'https://en.wikipedia.org/wiki/Isaac_Newton#Principia',
      },
    ],
    deepFacts: [{ text: 'No apple hit him.', isLegend: true }],
    connections: [],
  });
});

test('stale subjectDates warns and skips the Profile instead of failing', () => {
  const warnings: string[] = [];
  const shipped = shipProfiles(
    [
      rawRecord({
        meta: {
          qid: 'Q935',
          locale: 'en',
          subjectDates: '1643–1726',
          approvedAt: '2026-11-26T00:00:00.000Z',
        },
      }),
    ],
    TARGETS,
    'en',
    { warn: (msg) => warnings.push(msg) },
  );

  assert.equal(shipped.size, 0);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0] ?? '', /stale en Profile/);
});

test('Russian Profiles ship only when matching current English sourceHash and inherit English citations', () => {
  const en = storedProfile();
  const hash = computeEnglishSourceHash(en);
  const ru = storedProfile({
    overview: 'Ньютон был **английским** математиком.',
    keyMoments: [
      {
        date: '1687',
        title: 'Начала',
        text: 'Он опубликовал **Начала**.',
        sourceUrl: 'https://stale.example/ignored',
      },
    ],
    deepFacts: [{ text: 'Яблоко на него не падало.', isLegend: false }],
    connections: [{ qid: 'Q9047', reason: 'Соперник по исчислению.' }],
    meta: {
      qid: 'Q935',
      locale: 'ru',
      subjectDates: '1643–1727',
      approvedAt: '2026-11-26T00:00:00.000Z',
      sourceHash: hash,
    },
  });
  const enWithConn = storedProfile({
    connections: [{ qid: 'Q9047', reason: 'Rival over calculus.' }],
  });
  const ruAligned: StoredProfile = {
    ...ru,
    meta: { ...ru.meta, sourceHash: computeEnglishSourceHash(enWithConn) },
  };

  const warnings: string[] = [];
  const shipped = shipProfiles(
    [
      rawRecord(enWithConn),
      rawRecord(ruAligned, 'people/Q935-isaac-newton.ru.json'),
    ],
    TARGETS,
    'ru',
    { warn: (msg) => warnings.push(msg) },
  );
  assert.equal(warnings.length, 0);
  const profile = shipped.get('isaac-newton');
  assert.ok(profile);
  // English owns sourceUrl and isLegend authoritatively
  assert.equal(
    profile.keyMoments[0]?.sourceUrl,
    'https://en.wikipedia.org/wiki/Isaac_Newton#Principia',
  );
  assert.equal(profile.deepFacts[0]?.isLegend, true);
  assert.equal(profile.connections[0]?.name, 'Готфрид Вильгельм Лейбниц');

  // Stale Russian sourceHash warns and skips
  const staleWarnings: string[] = [];
  const stale = shipProfiles(
    [rawRecord(enWithConn), rawRecord(ru, 'people/Q935-isaac-newton.ru.json')],
    TARGETS,
    'ru',
    { warn: (msg) => staleWarnings.push(msg) },
  );
  assert.equal(stale.size, 0);
  assert.match(staleWarnings[0] ?? '', /stale Russian Profile/);
});

test('a Profile for an entity outside the dataset or duplicated throws', () => {
  assert.throws(
    () =>
      shipProfiles(
        [
          rawRecord({
            meta: {
              qid: 'Q404',
              locale: 'en',
              subjectDates: '1643–1727',
              approvedAt: '2026-11-26T00:00:00.000Z',
            },
          }),
        ],
        TARGETS,
      ),
    /Q404 is not an entity in the dataset/,
  );

  assert.throws(
    () => shipProfiles([rawRecord(), rawRecord()], TARGETS),
    /second English Profile for Q935/,
  );
});

test('withProfileFlags sets hasProfile only on entities that have a Profile', () => {
  const profiles = shipProfiles([rawRecord()], TARGETS);

  const flagged = withProfileFlags(
    [
      { slug: 'isaac-newton', fameScore: 95 },
      { slug: 'world-war-ii', fameScore: 97 },
    ],
    profiles,
  );

  assert.deepEqual(flagged, [
    { slug: 'isaac-newton', fameScore: 95, hasProfile: true },
    { slug: 'world-war-ii', fameScore: 97 },
  ]);
});

test('Connections resolve to slug, name, lane, Detail Level and skip unknown/self/dupes', () => {
  const profiles = shipProfiles(
    [
      rawRecord({
        connections: [
          { qid: 'Q404', reason: 'Not in dataset.' },
          { qid: 'Q935', reason: 'Self.' },
          { qid: 'Q900', reason: 'Signed it.' },
          { qid: 'Q9047', reason: 'Rival over calculus.' },
          { qid: 'Q9047', reason: 'Duplicate.' },
          { qid: 'Q362', reason: 'Far later.' },
        ],
      }),
    ],
    TARGETS,
  );

  assert.deepEqual(profiles.get('isaac-newton')?.connections, [
    {
      slug: 'obscure-treaty',
      reason: 'Signed it.',
      name: 'Obscure Treaty',
      lane: 'conflicts',
      detailLevel: 4,
    },
    {
      slug: 'gottfried-wilhelm-leibniz',
      reason: 'Rival over calculus.',
      name: 'Gottfried Wilhelm Leibniz',
      lane: 'people',
      detailLevel: 3,
    },
    {
      slug: 'world-war-ii',
      reason: 'Far later.',
      name: 'World War II',
      lane: 'conflicts',
      detailLevel: 1,
    },
  ]);
});

test('bad markup in any reader-facing text field throws', () => {
  assert.throws(
    () =>
      shipProfiles([rawRecord({ overview: 'An **unclosed run.' })], TARGETS),
    /overview: unpaired "\*\*"/,
  );
  assertBoldOnlyMarkup('Plain, **bold** text.', 'x');
});

test('parseRawProfile and readRawProfiles validate StoredProfileSchema', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'profiles-read-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'people'), { recursive: true });
  await writeFile(
    path.join(root, 'people', 'Q935-isaac-newton.en.json'),
    JSON.stringify(storedProfile()),
  );
  await writeFile(
    path.join(root, 'people', 'notes.txt'),
    'ignored non-profile file',
  );

  const records = await readRawProfiles(root);
  assert.deepEqual(
    records.map((r) => r.fileName),
    ['people/Q935-isaac-newton.en.json'],
  );

  assert.throws(
    () => parseRawProfile({ overview: 'missing fields' }, 'people/bad.en.json'),
    /people\/bad\.en\.json:/,
  );
});

test('writeProfiles clears old files and verifyBuiltProfiles enforces parity', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'profile-parity-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const profile = {
    overview: 'Overview',
    keyMoments: [],
    deepFacts: [],
    connections: [
      {
        slug: 'target',
        lane: 'milestones' as const,
        detailLevel: 2 as const,
        name: 'Target',
        reason: 'Connected',
      },
    ],
  };
  for (const localeSuffix of ['', '.ru']) {
    for (const lane of ['people', 'conflicts', 'milestones']) {
      for (const level of [1, 2, 3, 4]) {
        const rows =
          lane === 'people' && level === 1
            ? [{ slug: 'source', hasProfile: true }]
            : lane === 'milestones' && level === 2
              ? [{ slug: 'target' }]
              : [];
        await writeFile(
          path.join(directory, `${lane}.detail${level}${localeSuffix}.json`),
          JSON.stringify(rows),
        );
      }
    }
  }
  const profiles = new Map([['source', profile]]);
  await writeProfiles(directory, profiles, profiles);
  await verifyBuiltProfiles(directory);

  const destination = await mkdtemp(
    path.join(tmpdir(), 'profile-parity-publish-'),
  );
  t.after(() => rm(destination, { recursive: true, force: true }));
  await publishBuiltData(directory, destination);
  const published = path.join(destination, 'profiles', 'ru', 'source.json');
  assert.deepEqual(JSON.parse(await readFile(published, 'utf8')), profile);

  const orphan = path.join(directory, 'profiles', 'ru', 'orphan.json');
  await writeFile(orphan, JSON.stringify(profile));
  await assert.rejects(
    verifyBuiltProfiles(directory),
    /Orphan Profile file.*orphan\.json/,
  );
  await rm(orphan);
  assert.deepEqual(await readdir(path.join(directory, 'profiles', 'en')), [
    'source.json',
  ]);
});
