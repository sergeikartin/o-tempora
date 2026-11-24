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
import { parseRawProfile } from '../output/profiles.js';
import {
  extractAssessedProfile,
  readPendingAssessment,
} from './assessed-profile.js';
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

function field(text: string) {
  return {
    text,
    findings: [
      {
        claim: text,
        verdict: 'unverifiable',
        risk: 'ordinary',
        explanation: 'No source available.',
        correction: '',
        evidence: [],
      },
    ],
  };
}

function assessedProfile(overrides: Record<string, unknown> = {}) {
  return {
    subject: 'Isaac Newton',
    type: 'person',
    wikipedia_url: 'https://en.wikipedia.org/wiki/Isaac_Newton',
    overview: field('An English **mathematician**.'),
    key_moments: [
      {
        date: field('1687'),
        title: { text: 'The Principia', findings: [] },
        text: field('He published the **Principia**.'),
        source: 'https://en.wikipedia.org/wiki/Principia',
      },
    ],
    deep_facts: [
      {
        text: field('A fact.'),
        type: 'unique_detail',
        is_legend: false,
        confidence: 'high',
        source: 'not_on_wikipedia',
      },
    ],
    connections: [
      {
        name: 'Gottfried Leibniz',
        wikipedia_url: 'https://en.wikipedia.org/wiki/Gottfried_Leibniz',
        connection: field('Rival over calculus.'),
        importance: 'high',
      },
      {
        name: 'Robert Hooke',
        wikipedia_url: 'https://en.wikipedia.org/wiki/Robert_Hooke',
        connection: field('Disputed the inverse-square law.'),
        importance: 'medium',
      },
      {
        name: 'Principia',
        wikipedia_url: 'https://en.wikipedia.org/wiki/Principia',
        connection: field('His great book.'),
        importance: 'high',
      },
      {
        name: 'Nobody',
        wikipedia_url: 'https://en.wikipedia.org/wiki/Nobody',
        connection: field('Unresolvable.'),
        importance: 'medium',
      },
    ],
    coherent: true,
    subject_dates: [],
    uncovered: [],
    issues: [],
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
  await stage(options, 'Q1', assessedProfile());

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

test('rejects flat or malformed staging files and keeps them staged', async () => {
  const options = await setup();
  await stage(options, 'Q1', extractAssessedProfile(assessedProfile()).profile);
  await stage(options, 'Q2', assessedProfile({ key_moments: 'none' }));
  await stage(
    options,
    'Q3',
    assessedProfile({
      deep_facts: [{ ...assessedProfile().deep_facts[0], is_legend: 'no' }],
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

test('extracts the assessed draft and keeps evidence aligned when finalization drops Connections', async (t) => {
  const options = await setup();
  t.after(() => rm(options.profilesDir, { recursive: true, force: true }));
  const input = assessedProfile({
    issues: [
      'connections.1.connection: dropped',
      'connections.2.connection: kept',
    ],
  });
  await stage(options, 'Q1', input);
  const result = await finalizeProfiles(options);
  assert.deepEqual(result.failed, []);
  const [file] = result.written;
  assert.ok(file);
  const record = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(record.overview, input.overview.text);
  assert.ok(!Object.hasOwn(record.key_moments[0], 'claims'));
  assert.ok(!Object.hasOwn(record.deep_facts[0], 'claims'));
  const pending = readPendingAssessment(record);
  assert.ok(pending);
  const { assessment } = pending;
  assert.ok(assessment.covered.includes('key_moments.0.title'));
  assert.deepEqual(assessment.issues, ['connections.1.connection: kept']);
  assert.deepEqual(
    assessment.findings
      .filter(({ path }) => path.startsWith('connections.'))
      .map(({ path, claim }) => [path, claim]),
    [
      ['connections.0.connection', 'Rival over calculus.'],
      ['connections.1.connection', 'His great book.'],
    ],
  );
  assert.equal(
    readPendingAssessment({ ...record, overview: 'Later edit.' }),
    undefined,
  );
});

test('rejects a file whose article is a different entity or whose type is wrong', async () => {
  const options = await setup();
  await stage(
    options,
    'Q1',
    assessedProfile({
      wikipedia_url: 'https://en.wikipedia.org/wiki/Robert_Hooke',
    }),
  );
  await stage(
    options,
    'Q3',
    assessedProfile({ wikipedia_url: SUBJECTS[2]?.wikipediaUrl }),
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
  await stage(options, 'Q404', assessedProfile());

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
  await stage(options, 'Q1', assessedProfile());

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
  await stage(options, 'Q1', assessedProfile());

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
    ...assessedProfile(),
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
  await stage(options, 'Q1', assessedProfile());

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
    ...assessedProfile(),
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
    ...assessedProfile(),
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

test('finalization prunes self and redirect aliases and remaps every assessment path by draft index', async (t) => {
  const options = await setup();
  t.after(() => rm(options.profilesDir, { recursive: true, force: true }));
  const [leibniz, , principia] = assessedProfile().connections;
  const self = 'https://en.wikipedia.org/wiki/Newton';
  const alias = 'https://en.wikipedia.org/wiki/Gottfried_Wilhelm_Leibnitz';
  const resolve = options.resolveArticleQids;
  options.resolveArticleQids = async (urls) => {
    const resolved = await resolve(urls);
    resolved.set(self, 'Q1');
    resolved.set(alias, 'Q2');
    return resolved;
  };
  await stage(
    options,
    'Q1',
    assessedProfile({
      connections: [
        { ...leibniz, wikipedia_url: self },
        leibniz,
        { ...leibniz, wikipedia_url: alias },
        leibniz,
        principia,
      ],
      issues: [
        'connections.0.connection: self',
        'connections.4.connection: keep',
      ],
      uncovered: [
        'connections.2.connection: alias',
        'connections.4.connection: keep',
      ],
      subject_dates: [
        { path: 'connections.3.connection', year: 1687, boundary: 'start' },
        { path: 'connections.4.connection', year: 1687, boundary: 'start' },
      ],
    }),
  );
  const { written, failed } = await finalizeProfiles(options);
  assert.deepEqual(failed, []);
  assert.ok(written[0]);
  const raw = JSON.parse(await readFile(written[0], 'utf8'));
  assert.deepEqual(
    raw.connections.map(({ qid }: { qid: string }) => qid),
    ['Q2', 'Q3'],
  );
  assert.equal(raw.meta.validation.connections_matched_people, 1);
  assert.equal(raw.meta.validation.connections_matched_events, 1);
  const assessment = readPendingAssessment(raw)?.assessment;
  assert.ok(assessment);
  const paths = ['connections.0.connection', 'connections.1.connection'];
  assert.deepEqual(
    assessment.covered.filter((path) => path.startsWith('connections.')),
    paths,
  );
  assert.deepEqual(
    assessment.findings
      .filter(({ path }) => path.startsWith('connections.'))
      .map(({ path }) => path),
    paths,
  );
  assert.deepEqual(assessment.issues, ['connections.1.connection: keep']);
  assert.deepEqual(assessment.uncovered, ['connections.1.connection: keep']);
  assert.deepEqual(assessment.subject_dates, [
    { path: 'connections.1.connection', year: 1687, boundary: 'start' },
  ]);
});
