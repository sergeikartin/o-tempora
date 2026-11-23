import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { parseRawProfile } from '../output/profiles.js';
import { type FinalizeOptions, finalizeProfiles } from './finalize.js';
import type { ProfileSubject } from './subjects.js';

const SUBJECTS: ProfileSubject[] = [
  {
    qid: 'Q1',
    lane: 'people',
    name: 'Isaac Newton',
    dateSpan: { startYear: 1643, endYear: 1727 },
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Isaac_Newton',
  },
  {
    qid: 'Q2',
    lane: 'people',
    name: 'Gottfried Leibniz',
    dateSpan: { startYear: 1646, endYear: 1716 },
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Gottfried_Leibniz',
  },
  {
    qid: 'Q3',
    lane: 'milestones',
    name: 'Principia',
    dateSpan: { startYear: 1687 },
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Principia',
  },
];

const QID_OF_URL = new Map([
  ['https://en.wikipedia.org/wiki/Isaac_Newton', 'Q1'],
  ['https://en.wikipedia.org/wiki/Gottfried_Leibniz', 'Q2'],
  ['https://en.wikipedia.org/wiki/Principia', 'Q3'],
  ['https://en.wikipedia.org/wiki/Robert_Hooke', 'Q99'],
]);

function modelProfile(overrides: Record<string, unknown> = {}) {
  return {
    subject: 'Isaac Newton',
    type: 'person',
    wikipedia_url: 'https://en.wikipedia.org/wiki/Isaac_Newton',
    overview: 'An English **mathematician**.',
    key_moments: [
      {
        date: '1687',
        title: 'The Principia',
        text: 'He published the **Principia**.',
        claims: ['Newton published the Principia in 1687.'],
        source: 'https://en.wikipedia.org/wiki/Principia',
      },
    ],
    deep_facts: [
      {
        text: 'A fact.',
        type: 'unique_detail',
        is_legend: false,
        confidence: 'high',
        claims: ['A claim.'],
        source: 'not_on_wikipedia',
      },
    ],
    connections: [
      {
        name: 'Gottfried Leibniz',
        wikipedia_url: 'https://en.wikipedia.org/wiki/Gottfried_Leibniz',
        connection: 'Rival over calculus.',
        importance: 'high',
      },
      {
        name: 'Robert Hooke',
        wikipedia_url: 'https://en.wikipedia.org/wiki/Robert_Hooke',
        connection: 'Disputed the inverse-square law.',
        importance: 'medium',
      },
      {
        name: 'Principia',
        wikipedia_url: 'https://en.wikipedia.org/wiki/Principia',
        connection: 'His great book.',
        importance: 'high',
      },
      {
        name: 'Nobody',
        wikipedia_url: 'https://en.wikipedia.org/wiki/Nobody',
        connection: 'Unresolvable.',
        importance: 'medium',
      },
    ],
    ...overrides,
  };
}

async function setup(): Promise<FinalizeOptions> {
  const root = await mkdtemp(path.join(tmpdir(), 'finalize-'));
  const incomingDir = path.join(root, 'incoming');
  await mkdir(incomingDir);
  return {
    incomingDir,
    profilesDir: root,
    subjects: SUBJECTS,
    model: 'opus',
    runId: 'test-run',
    resolveArticleQids: async (urls) =>
      new Map(
        urls.flatMap((url) => {
          const qid = QID_OF_URL.get(url);
          return qid ? [[url, qid] as const] : [];
        }),
      ),
  };
}

function stage(options: FinalizeOptions, qid: string, content: unknown) {
  return writeFile(
    path.join(options.incomingDir, `${qid}.json`),
    JSON.stringify(content),
  );
}

test('writes a validated draft record with meta and resolved Connections', async () => {
  const options = await setup();
  await stage(options, 'Q1', modelProfile());

  const result = await finalizeProfiles(options);

  const recordPath = path.join(
    options.profilesDir,
    'people',
    'Q1-isaac-newton.en.json',
  );
  assert.deepEqual(result, {
    written: [recordPath],
    skippedEdited: [],
    failed: [],
  });
  assert.deepEqual(await readdir(options.incomingDir), []);

  const record = JSON.parse(await readFile(recordPath, 'utf8'));
  assert.deepEqual(record.meta.review, { status: 'draft', reviewed_at: null });
  assert.equal(record.meta.prompt_hash, null);
  assert.equal(record.meta.source.wikidata_qid, 'Q1');
  assert.deepEqual(record.meta.validation, {
    schema_valid: true,
    connections_returned: 4,
    connections_matched_people: 1,
    connections_matched_events: 1,
    connections_unresolved: 1,
  });
  // Hooke resolves to a QID that is not in the dataset; "Nobody" resolves to
  // none. Neither is kept.
  assert.deepEqual(
    record.connections.map((c: { qid: string }) => c.qid),
    ['Q2', 'Q3'],
  );

  const raw = parseRawProfile(record, 'people/Q1-isaac-newton.en.json');
  assert.equal(raw.qid, 'Q1');
  assert.equal(raw.status, 'draft');
  assert.deepEqual(
    raw.connections.map((c) => c.qid),
    ['Q2', 'Q3'],
  );
});

