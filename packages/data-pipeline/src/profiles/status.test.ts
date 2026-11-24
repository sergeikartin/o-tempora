import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { DETAIL_LEVEL_FAME_SCORE_FLOORS } from '@o-tempora/shared-types';
import { runCoordinatorCommand } from './coordinator.js';
import { inspectProfileStatus } from './status.js';
import { writeJson } from './store.js';
import type { loadSubjects, ProfileSubject } from './subjects.js';
import { applyRussianAudit } from './translation.js';
import { type Assessment, hash, profileHash } from './verification/policy.js';
import { applyEnglishAudit } from './verification/runner.js';

const wikipediaUrl = 'https://en.wikipedia.org/wiki/Isaac_Newton';
const subject: ProfileSubject = {
  qid: 'Q935',
  lane: 'people',
  name: 'Isaac Newton',
  dateSpan: { startYear: 1643, endYear: 1727 },
  wikipediaUrl,
};
const dates = '1643–1727';
const cleanAudit = { uncovered: [], issues: [], coherent: true };
const text =
  'Newton was an English mathematician. He published the Principia in 1687.';
const snapshot = {
  id: hash(text),
  url: wikipediaUrl,
  text,
  fetched_at: '2026-11-24',
};
const overview = 'Newton was an English mathematician.';
const moment = {
  date: '1687',
  title: 'Principia',
  text: 'He published the Principia in 1687.',
  source: wikipediaUrl,
};
const record = {
  subject: subject.name,
  type: 'person',
  wikipedia_url: wikipediaUrl,
  overview,
  key_moments: [moment],
  deep_facts: [],
  connections: [],
  meta: {
    locale: 'en',
    source: { wikidata_qid: subject.qid },
    review: { status: 'draft' },
  },
};
const evidence = [
  {
    source: snapshot.id,
    quote: text,
    kind: 'wikipedia' as const,
    origin: 'Article',
  },
];
function finding(claim: string) {
  return {
    claim,
    evidence,
    verdict: 'supported' as const,
    risk: 'ordinary' as const,
    correction: '',
    explanation: 'Supported.',
  };
}
const assessment: Assessment = {
  ...cleanAudit,
  subject_dates: [],
  covered: [
    'overview',
    'key_moments.0.date',
    'key_moments.0.title',
    'key_moments.0.text',
  ],
  findings: [
    { path: 'overview', ...finding(overview) },
    { path: 'key_moments.0.date', ...finding(moment.date) },
    { path: 'key_moments.0.title', ...finding(moment.title) },
    { path: 'key_moments.0.text', ...finding(moment.text) },
  ],
};

