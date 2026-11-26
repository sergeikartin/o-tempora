import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { DETAIL_LEVEL_FAME_SCORE_FLOORS } from '@o-tempora/shared-types';
import { runCoordinatorCommand } from './coordinator.ts';
import { writePendingState } from './pending-state.ts';
import { writeJson } from './store.ts';
import type { loadSubjects, ProfileSubject } from './subjects.ts';
import { applyRussianAudit } from './translation.ts';
import { inspectTranslationStatus } from './translation-status.ts';
import { profileHash } from './verification/approval.ts';
import { type Assessment, hash } from './verification/assessment.ts';
import { applyEnglishAudit } from './verification/runner.ts';

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
function makeRecord(
  qid = subject.qid,
  type: 'person' | 'conflict' | 'milestone' = 'person',
) {
  return {
    subject: subject.name,
    type,
    wikipedia_url: wikipediaUrl,
    overview,
    key_moments: [moment],
    deep_facts: [],
    connections: [],
    meta: {
      locale: 'en',
      source: { wikidata_qid: qid },
      review: { status: 'draft' },
    },
  };
}
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

test('translation-status tracks Russian stages independently of English authoring', async (t) => {
  const profilesDir = await mkdtemp(
    path.join(tmpdir(), 'profile-translation-status-'),
  );
  t.after(() => rm(profilesDir, { recursive: true, force: true }));
  const filePath = path.join(profilesDir, 'people', 'Q935-newton.en.json');
  const resolve = async (urls: readonly string[]) =>
    new Map(urls.map((url) => [url, subject.qid]));
  const current = async (selected = subject) => {
    const result = await inspectTranslationStatus({
      qids: new Set([selected.qid]),
      subjects: [selected],
      profilesDir,
    });
    const [item] = result.items;
    assert.ok(item);
    assert.equal(result.summary[item.stage], 1);
    return item;
  };

  // No English Profile yet
  const noEnglish = await current();
  assert.equal(noEnglish.stage, 'awaiting-english');
  assert.equal(noEnglish.next_command, 'none');
  assert.match(noEnglish.reason ?? '', /No English Profile/);

  // Draft with pending assessment is still awaiting English
  const record = makeRecord();
  await writeJson(filePath, record);
  await writePendingState(profilesDir, subject.qid, {
    profile_hash: profileHash(record),
    assessment,
    model: 'writer',
    repairs: 0,
  });
  const pendingEnglish = await current();
  assert.equal(pendingEnglish.stage, 'awaiting-english');
  assert.match(pendingEnglish.reason ?? '', /pending unaudited/);

  // English approved -> ready for Russian translation
  const english = {
    filePath,
    subject,
    assessment,
    snapshots: [snapshot],
    resolve,
    researcherModel: 'writer',
    auditModel: 'audit',
  };
  assert.equal(
    (await applyEnglishAudit({ ...english, audit: cleanAudit })).status,
    'approved',
  );
  const missing = await current();
  assert.deepEqual(missing, {
    qid: 'Q935',
    stage: 'missing',
    next_command: 'russian-translation',
  });

  // Russian held -> held
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
  assert.deepEqual(await current(), {
    qid: 'Q935',
    stage: 'held',
    next_command: 'russian-translation',
  });

  // Russian approved -> approved / done
  await applyRussianAudit({ ...russian, audit: russianAudit });
  assert.deepEqual(await current(), {
    qid: 'Q935',
    stage: 'approved',
    next_command: 'done',
  });

  // Stale dataset dates invalidate English approval -> awaiting-english
  const staleDates = await current({
    ...subject,
    dateSpan: { ...subject.dateSpan, startYear: 1642 },
  });
  assert.equal(staleDates.stage, 'awaiting-english');
  assert.match(staleDates.reason ?? '', /different dataset dates/);

  // Updated & re-approved English invalidates saved Russian translation -> missing with reason
  await writeJson(filePath, {
    ...record,
    overview: 'Newton was a mathematician.',
  });
  assert.equal(
    (await applyEnglishAudit({ ...english, audit: cleanAudit })).status,
    'approved',
  );
  const staleRussian = await current();
  assert.equal(staleRussian.stage, 'missing');
  assert.equal(staleRussian.next_command, 'russian-translation');
  assert.match(staleRussian.reason ?? '', /current English Profile/);
});