test('rejects a file that does not match the raw Profile shape and keeps it staged', async () => {
  const options = await setup();
  await stage(options, 'Q1', modelProfile({ overview: '' }));
  await stage(options, 'Q2', modelProfile({ key_moments: 'none' }));
  await stage(
    options,
    'Q3',
    modelProfile({
      deep_facts: [{ ...modelProfile().deep_facts[0], is_legend: 'no' }],
    }),
  );

  const result = await finalizeProfiles(options);

  assert.deepEqual(result.written, []);
  assert.deepEqual(
    result.failed.map((f) => f.file),
    ['Q1.json', 'Q2.json', 'Q3.json'],
  );
  assert.match(result.failed[0]?.error ?? '', /overview/);
  assert.match(result.failed[2]?.error ?? '', /is_legend/);
  assert.equal((await readdir(options.incomingDir)).length, 3);
});

test('rejects a file whose article is a different entity or whose type is wrong', async () => {
  const options = await setup();
  await stage(
    options,
    'Q1',
    modelProfile({
      wikipedia_url: 'https://en.wikipedia.org/wiki/Robert_Hooke',
    }),
  );
  await stage(
    options,
    'Q3',
    modelProfile({ wikipedia_url: SUBJECTS[2]?.wikipediaUrl }),
  );

  const result = await finalizeProfiles(options);

  assert.match(result.failed[0]?.error ?? '', /resolves to Q99, expected Q1/);
  assert.match(
    result.failed[1]?.error ?? '',
    /type is "person", expected "milestone"/,
  );
});

test('rejects a file for an entity that is not in the dataset', async () => {
  const options = await setup();
  await stage(options, 'Q404', modelProfile());

  const result = await finalizeProfiles(options);

  assert.match(result.failed[0]?.error ?? '', /Q404 is not an entity/);
});

test('never overwrites an edited record', async () => {
  const options = await setup();
  const recordPath = path.join(
    options.profilesDir,
    'people',
    'Q1-isaac-newton.en.json',
  );
  const edited = JSON.stringify({
    overview: 'Hand-fixed.',
    meta: { prompt_hash: 'old', review: { status: 'edited' } },
  });
  await mkdir(path.dirname(recordPath), { recursive: true });
  await writeFile(recordPath, edited);
  await stage(options, 'Q1', modelProfile());

  const result = await finalizeProfiles(options);

  assert.deepEqual(result, {
    written: [],
    skippedEdited: [recordPath],
    failed: [],
  });
  assert.equal(await readFile(recordPath, 'utf8'), edited);
});

test('regenerating replaces a reviewed record in its original file and resets it to draft', async () => {
  const options = await setup();
  const recordPath = path.join(
    options.profilesDir,
    'people',
    'Q1-old-name.en.json',
  );
  await mkdir(path.dirname(recordPath), { recursive: true });
  await writeFile(
    recordPath,
    JSON.stringify({
      meta: { prompt_hash: 'old', review: { status: 'reviewed' } },
    }),
  );
  await stage(options, 'Q1', modelProfile());

  const result = await finalizeProfiles(options);

  assert.deepEqual(result.written, [recordPath]);
  assert.deepEqual(await readdir(path.join(options.profilesDir, 'people')), [
    'Q1-old-name.en.json',
  ]);
  const record = JSON.parse(await readFile(recordPath, 'utf8'));
  assert.equal(record.meta.review.status, 'draft');
  assert.equal(record.meta.prompt_hash, null);
});

test('records the model and token counts a staged `writer` block reports', async () => {
  const options = await setup();
  await stage(options, 'Q1', {
    ...modelProfile(),
    writer: {
      provider: 'openai',
      model: 'gpt-6-astra-2026-09-03',
      reasoning_effort: 'high',
      tokens: { input: 1200, output: 5400 },
    },
  });

  const result = await finalizeProfiles(options);

  const record = JSON.parse(
    await readFile(result.written[0] as string, 'utf8'),
  );
  assert.equal(record.meta.model, 'gpt-6-astra-2026-09-03');
  assert.equal(record.meta.reasoning_effort, 'high');
  assert.deepEqual(record.meta.tokens, { input: 1200, output: 5400 });
  assert.equal(record.writer, undefined);
});

test('falls back to the agent model and null tokens without a `writer` block', async () => {
  const options = await setup();
  await stage(options, 'Q1', modelProfile());

  const result = await finalizeProfiles(options);

  const record = JSON.parse(
    await readFile(result.written[0] as string, 'utf8'),
  );
  assert.equal(record.meta.model, 'opus');
  assert.equal(record.meta.tokens, null);
  assert.equal(record.meta.reasoning_effort, null);
  assert.equal(record.meta.prompt_version, null);
  assert.equal(record.meta.prompt_hash, null);
  assert.equal(record.meta.generated_at, null);
});

test('finalize preserves staged prompt provenance without reading the current prompt', async () => {
  const options = await setup();
  await stage(options, 'Q1', {
    ...modelProfile(),
    generation: {
      prompt_version: '1.0.0',
      prompt_hash: '111111111111',
      generated_at: '2026-10-24T10:00:00.000Z',
    },
  });
  const result = await finalizeProfiles(options);
  const record = JSON.parse(
    await readFile(result.written[0] as string, 'utf8'),
  );
  assert.equal(record.meta.prompt_hash, '111111111111');
  assert.equal(record.meta.prompt_version, '1.0.0');
  assert.equal(record.meta.generated_at, '2026-10-24T10:00:00.000Z');
});

test('invalid staged provenance is rejected and kept for correction', async () => {
  const options = await setup();
  await stage(options, 'Q1', {
    ...modelProfile(),
    generation: {
      prompt_version: '1',
      prompt_hash: 'bad',
      generated_at: 'yesterday',
    },
  });
  const result = await finalizeProfiles(options);
  assert.equal(result.written.length, 0);
  assert.match(result.failed[0]?.error ?? '', /generation/);
  assert.deepEqual(await readdir(options.incomingDir), ['Q1.json']);
});
