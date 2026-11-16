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
import {
  assertBoldOnlyMarkup,
  type ProfileTarget,
  parseRawProfile,
  type RawProfile,
  readRawProfiles,
  shipProfiles,
  withProfileFlags,
  writeProfiles,
} from './profiles.js';

const TARGETS: ProfileTarget[] = [
  {
    qid: 'Q935',
    slug: 'isaac-newton',
    name: 'Isaac Newton',
    lane: 'people',
    dates: '1643–1727',
    fameScore: 95,
  },
  {
    qid: 'Q9047',
    slug: 'gottfried-wilhelm-leibniz',
    name: 'Gottfried Wilhelm Leibniz',
    lane: 'people',
    dates: '1643–1727',
    fameScore: 85,
  },
  {
    qid: 'Q362',
    slug: 'world-war-ii',
    name: 'World War II',
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

function rawProfile(overrides: Partial<RawProfile> = {}): RawProfile {
  return {
    fileName: 'people/Q935-isaac-newton.json',
    qid: 'Q935',
    locale: 'en',
    status: 'reviewed',
    approved: true,
    verifiedDates: '1643–1727',
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
    ...overrides,
  };
}

test('only approved reviewed and edited Profiles ship', () => {
  const profiles = shipProfiles(
    [
      rawProfile({ qid: 'Q935', status: 'reviewed' }),
      rawProfile({ qid: 'Q9047', status: 'edited' }),
      rawProfile({ qid: 'Q362', status: 'draft' }),
      rawProfile({ qid: 'Q900', status: 'edited', approved: false }),
    ],
    TARGETS,
  );

  assert.deepEqual([...profiles.keys()].sort(), [
    'gottfried-wilhelm-leibniz',
    'isaac-newton',
  ]);
});

test('a draft Profile with bad markup does not block the others', () => {
  const profiles = shipProfiles(
    [
      rawProfile({ qid: 'Q935' }),
      rawProfile({ qid: 'Q362', status: 'draft', overview: 'Unpaired **bold' }),
    ],
    TARGETS,
  );

  assert.deepEqual([...profiles.keys()], ['isaac-newton']);
});

test('a Profile in another locale is not shipped', () => {
  assert.equal(shipProfiles([rawProfile({ locale: 'ru' })], TARGETS).size, 0);
});

test('a shipped Profile for an entity outside the dataset is an error', () => {
  assert.throws(
    () => shipProfiles([rawProfile({ qid: 'Q404' })], TARGETS),
    /Q404 is not an entity in the dataset/,
  );
});

test('two shipped Profiles for one entity are an error', () => {
  assert.throws(
    () => shipProfiles([rawProfile(), rawProfile()], TARGETS),
    /second Profile for Q935/,
  );
});

test("the shipped shape drops everything but the reader's fields", () => {
  const [profile] = shipProfiles([rawProfile()], TARGETS).values();

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

test('withProfileFlags sets hasProfile only on entities that have a Profile', () => {
  const profiles = shipProfiles([rawProfile()], TARGETS);

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

test("a Connection resolves to its target's slug, name, lane and Detail Level, in the given order", () => {
  const profiles = shipProfiles(
    [
      rawProfile({
        connections: [
          { qid: 'Q900', reason: 'Signed it.' },
          { qid: 'Q9047', reason: 'Rival over calculus.' },
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

test('a Connection whose target is not in the dataset, has no qid, points at the subject or repeats is dropped', () => {
  const profiles = shipProfiles(
    [
      rawProfile({
        connections: [
          { qid: 'Q404', reason: 'Not in the dataset.' },
          { reason: 'Unresolved.' },
          { qid: 'Q935', reason: 'Himself.' },
          { qid: 'Q9047', reason: 'First.' },
          { qid: 'Q9047', reason: 'Again.' },
        ],
      }),
    ],
    TARGETS,
  );

  assert.deepEqual(
    profiles
      .get('isaac-newton')
      ?.connections.map((connection) => connection.reason),
    ['First.'],
  );
});

test('a Profile with an unpaired ** is rejected, naming the file and field', () => {
  assert.throws(
    () =>
      shipProfiles([rawProfile({ overview: 'An **unclosed run.' })], TARGETS),
    /people\/Q935-isaac-newton\.json: overview: unpaired "\*\*"/,
  );
});

test('every shipped text field is checked', () => {
  const bad = '<b>x</b>';
  assert.throws(
    () =>
      shipProfiles(
        [
          rawProfile({
            keyMoments: [{ date: '1687', title: bad, text: 'ok' }],
          }),
        ],
        TARGETS,
      ),
    /key_moments\[0\]\.title/,
  );
  assert.throws(
    () =>
      shipProfiles(
        [
          rawProfile({
            keyMoments: [{ date: '1687', title: 'ok', text: bad }],
          }),
        ],
        TARGETS,
      ),
    /key_moments\[0\]\.text/,
  );
  assert.throws(
    () =>
      shipProfiles(
        [rawProfile({ deepFacts: [{ text: bad, isLegend: false }] })],
        TARGETS,
      ),
    /deep_facts\[0\]\.text/,
  );
  assert.throws(
    () =>
      shipProfiles(
        [rawProfile({ connections: [{ qid: 'Q9047', reason: bad }] })],
        TARGETS,
      ),
    /connections\[0\]\.connection/,
  );
});

test('assertBoldOnlyMarkup accepts paired bold and rejects other markup', () => {
  assertBoldOnlyMarkup('Plain, **bold** and **more bold** text.', 'x');
  assertBoldOnlyMarkup('', 'x');

  for (const text of [
    'a **b',
    'a <em>b</em>',
    'see [here](https://example.com)',
    'an *italic* word',
    'some `code`',
  ]) {
    assert.throws(() => assertBoldOnlyMarkup(text, 'x'), /x: /, text);
  }
});

function rawJson(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    subject: 'Isaac Newton',
    overview: 'Overview.',
    key_moments: [
      {
        date: '1687',
        title: 'T',
        text: 'Text.',
        claims: ['c'],
        source: 'not_on_wikipedia',
      },
    ],
    deep_facts: [
      {
        text: 'Fact.',
        type: 'hidden_story',
        is_legend: false,
        confidence: 'high',
        claims: ['c'],
        source: 'not_on_wikipedia',
      },
    ],
    connections: [
      {
        name: 'Leibniz',
        wikipedia_url: 'https://en.wikipedia.org/wiki/Leibniz',
        connection: 'Rival.',
        importance: 'high',
        qid: 'Q9047',
      },
    ],
    meta: {
      locale: 'en',
      source: { wikidata_qid: 'Q935' },
      review: { status: 'reviewed' },
    },
    ...overrides,
  };
}

test('parseRawProfile reads the fields Output needs from the raw file', () => {
  assert.deepEqual(parseRawProfile(rawJson(), 'people/x.json'), {
    fileName: 'people/x.json',
    qid: 'Q935',
    locale: 'en',
    status: 'reviewed',
    approved: false,
    overview: 'Overview.',
    keyMoments: [{ date: '1687', title: 'T', text: 'Text.' }],
    deepFacts: [{ text: 'Fact.', isLegend: false }],
    connections: [{ qid: 'Q9047', reason: 'Rival.' }],
  });
});

test('parseRawProfile names the field that is missing', () => {
  assert.throws(
    () => parseRawProfile(rawJson({ overview: undefined }), 'people/x.json'),
    /people\/x\.json: overview/,
  );
  assert.throws(
    () =>
      parseRawProfile(
        rawJson({
          meta: { locale: 'en', source: {}, review: { status: 'draft' } },
        }),
        'people/x.json',
      ),
    /meta\.source\.wikidata_qid/,
  );
});

test('source URLs reach shipped passages with section anchors intact', () => {
  const momentSource = 'https://en.wikipedia.org/wiki/Isaac_Newton#Principia';
  const factSource = 'https://www.example.org/archive/newton#apple';
  const raw = parseRawProfile(
    rawJson({
      key_moments: [
        {
          date: '1687',
          title: 'Principia',
          text: 'Text.',
          source: momentSource,
        },
      ],
      deep_facts: [{ text: 'Fact.', is_legend: true, source: factSource }],
    }),
    'people/x.json',
  );
  assert.equal(raw.keyMoments[0]?.sourceUrl, momentSource);
  assert.equal(raw.deepFacts[0]?.sourceUrl, factSource);
});

test('missing, sentinel, malformed and unsafe sources never become links', () => {
  for (const source of [
    undefined,
    null,
    '',
    'not_on_wikipedia',
    '/wiki/Isaac_Newton',
    'https://',
    'javascript:alert(1)',
    'data:text/html,hello',
    'https://user:password@example.org',
  ]) {
    const raw = parseRawProfile(
      rawJson({
        key_moments: [{ date: '1687', title: 'T', text: 'Text.', source }],
        deep_facts: [{ text: 'Fact.', is_legend: false, source }],
      }),
      'people/x.json',
    );
    assert.equal(raw.keyMoments[0]?.sourceUrl, undefined);
    assert.equal(raw.deepFacts[0]?.sourceUrl, undefined);
  }
});

test('readRawProfiles reads lane folders and skips staging and verification files', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'profiles-test-'));
  await mkdir(path.join(root, 'people'), { recursive: true });
  await mkdir(path.join(root, 'incoming'), { recursive: true });
  await writeFile(
    path.join(root, 'people', 'Q935-isaac-newton.json'),
    JSON.stringify(rawJson()),
  );
  await writeFile(
    path.join(root, 'people', 'Q935-isaac-newton.verification.json'),
    JSON.stringify({ profile: 'x' }),
  );
  await writeFile(
    path.join(root, 'incoming', 'Q1.json'),
    JSON.stringify({ not: 'a profile' }),
  );

  const profiles = await readRawProfiles(root);

  assert.deepEqual(
    profiles.map((profile) => profile.fileName),
    ['people/Q935-isaac-newton.json'],
  );

  await rm(root, { recursive: true, force: true });
});

test('readRawProfiles returns nothing when no Profiles exist yet', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'profiles-test-'));

  assert.deepEqual(await readRawProfiles(path.join(root, 'missing')), []);

  await rm(root, { recursive: true, force: true });
});

test('writeProfiles writes the English Profile to both locales and clears the previous run', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'profiles-test-'));
  await mkdir(path.join(root, 'profiles', 'en'), { recursive: true });
  await writeFile(path.join(root, 'profiles', 'en', 'stale.json'), '{}');

  const profiles = shipProfiles([rawProfile()], TARGETS);
  await writeProfiles(root, profiles);

  assert.deepEqual(await readdir(path.join(root, 'profiles', 'en')), [
    'isaac-newton.json',
  ]);
  assert.deepEqual(await readdir(path.join(root, 'profiles', 'ru')), [
    'isaac-newton.json',
  ]);
  const en = await readFile(
    path.join(root, 'profiles', 'en', 'isaac-newton.json'),
    'utf8',
  );
  const ru = await readFile(
    path.join(root, 'profiles', 'ru', 'isaac-newton.json'),
    'utf8',
  );
  assert.equal(en, ru);
  assert.deepEqual(JSON.parse(en), profiles.get('isaac-newton'));

  await rm(root, { recursive: true, force: true });
});