test('status reports the next command throughout the workflow and detects stale approvals', async (t) => {
  const profilesDir = await mkdtemp(path.join(tmpdir(), 'profile-status-'));
  t.after(() => rm(profilesDir, { recursive: true, force: true }));
  const incomingDir = path.join(profilesDir, 'incoming');
  const stagedFile = path.join(incomingDir, 'Q935.json');
  const filePath = path.join(profilesDir, 'people', 'Q935-newton.en.json');
  const resolve = async (urls: readonly string[]) =>
    new Map(urls.map((url) => [url, subject.qid]));
  const current = async (selected = subject) => {
    const result = await inspectProfileStatus({
      qids: new Set([subject.qid]),
      subjects: [selected],
      profilesDir,
      incomingDir,
    });
    assert.equal(
      Object.values(result.summary).reduce((sum, count) => sum + count, 0),
      1,
    );
    const [item] = result.items;
    assert.ok(item);
    assert.equal(result.summary[item.stage], 1);
    return item;
  };
  const assertStage = async (stage: string, command: string) => {
    const item = await current();
    assert.equal(item.stage, stage);
    assert.equal(item.next_command, command);
    return item;
  };
  assert.deepEqual(await assertStage('missing', 'prefetch'), {
    qid: 'Q935',
    stage: 'missing',
    prefetched: false,
    next_command: 'prefetch',
  });
  await writeJson(path.join(profilesDir, 'evidence', 'prefetch', 'Q935.json'), {
    qid: 'Q935',
    sources: [snapshot],
  });
  assert.deepEqual(await assertStage('missing', 'write'), {
    qid: 'Q935',
    stage: 'missing',
    prefetched: true,
    next_command: 'write',
  });

  await writeJson(stagedFile, {});
  await assertStage('staged', 'preflight');
  await writeJson(
    path.join(profilesDir, 'evidence', `${snapshot.id}.json`),
    snapshot,
  );
  const field = (text: string) => ({ text, findings: [finding(text)] });
  await writeJson(stagedFile, {
    ...record,
    ...cleanAudit,
    subject_dates: [],
    overview: field(overview),
    key_moments: [
      {
        ...moment,
        date: field(moment.date),
        title: field(moment.title),
        text: field(moment.text),
      },
    ],
  });
  await assertStage('staged', 'finalize');
  await rm(stagedFile);

  const riskAssessment = {
    ...assessment,
    findings: assessment.findings.map((item, i) =>
      i === 0
        ? { ...item, claim: 'Newton was the first to explain a result.' }
        : item,
    ),
  };
  const binding = {
    profile_hash: profileHash(record),
    assessment_hash: hash(riskAssessment),
  };
  const draft = {
    ...record,
    meta: {
      ...record.meta,
      pending_assessment: {
        ...binding,
        assessment: riskAssessment,
        model: 'writer',
      },
    },
  };
  await writeJson(filePath, draft);
  await assertStage('draft-pending-adversarial', 'english-adversarial');
  const adversarial = {
    model: 'researcher',
    checks: [
      {
        finding_index: 0,
        path: 'overview',
        outcome: 'no_conflict_found' as const,
        queries: ['Newton chronology'],
        counterevidence: [],
        note: 'No conflict found',
      },
    ],
  };
  await writeJson(filePath, {
    ...draft,
    meta: {
      ...draft.meta,
      pending_adversarial: { ...binding, ...adversarial },
    },
  });
  await assertStage('draft-pending-audit', 'english-audit');

  const english = {
    filePath,
    subject,
    assessment,
    snapshots: [snapshot],
    resolve,
    researcherModel: 'writer',
    auditModel: 'audit',
  };
  await writeJson(filePath, {
    ...record,
    meta: {
      ...record.meta,
      review: { status: 'edited' },
      coordinator_repair: { profile_hash: profileHash(record), count: 1 },
    },
  });
  assert.equal(
    (
      await applyEnglishAudit({
        ...english,
        audit: { ...cleanAudit, issues: ['overview: revise'] },
      })
    ).status,
    'held',
  );
  assert.deepEqual(await assertStage('english-held', 'english-repair'), {
    qid: 'Q935',
    stage: 'english-held',
    next_command: 'english-repair',
    edited: true,
    remaining_draft_repairs: 1,
  });

  assert.equal(
    (await applyEnglishAudit({ ...english, audit: cleanAudit })).status,
    'approved',
  );
  await assertStage('english-approved', 'russian-translation');
  const russianFields = {
    overview: 'Ньютон был английским математиком.',
    'key_moments.0.date': '1687',
    'key_moments.0.title': 'Начала',
    'key_moments.0.text': 'В 1687 году он опубликовал «Начала».',
  };
  const russianAudit = { ...cleanAudit, covered: Object.keys(russianFields) };
  const russian = {
    filePath,
    dates,
    fields: russianFields,
    models: [
      { model: 'translator', tokens: null },
      { model: 'auditor', tokens: null },
    ],
  };
  await applyRussianAudit({
    ...russian,
    audit: { ...russianAudit, issues: ['overview: revise'] },
  });
  await assertStage('russian-held', 'russian-translation');
  await applyRussianAudit({ ...russian, audit: russianAudit });
  await assertStage('bilingual-approved', 'done');

  const staleDates = await current({
    ...subject,
    dateSpan: { ...subject.dateSpan, startYear: 1642 },
  });
  assert.equal(staleDates.stage, 'draft-pending-audit');
  assert.match(staleDates.reason ?? '', /different dataset dates/);

  await writeJson(filePath, {
    ...record,
    overview: 'Newton was a mathematician.',
  });
  assert.equal(
    (await applyEnglishAudit({ ...english, audit: cleanAudit })).status,
    'approved',
  );
  const staleRussian = await assertStage(
    'english-approved',
    'russian-translation',
  );
  assert.match(staleRussian.reason ?? '', /current English Profile/);

  assert.equal(
    (
      await applyEnglishAudit({
        ...english,
        assessment: riskAssessment,
        adversarial,
        audit: cleanAudit,
        force: true,
      })
    ).status,
    'approved',
  );
  const staleDatesWithChecks = await current({
    ...subject,
    dateSpan: { startYear: 1643, endYear: 1726 },
  });
  assert.equal(staleDatesWithChecks.next_command, 'english-audit');
});

test('status CLI applies scope and explicit QID filters without network calls', async (t) => {
  const profilesDir = await mkdtemp(
    path.join(tmpdir(), 'profile-status-scope-'),
  );
  t.after(() => rm(profilesDir, { recursive: true, force: true }));
  const floors = DETAIL_LEVEL_FAME_SCORE_FLOORS;
  const subjects: ProfileSubject[] = [
    { ...subject, qid: 'Q1', fameScore: floors.people[0] },
    {
      ...subject,
      qid: 'Q2',
      lane: 'milestones',
      fameScore: floors.milestones[1],
    },
    {
      ...subject,
      qid: 'Q3',
      lane: 'conflicts',
      fameScore: floors.conflicts[0],
    },
    { ...subject, qid: 'Q4', fameScore: floors.people[1] - 1 },
  ];
  let output: Awaited<ReturnType<typeof inspectProfileStatus>> | undefined;
  const options = {
    profilesDir,
    subjects: (options?: Parameters<typeof loadSubjects>[0]) => {
      assert.deepEqual(options, { readOnly: true });
      return subjects;
    },
    fetch: async () => assert.fail('status must not fetch'),
    resolve: async () => assert.fail('status must not resolve'),
    emit: (value: unknown) => {
      output = value as typeof output;
    },
  };
  for (const [args, qids] of [
    [[], ['Q1', 'Q2']],
    [['--scope=mainstream'], ['Q1', 'Q2']],
    [['--scope=legendary'], ['Q1']],
    [['--scope=all'], ['Q1', 'Q2', 'Q3', 'Q4']],
    [['--qids=Q4,Q1'], ['Q4', 'Q1']],
  ] as const) {
    assert.equal(await runCoordinatorCommand('status', args, options), true);
    assert.deepEqual(
      output?.items.map(({ qid }) => qid),
      qids,
    );
    assert.equal(output?.summary.missing, qids.length);
  }
  await assert.rejects(
    runCoordinatorCommand('status', ['--scope=unknown'], options),
    /--scope must be/,
  );
  await assert.rejects(
    runCoordinatorCommand('status', ['--qids=Q1', '--scope=all'], options),
    /mutually exclusive/,
  );
});