test('translation-status CLI defaults to all approved English Profiles and validates flags', async (t) => {
  const profilesDir = await mkdtemp(
    path.join(tmpdir(), 'profile-translation-status-scope-'),
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

  // Approve English Profiles for Q1 (legendary person), Q3 (conflict), and Q4 (deep cut person); leave Q2 missing
  const laneToType = {
    people: 'person',
    conflicts: 'conflict',
    milestones: 'milestone',
  } as const;
  for (const s of [subjects[0], subjects[2], subjects[3]]) {
    assert.ok(s);
    const laneDir = path.join(profilesDir, s.lane);
    const filePath = path.join(laneDir, `${s.qid}-entry.en.json`);
    await writeJson(filePath, makeRecord(s.qid, laneToType[s.lane]));
    const res = await applyEnglishAudit({
      filePath,
      subject: s,
      assessment,
      snapshots: [snapshot],
      resolve: async (urls) => new Map(urls.map((url) => [url, s.qid])),
      researcherModel: 'writer',
      auditModel: 'audit',
      audit: cleanAudit,
    });
    assert.equal(res.status, 'approved');
  }

  let output: Awaited<ReturnType<typeof inspectTranslationStatus>> | undefined;
  const options = {
    profilesDir,
    subjects: (opts?: Parameters<typeof loadSubjects>[0]) => {
      assert.deepEqual(opts, { readOnly: true });
      return subjects;
    },
    fetch: async () => assert.fail('translation-status must not fetch'),
    resolve: async () => assert.fail('translation-status must not resolve'),
    emit: (value: unknown) => {
      output = value as typeof output;
    },
  };

  // Default scope=all returns only approved English Profiles across all lanes (Q1, Q3, Q4)
  for (const [args, qids] of [
    [[], ['Q1', 'Q3', 'Q4']],
    [['--scope=all'], ['Q1', 'Q3', 'Q4']],
    [['--scope=legendary'], ['Q1']],
    [['--scope=mainstream'], ['Q1']],
    [
      ['--stage=missing', '--limit=2'],
      ['Q1', 'Q3'],
    ],
    [['--stage=awaiting-english'], ['Q2']],
    [['--qids=Q2,Q1'], ['Q2', 'Q1']],
  ] as const) {
    assert.equal(
      await runCoordinatorCommand('translation-status', args, options),
      true,
    );
    assert.deepEqual(
      output?.items.map(({ qid }) => qid),
      qids,
    );
  }

  // Explicit --qids=Q2,Q1 reports awaiting-english for Q2 and missing for Q1
  assert.equal(output?.summary['awaiting-english'], 1);
  assert.equal(output?.summary.missing, 1);

  for (const stage of ['', 'missing,', 'approved,unknown']) {
    await assert.rejects(
      runCoordinatorCommand(
        'translation-status',
        [`--stage=${stage}`],
        options,
      ),
      /--stage must be a comma-separated list of: awaiting-english, missing, held, approved/,
    );
  }
  await assert.rejects(
    runCoordinatorCommand('translation-status', ['--limit=0'], options),
    /--limit must be a positive integer/,
  );
  await assert.rejects(
    runCoordinatorCommand('translation-status', ['--scope=unknown'], options),
    /--scope must be/,
  );
  await assert.rejects(
    runCoordinatorCommand(
      'translation-status',
      ['--qids=Q1', '--scope=all'],
      options,
    ),
    /mutually exclusive/,
  );
});
