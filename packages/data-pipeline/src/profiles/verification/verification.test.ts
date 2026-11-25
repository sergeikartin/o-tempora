import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type TestContext, test } from 'node:test';
import {
  parseRawProfile,
  readRawProfiles,
  shipProfiles,
} from '../../output/profiles.ts';
import { runCoordinatorCommand } from '../coordinator.ts';
import { evidenceStore } from '../evidence-cache.ts';
import { type ModelProfile, parseModelProfile } from '../model-profile.ts';
import { passages } from '../passages.ts';
import { readCompletedRepairs } from '../pending-state.ts';
import type { ProfileSubject } from '../subjects.ts';
import { approvedTranslation, readTranslation } from '../translation.ts';
import { validateProfile } from '../validate.ts';
import { asRecord } from '../values.ts';
import { evidenceChecks, mechanicalChecks, yearRange } from './mechanical.ts';
import {
  type Assessment,
  blockers,
  checkEvidence,
  hash,
  POLICY_VERSION,
  profileHash,
  type Report,
  readProfileApproval,
  type Source,
} from './policy.ts';
import { englishAuditPrompt } from './researcher.ts';
import {
  applyEnglishAudit,
  checkpointEnglishRepair,
  type EnglishAuditOptions,
  reportPathFor,
} from './runner.ts';
import {
  extractHtmlDocument,
  headingPathAt,
  htmlText,
  parseSourceSnapshot,
  publicIPv4,
  SourceFetchError,
  SourceStore,
  sourceUrl,
} from './sources.ts';

const URL = 'https://en.wikipedia.org/wiki/Isaac_Newton';
const SUBJECT: ProfileSubject = {
  qid: 'Q935',
  lane: 'people',
  name: 'Isaac Newton',
  dateSpan: { startYear: 1643, endYear: 1727 },
  wikipediaUrl: URL,
};
const TEXT =
  'Isaac Newton published the Principia in 1687. Newton was an English mathematician. Newton was born in 1643 and died in 1727.';
const SOURCE: Source = {
  id: hash(TEXT),
  url: URL,
  fetched_at: '2026-11-15T00:00:00Z',
  text: TEXT,
  anchors: ['Principia'],
};

function raw() {
  return {
    subject: 'Isaac Newton',
    type: 'person',
    wikipedia_url: URL,
    overview: 'Newton was an English mathematician.',
    key_moments: [
      {
        date: '1687',
        title: 'The Principia',
        text: 'Isaac Newton published the Principia in 1687.',
        claims: ['Newton published the Principia.'],
        source: URL,
      },
    ],
    deep_facts: [],
    connections: [],
    meta: {
      locale: 'en',
      source: { wikidata_qid: 'Q935' },
      prompt_hash: 'writer',
      review: { status: 'draft', reviewed_at: null },
    },
  };
}

function assessment(profile: ModelProfile): Assessment {
  return {
    covered: passages(profile).map((item) => item.path),
    uncovered: [],
    issues: [],
    coherent: true,
    subject_dates: [],
    findings: passages(profile).map((item) => ({
      path: item.path,
      claim: item.text,
      verdict: 'supported',
      risk: 'ordinary',
      explanation: 'Confirmed by the article.',
      correction: '',
      evidence: [
        {
          source: SOURCE.id,
          quote: TEXT,
          kind: 'wikipedia',
          origin: 'Newton article',
        },
      ],
    })),
  };
}

const cleanAudit = { uncovered: [], issues: [], coherent: true };

test('research excerpts can page or jump to literal matches in the same full source', async () => {
  const text = `${'A'.repeat(9000)} Principia (1687). ${'B'.repeat(9000)}`;
  const source = { ...SOURCE, id: hash(text), text };
  let fetches = 0;
  const sources = new SourceStore(async () => {
    fetches++;
    return source;
  });
  const first = await sources.readExcerpt({ url: URL });
  assert.equal(first.text, text.slice(0, 8000));
  assert.ok(first.next_offset);
  const next = await sources.readExcerpt({
    url: URL,
    offset: first.next_offset,
  });
  assert.equal(
    next.text,
    text.slice(first.next_offset, first.next_offset + 8000),
  );
  const match = await sources.readExcerpt({
    url: URL,
    query: 'principia (1687)',
  });
  assert.equal(match.id, first.id);
  assert.match(match.text, /Principia \(1687\)/);
  assert.equal(
    (await sources.readExcerpt({ url: URL, query: 'absent' })).text,
    '',
  );
  await assert.rejects(sources.readExcerpt({ url: URL, offset: -1 }), /offset/);
  assert.deepEqual(sources.all(), [source]);
  assert.equal(fetches, 1);
});

test('independent audit receives each finding once and shares overlapping source excerpts', async () => {
  const text = `Nearby quote one. Nearby quote two. ${'Padding '.repeat(250)}Distant quote.`;
  const source = { ...SOURCE, id: hash(text), text };
  const sources = new SourceStore(async () => source);
  await sources.read(URL);
  const profile = parseModelProfile(raw(), 'test');
  const report = assessment(profile);
  const template = report.findings[0]?.evidence[0];
  assert.ok(template);
  const quotes = [
    'Nearby quote one.',
    'Nearby quote two.',
    'Distant quote.',
    'Missing quote.',
  ] as const;
  for (const [index, finding] of report.findings.entries()) {
    const quote = quotes[index];
    assert.ok(quote);
    finding.evidence = [{ ...template, source: source.id, quote }];
  }
  const prompt = englishAuditPrompt(profile, SUBJECT, report, sources.all());
  const payload = JSON.parse(prompt.slice(prompt.lastIndexOf('\n') + 1));
  assert.equal(payload.evidence, undefined);
  assert.equal(payload.passages, undefined);
  assert.deepEqual(payload.profile, profile);
  assert.equal(payload.assessment.findings.length, report.findings.length);
  assert.deepEqual(
    payload.assessment.findings.map(
      (finding: Assessment['findings'][number]) => finding.claim,
    ),
    report.findings.map((finding) => finding.claim),
  );
  assert.deepEqual(
    payload.assessment.findings.flatMap(
      (finding: { evidence: { source_excerpt_index: number | null }[] }) =>
        finding.evidence.map((evidence) => evidence.source_excerpt_index),
    ),
    [0, 0, 1, null],
  );
  assert.deepEqual(
    payload.assessment.findings.flatMap(
      (finding: { evidence: { source: number }[] }) =>
        finding.evidence.map((evidence) => evidence.source),
    ),
    [1, 1, 1, 1],
  );
  assert.deepEqual(payload.source_contexts, [
    {
      source: 1,
      url: URL,
      excerpts: [
        {
          section: [],
          text: text.slice(0, text.indexOf(quotes[1]) + quotes[1].length + 350),
        },
        { section: [], text: text.slice(text.indexOf(quotes[2]) - 350) },
      ],
    },
  ]);
  assert.equal(payload.assessment.covered, undefined);
  assert.equal(payload.assessment.findings[0].explanation, undefined);
  assert.equal(payload.assessment.findings[0].correction, undefined);
});

async function setup(t: TestContext) {
  const root = await mkdtemp(path.join(tmpdir(), 'profile-verify-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const filePath = path.join(root, 'people', 'Q935-newton.en.json');
  await mkdir(path.dirname(filePath));
  await writeFile(filePath, JSON.stringify(raw()));
  const options: EnglishAuditOptions = {
    filePath,
    subject: SUBJECT,
    assessment: assessment(parseModelProfile(raw(), filePath)),
    audit: cleanAudit,
    researcherModel: 'verifier',
    auditModel: 'auditor',
    resolve: async (urls) => new Map(urls.map((url) => [url, 'Q935'])),
    snapshots: [SOURCE],
  };
  return { root, options };
}

async function saved(options: EnglishAuditOptions) {
  return {
    record: JSON.parse(await readFile(options.filePath, 'utf8')),
    report: JSON.parse(
      await readFile(reportPathFor(options.filePath), 'utf8'),
    ) as Report,
  };
}

test('verified content ships through Output; changing prose, identity, policy or report revokes approval', async (t) => {
  const { root, options } = await setup(t);
  assert.equal((await applyEnglishAudit(options)).status, 'approved');
  const { record, report } = await saved(options);
  const profile = parseModelProfile(record, 'test');
  assert.equal(
    readProfileApproval(record, report, profile)?.isCurrentFor('1643–1727'),
    true,
  );
  const files = await readRawProfiles(root);
  assert.equal(
    shipProfiles(files, [
      {
        qid: 'Q935',
        name: 'Isaac Newton',
        slug: 'newton',
        lane: 'people',
        fameScore: 99,
        dates: '1643–1727',
      },
    ]).size,
    1,
  );
  for (const change of [
    () => ({ ...record, overview: 'Newton published in 1688.' }),
    () => ({
      ...record,
      meta: { ...record.meta, source: { wikidata_qid: 'Q1' } },
    }),
    () => ({ ...record, meta: { ...record.meta, locale: 'ru' } }),
    () => ({
      ...record,
      meta: {
        ...record.meta,
        review: { ...record.meta.review, status: 'draft' },
      },
    }),
  ])
    assert.equal(readProfileApproval(change(), report, profile), undefined);
  assert.equal(
    readProfileApproval(
      record,
      { ...report, verified_at: 'tampered' },
      profile,
    ),
    undefined,
  );
  assert.equal(
    readProfileApproval(record, { ...report, policy_version: 'old' }, profile),
    undefined,
  );
  assert.equal(readProfileApproval(record, undefined, profile), undefined);
  assert.equal(
    parseRawProfile(
      { ...raw(), meta: { ...raw().meta, review: { status: 'edited' } } },
      'test',
    ).approval,
    undefined,
  );
  const skipped = await applyEnglishAudit(options);
  assert.equal(skipped.status, 'skipped');
});

test('Output withholds an approval after dataset dates change until reverification', async (t) => {
  const { root, options } = await setup(t);
  await applyEnglishAudit(options);
  const target = {
    ...SUBJECT,
    slug: 'newton',
    fameScore: 99,
    dates: '1643–1727',
  };
  const files = await readRawProfiles(root);
  assert.equal(shipProfiles(files, [target]).size, 1);
  const changed = {
    ...target,
    dateSpan: { startYear: 1642, endYear: 1727 },
    dates: '1642–1727',
  };
  assert.equal(shipProfiles(files, [changed]).size, 0);
  assert.equal(
    (await applyEnglishAudit({ ...options, subject: changed })).status,
    'approved',
  );
  assert.equal(shipProfiles(await readRawProfiles(root), [changed]).size, 1);
});

test('verification checks the birth year of a living Person', async (t) => {
  const { options } = await setup(t);
  const subject = {
    ...SUBJECT,
    dateSpan: { startYear: 1643, ongoing: true },
  };
  function assessmentWithBirthYear(year: number): Assessment {
    return {
      ...options.assessment,
      subject_dates: [{ path: 'overview', boundary: 'start', year }],
    };
  }
  const result = await applyEnglishAudit({
    ...options,
    subject,
    assessment: assessmentWithBirthYear(1642),
  });
  assert.equal(result.status, 'held');
  assert.ok(
    result.blockers.some((blocker) =>
      blocker.includes('subject start year 1642 disagrees with dataset 1643'),
    ),
  );
  const corrected = await applyEnglishAudit({
    ...options,
    subject,
    assessment: assessmentWithBirthYear(1643),
  });
  assert.equal(corrected.status, 'approved');
  const { report } = await saved(options);
  assert.equal(report.subject.dates, '1643–present');
  assert.equal(report.policy_version, POLICY_VERSION);
});

test('Output accepts prior policy approvals with valid receipts and withholds tampered reports', async (t) => {
  const { options } = await setup(t);
  await applyEnglishAudit(options);
  const { record, report } = await saved(options);
  const target = {
    ...SUBJECT,
    slug: 'newton',
    fameScore: 99,
    dates: '1643–1727',
  };

  const priorReport = { ...report, policy_version: '2' };
  const priorRecord = {
    ...record,
    meta: {
      ...record.meta,
      review: {
        ...record.meta.review,
        approval: {
          ...record.meta.review.approval,
          policy_version: '2',
          report_hash: hash(priorReport),
        },
      },
    },
  };
  assert.equal(
    shipProfiles(
      [parseRawProfile(priorRecord, options.filePath, priorReport)],
      [target],
    ).size,
    1,
  );

  const tamperedAudit = {
    ...priorReport,
    audit: { ...priorReport.audit, issues: ['overview: tampered defect'] },
  };
  const tamperedRecord = {
    ...priorRecord,
    meta: {
      ...priorRecord.meta,
      review: {
        ...priorRecord.meta.review,
        approval: {
          ...priorRecord.meta.review.approval,
          report_hash: hash(tamperedAudit),
        },
      },
    },
  };
  assert.equal(
    shipProfiles(
      [parseRawProfile(tamperedRecord, options.filePath, tamperedAudit)],
      [target],
    ).size,
    0,
  );
});

test('an edited Profile can earn approval without changing its protected content', async (t) => {
  const { options } = await setup(t);
  const original = {
    ...raw(),
    meta: { ...raw().meta, review: { status: 'edited' } },
  };
  await writeFile(options.filePath, JSON.stringify(original));
  assert.equal((await applyEnglishAudit(options)).status, 'approved');
  const { record } = await saved(options);
  assert.equal(record.meta.review.status, 'edited');
  assert.equal(profileHash(record), profileHash(original));
});

test('malformed old reports withhold publishing and can be replaced by fresh verification', async (t) => {
  const { root, options } = await setup(t);
  await writeFile(reportPathFor(options.filePath), '{broken');
  assert.equal((await readRawProfiles(root))[0]?.approval, undefined);
  assert.equal((await applyEnglishAudit(options)).status, 'approved');
});

test('an omitted title, fabricated quote and independent audit failure block publication', async (t) => {
  const { options } = await setup(t);
  options.assessment.covered = options.assessment.covered.filter(
    (item) => !item.endsWith('.title'),
  );
  const evidence = options.assessment.findings[0]?.evidence[0];
  assert.ok(evidence);
  evidence.quote = 'Fabricated source passage';
  options.audit = { ...cleanAudit, uncovered: ['overview: overlooked age'] };
  const result = await applyEnglishAudit(options);
  assert.equal(result.status, 'held');
  assert.match(result.blockers.join('\n'), /every visible field/);
  assert.match(result.blockers.join('\n'), /evidence was not found/);
  assert.match(result.blockers.join('\n'), /overlooked age/);
  const { record } = await saved(options);
  assert.equal(record.meta.review.status, 'draft');
  assert.equal(record.meta.review.approval, undefined);
});

function assessedDraft(draft: ModelProfile, input = assessment(draft)) {
  const field = (path: string, text: string) => ({
    text,
    findings: input.findings
      .filter((finding) => finding.path === path)
      .map(({ path: _path, ...finding }) => finding),
  });
  return {
    ...draft,
    overview: field('overview', draft.overview),
    key_moments: draft.key_moments.map((moment, i) => ({
      ...moment,
      date: field(`key_moments.${i}.date`, moment.date),
      title: field(`key_moments.${i}.title`, moment.title),
      text: field(`key_moments.${i}.text`, moment.text),
    })),
    deep_facts: draft.deep_facts.map((fact, i) => ({
      ...fact,
      text: field(`deep_facts.${i}.text`, fact.text),
    })),
    coherent: input.coherent,
    uncovered: input.uncovered,
    issues: input.issues,
    subject_dates: input.subject_dates,
  };
}

test('a protected human edit rejects prose changes during repair without overwriting content', async (t) => {
  const { options } = await setup(t);
  const initial = {
    ...raw(),
    meta: { ...raw().meta, review: { status: 'edited' } },
  };
  await writeFile(options.filePath, JSON.stringify(initial));
  assert.equal(
    (
      await applyEnglishAudit({
        ...options,
        audit: { ...cleanAudit, issues: ['overview: disputed wording'] },
      })
    ).status,
    'held',
  );
  const { record, report } = await saved(options);
  const overview = 'Proposed replacement.';
  await assert.rejects(
    checkpointEnglishRepair({
      ...options,
      record,
      report: { ...report },
      model: 'repair',
      result: assessedDraft(
        parseModelProfile({ ...initial, overview }, 'test'),
      ),
    }),
    /protected edited Profile prose/,
  );
  assert.deepEqual(await saved(options), { record, report });
});

test('a concurrent human edit is preserved and receives no stale report', async (t) => {
  const { options } = await setup(t);
  const changed = { ...raw(), overview: 'Human edit during verification.' };
  await assert.rejects(
    applyEnglishAudit({
      ...options,
      resolve: async (urls) => {
        await writeFile(options.filePath, JSON.stringify(changed));
        return options.resolve(urls);
      },
    }),
    /changed during verification/,
  );
  assert.deepEqual(
    JSON.parse(await readFile(options.filePath, 'utf8')),
    changed,
  );
  await assert.rejects(readFile(reportPathFor(options.filePath)), {
    code: 'ENOENT',
  });
});

test('corroboration needs distinct original accounts and primary or scholarly support', () => {
  const profile = parseModelProfile(raw(), 'test');
  const item = assessment(profile);
  const first = item.findings[0];
  assert.ok(first?.evidence[0]);
  first.risk = 'corroborate';
  const report: Omit<Report, 'blockers'> = {
    policy_version: POLICY_VERSION,
    profile_hash: 'hash',
    verified_at: 'date',
    subject: { qid: 'Q935', dates: '1643–1727' },
    models: ['test', 'auditor'],
    assessment: item,
    audit: { uncovered: [], issues: [], coherent: true },
    sources: [SOURCE],
    evidence_errors: [],
    mechanical: [],
    repairs: 0,
  };
  assert.match(blockers(report, profile).join(), /corroboration missing/);
  report.sources.push({
    ...SOURCE,
    id: 'second',
    url: 'https://archive.example.org/book',
  });
  first.counterevidence = [
    {
      ...first.evidence[0],
      source: 'second',
      kind: 'scholarly',
      origin: 'Independent archival research',
      quote: 'A missing excerpt',
    },
  ];
  assert.match(blockers(report, profile).join(), /corroboration missing/);
  assert.match(
    checkEvidence(item, [{ ...SOURCE, id: 'second' }, SOURCE]).join(),
    /evidence was not found in a fetched source \(second\)/,
  );
  first.evidence.push({
    ...first.evidence[0],
    source: 'second',
    kind: 'scholarly',
  });
  assert.match(blockers(report, profile).join(), /corroboration missing/);
  first.evidence[1] = {
    ...first.evidence[0],
    source: 'second',
    kind: 'scholarly',
    origin: 'Independent archival research',
  };
  assert.deepEqual(blockers(report, profile), []);
});

test('date checks respect BC conversion, subject boundaries and section anchors', async () => {
  assert.deepEqual(yearRange('44 BC–AD 14'), {
    start: -43,
    end: 14,
    approximate: false,
  });
  assert.deepEqual(yearRange('551–479 BC'), {
    start: -550,
    end: -478,
    approximate: false,
  });
  assert.equal(yearRange('0 BC'), undefined);
  const profile = parseModelProfile(raw(), 'test');
  const result = assessment(profile);
  result.subject_dates.push({
    path: 'overview',
    boundary: 'start',
    year: 1642,
  });
  assert.match(
    evidenceChecks(profile, SUBJECT, result, [SOURCE]).join(),
    /disagrees with dataset/,
  );
  const moment = profile.key_moments[0];
  assert.ok(moment);
  moment.source = `${URL}#Missing`;
  assert.match(
    evidenceChecks(profile, SUBJECT, result, [SOURCE]).join(),
    /section missing/,
  );
  moment.date = '1688–1687';
  const flags = await mechanicalChecks(
    raw(),
    profile,
    SUBJECT,
    async () => new Map([[URL, 'Q935']]),
  );
  assert.match(flags.join(), /backwards/);
});

test('evidence validation normalizes whitespace but cannot manufacture a quotation', () => {
  const result = assessment(parseModelProfile(raw(), 'test'));
  const evidence = result.findings[0]?.evidence[0];
  assert.ok(evidence);
  evidence.quote = 'Newton was an\nEnglish mathematician.';
  assert.deepEqual(checkEvidence(result, [SOURCE]), []);
  evidence.quote = 'Newton was a French mathematician.';
  assert.match(checkEvidence(result, [SOURCE]).join(), /not found/);
  evidence.quote = '   ';
  assert.match(checkEvidence(result, [SOURCE]).join(), /not found/);
});

test('HTML extraction preserves inline words and removes script content; network boundaries reject local sources', () => {
  assert.equal(
    htmlText(
      '<nav>Menu</nav><p>New<b>ton</b> &amp; <em>Leibniz</em>.</p><script>bad()</script><p>1687</p>',
    ),
    'Newton & Leibniz. 1687',
  );
  for (const address of [
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '::1',
  ])
    assert.equal(publicIPv4(address), false);
  assert.equal(publicIPv4('8.8.8.8'), true);
  for (const url of [
    'file:///etc/passwd',
    'http://example.org',
    'https://user:pass@example.org',
    'https://example.org:123',
  ])
    assert.throws(() => sourceUrl(url));
});

test('local validate reports schema, identity, prose, citation and assessment defects', async (t) => {
  const { root, options } = await setup(t);
  await mkdir(path.join(root, 'evidence'));
  await writeFile(
    path.join(root, 'evidence', `${SOURCE.id}.json`),
    JSON.stringify(SOURCE),
  );
  const validation = () =>
    validateProfile({
      qid: SUBJECT.qid,
      subject: SUBJECT,
      filePath: options.filePath,
      profilesDir: root,
    });
  async function pending(
    record: ModelProfile & { meta: ReturnType<typeof raw>['meta'] },
    findings: Assessment,
  ) {
    const meta = {
      ...record.meta,
      pending_assessment: {
        profile_hash: profileHash(record),
        assessment: findings,
        model: 'writer',
      },
    };
    await writeFile(options.filePath, JSON.stringify({ ...record, meta }));
  }

  const valid = raw();
  const supported = assessment(parseModelProfile(valid, 'fixture'));
  await pending(valid, supported);
  assert.equal((await validation()).ok, true);

  await writeFile(options.filePath, JSON.stringify(valid));
  await writeFile(
    reportPathFor(options.filePath),
    JSON.stringify({
      profile_hash: profileHash(valid),
      assessment: supported,
    }),
  );
  assert.equal((await validation()).ok, true);

  for (const date of ['1688–1687', '0–1 AD']) {
    const invalid = {
      ...valid,
      type: 'milestone',
      wikipedia_url: `${URL}?oldid=1`,
      overview: '**Unpaired',
      key_moments: valid.key_moments.map((moment) => ({
        ...moment,
        date,
        source: `${URL}#Missing`,
      })),
      connections: [
        {
          name: 'Leibniz',
          importance: 'high',
          connection: 'Contemporary.',
          wikipedia_url: `${URL}#Bad`,
        },
        {
          name: 'Hooke',
          importance: 'high',
          connection: 'Contemporary.',
          wikipedia_url: 'https://en.wikipedia.org/wiki/Robert_Hooke',
        },
        {
          name: 'Hooke',
          importance: 'medium',
          connection: 'Contemporary.',
          wikipedia_url: 'https://en.wikipedia.org/wiki/Robert%20Hooke',
        },
      ],
    };
    const broken = structuredClone(supported);
    broken.subject_dates.push({
      path: 'overview',
      boundary: 'start',
      year: 1644,
    });
    const quote = broken.findings[0];
    const title = broken.findings[2];
    assert.ok(quote?.evidence[0] && title?.evidence[0]);
    quote.risk = 'corroborate';
    quote.evidence[0].quote = 'Fabricated quote';
    quote.evidence.push({ ...quote.evidence[0], source: 'a'.repeat(64) });
    title.verdict = 'disputed';
    title.evidence.push({ ...title.evidence[0], source: 'b'.repeat(64) });
    await writeFile(
      path.join(root, 'evidence', `${'b'.repeat(64)}.json`),
      '{bad',
    );
    await pending(invalid, broken);
    const result = await validation();
    assert.equal(result.ok, false);
    for (const message of [
      /type: Subject type/,
      /wikipedia_url: expected/,
      /overview: unpaired/,
      /date:.*(backwards|year zero)/,
      /overview: subject start/,
      /source section missing/,
      /connections.0.wikipedia_url/,
      /duplicate Connection/,
      /Coverage must account/,
      /disputed/,
      /corroboration missing/,
      /evidence was not found/,
      /evidence.a{64}/,
      /evidence.b{64}/,
    ])
      assert.match(result.issues.join('\n'), message);
    assert.equal(result.checked_sources, 1);
  }

  const badSource = {
    ...valid,
    key_moments: valid.key_moments.map((moment) => ({
      ...moment,
      source: 'https://example.org/article',
    })),
  };
  await pending(badSource, supported);
  assert.match(
    (await validation()).issues.join('\n'),
    /replace source with a fetched supporting URL/,
  );

  await writeFile(options.filePath, '{');
  const malformed = await validation();
  assert.equal(malformed.ok, false);
  assert.match(malformed.issues.join('\n'), /^file:/);
});

test('coordinator commands reuse evidence, checkpoint repair and approve both Locales', async (t) => {
  const { root, options } = await setup(t);
  let output: unknown;
  let fetches = 0;
  const contraryUrl = 'https://archive.example.org/book';
  const contraryText = 'One account dates publication to 1688.';
  const commands = {
    profilesDir: root,
    subjects: () => [{ ...SUBJECT, ru: { name: 'Исаак Ньютон' } }],
    resolve: options.resolve,
    fetch: async (url: string) => {
      fetches++;
      const { id: _legacyId, ...source } = SOURCE;
      const snapshot = {
        ...source,
        url,
        text: url === contraryUrl ? contraryText : source.text,
        fetched_at: `2026-11-15T00:00:0${fetches}Z`,
      };
      return { id: hash(snapshot), ...snapshot };
    },
    emit: (value: unknown) => {
      output = value;
    },
  };
  async function run(command: string, ...flags: string[]) {
    output = undefined;
    assert.equal(await runCoordinatorCommand(command, flags, commands), true);
    return asRecord(output, command);
  }
  async function save(name: string, value: unknown) {
    const destination = path.join(root, name);
    await writeFile(destination, JSON.stringify(value));
    return destination;
  }
  const qid = '--qid=Q935';
  async function prepare(command: string, ...flags: string[]) {
    const file = path.join(root, 'tasks', 'Q935', `${command}.json`);
    const cliTask = await run(command, qid, ...flags);
    const summary = await run(command, qid, ...flags, `--out=${file}`);
    assert.deepEqual(summary, {
      status: 'prepared',
      file,
      input_hash: cliTask.input_hash,
      ...(Array.isArray(cliTask.targets)
        ? { targets: cliTask.targets.length }
        : {}),
    });
    const savedTask = JSON.parse(await readFile(file, 'utf8'));
    assert.deepEqual(savedTask, cliTask);
    return asRecord(savedTask, command);
  }
  const first = await run('evidence', `--url=${URL}`);
  const second = await run('evidence', `--url=${URL}`, '--query=Principia');
  assert.equal(second.id, first.id);
  assert.equal(fetches, 1);
  const refreshed = await run('evidence', `--url=${URL}`, '--refresh');
  assert.notEqual(refreshed.id, first.id);
  const contrary = await run('evidence', `--url=${contraryUrl}`);

  function evidenceFor(profile: unknown) {
    const parsed = parseModelProfile(profile, 'coordinator test');
    const findings = assessment(parsed);
    for (const finding of findings.findings)
      for (const evidence of finding.evidence)
        evidence.source = String(first.id);
    const publication = findings.findings.find(
      (finding) => finding.path === 'key_moments.0.text',
    );
    assert.ok(publication);
    publication.counterevidence = [
      {
        source: String(contrary.id),
        quote: contraryText,
        kind: 'scholarly',
        origin: 'Archival account',
      },
    ];
    return findings;
  }
  const initial = raw();
  function assessed(profile: unknown, findings = evidenceFor(profile)) {
    const draft = parseModelProfile(profile, 'coordinator test');
    const field = (path: string, text: string) => ({
      text,
      findings: findings.findings
        .filter((finding) => finding.path === path)
        .map(({ path: _path, ...finding }) => finding),
    });
    return {
      ...draft,
      overview: field('overview', draft.overview),
      key_moments: draft.key_moments.map((moment, i) => ({
        ...moment,
        date: field(`key_moments.${i}.date`, moment.date),
        title: field(`key_moments.${i}.title`, moment.title),
        text: field(`key_moments.${i}.text`, moment.text),
      })),
      coherent: findings.coherent,
      uncovered: findings.uncovered,
      issues: findings.issues,
      subject_dates: findings.subject_dates,
    };
  }
  await mkdir(path.join(root, 'incoming'));
  const staged = await save('incoming/Q935.json', assessed(initial));
  const validateOptions = {
    ...commands,
    resolve: async () => assert.fail('Validate must not resolve articles'),
    fetch: async () => assert.fail('Validate must not fetch evidence'),
  };
  assert.equal(
    await runCoordinatorCommand('validate', [qid], validateOptions),
    true,
  );
  assert.deepEqual(output, {
    ok: true,
    qid: SUBJECT.qid,
    file: staged,
    checked_passages: 4,
    checked_findings: 4,
    checked_sources: 2,
    issues: [],
  });

  const invalidStaged = await save('incomplete.json', {
    ...assessed(initial),
    overview: { text: initial.overview, findings: [] },
  });
  assert.equal(
    await runCoordinatorCommand(
      'validate',
      [qid, `--file=${invalidStaged}`],
      validateOptions,
    ),
    true,
  );
  assert.equal(asRecord(output, 'validate').ok, false);
  assert.match(
    String(asRecord(output, 'validate').issues),
    /overview: no factual claims/,
  );

  await writeFile(
    options.filePath,
    JSON.stringify({
      ...initial,
      meta: {
        ...initial.meta,
        pending_assessment: {
          profile_hash: profileHash(initial),
          assessment: evidenceFor(initial),
          model: 'researcher-writer',
        },
      },
    }),
  );
  const audit = await prepare('english-audit');
  function checkCounterevidence(prompt: string) {
    const payload = JSON.parse(prompt.slice(prompt.lastIndexOf('\n') + 1));
    assert.deepEqual(
      payload.assessment.findings.find(
        (finding: Assessment['findings'][number]) =>
          finding.path === 'key_moments.0.text',
      ).counterevidence,
      [
        {
          source: 2,
          quote: contraryText,
          kind: 'scholarly',
          origin: 'Archival account',
          source_excerpt_index: 0,
        },
      ],
    );
    assert.deepEqual(payload.source_contexts.at(-1), {
      source: 2,
      url: contraryUrl,
      excerpts: [{ section: [], text: contraryText }],
    });
  }
  checkCounterevidence(String(audit.prompt));
  const rejected = await save('held-audit.json', {
    input_hash: audit.input_hash,
    result: {
      uncovered: [],
      issues: ['overview: specify the published work'],
      coherent: true,
    },
  });
  assert.equal(
    (await run('english-audit', qid, `--result=${rejected}`)).status,
    'held',
  );

  const evidenceRepair = await prepare('english-repair');
  const refreshedAssessment = evidenceFor(initial);
  const refreshedEvidence = refreshedAssessment.findings[0]?.evidence[0];
  assert.ok(refreshedEvidence);
  refreshedEvidence.source = String(refreshed.id);
  const evidenceReply = await save('evidence-repair.json', {
    input_hash: evidenceRepair.input_hash,
    result: assessed(initial, refreshedAssessment),
  });
  assert.equal(
    (await run('english-repair', qid, `--result=${evidenceReply}`)).status,
    'evidence-only',
  );
  assert.equal(
    profileHash((await saved(options)).record),
    profileHash(initial),
  );
  await assert.rejects(run('english-repair', qid), /pending assessment/);
  const evidenceAudit = await run('english-audit', qid);
  assert.notEqual(evidenceAudit.input_hash, audit.input_hash);
  await assert.rejects(
    run('english-audit', qid, `--result=${rejected}`),
    /different inputs/,
  );
  const secondRejection = await save('second-hold.json', {
    input_hash: evidenceAudit.input_hash,
    result: {
      uncovered: [],
      issues: ['overview: specify the published work'],
      coherent: true,
    },
  });
  assert.equal(
    (await run('english-audit', qid, `--result=${secondRejection}`)).status,
    'held',
  );
  assert.equal((await saved(options)).report.repairs, 0);

  const repair = await run('english-repair', qid);
  const revised = {
    ...initial,
    overview:
      'Newton was an English mathematician who first published the Principia in 1687.',
  };
  const repairReply = await save('repair.json', {
    input_hash: repair.input_hash,
    model: 'gpt-6.2-astra',
    result: assessed(revised),
  });
  assert.equal(
    (await run('english-repair', qid, `--result=${repairReply}`)).status,
    'draft',
  );
  const checkpoint = await saved(options);
  assert.equal(checkpoint.record.overview, revised.overview);
  assert.equal(checkpoint.record.meta.review.status, 'draft');
  assert.equal(checkpoint.record.meta.pending_assessment, undefined);
  assert.equal(checkpoint.record.meta.coordinator_repair, undefined);
  assert.equal(checkpoint.record.key_moments[0].claims, undefined);
  assert.equal(checkpoint.report.profile_hash, profileHash(initial));

  const freshAudit = await run('english-audit', qid);
  const auditPayload = JSON.parse(
    String(freshAudit.prompt).split('\n').at(-1) ?? '',
  );
  assert.equal(
    auditPayload.assessment.findings.find(
      (finding: Assessment['findings'][number]) =>
        finding.path === 'key_moments.0.text',
    ).counterevidence[0].quote,
    contraryText,
  );
  const accepted = await save('accepted-audit.json', {
    input_hash: freshAudit.input_hash,
    model: 'gemini-4-neon',
    result: { uncovered: [], issues: [], coherent: true },
  });
  assert.equal(
    (await run('english-audit', qid, `--result=${accepted}`)).status,
    'approved',
  );
  const english = await saved(options);
  assert.equal(english.record.meta.pending_assessment, undefined);
  assert.equal(english.record.meta.pending_adversarial, undefined);
  assert.deepEqual(english.report.models, ['gpt-6.2-astra', 'gemini-4-neon']);
  assert.equal(english.report.repairs, 1);
  assert.equal(fetches, 3);
  assert.deepEqual(
    english.report.sources.map(({ id }) => id),
    [first.id, contrary.id],
  );
  const translation = await prepare('russian-translation');
  assert.match(String(translation.prompt), /Исаак Ньютон/);
  const fields = {
    overview:
      'Ньютон — английский математик. В 1687 году он опубликовал «Начала».',
    'key_moments.0.date': '1687',
    'key_moments.0.title': '«Начала»',
    'key_moments.0.text': 'Исаак Ньютон опубликовал «Начала» в 1687 году.',
  };
  async function saveCandidate(fields: Record<string, string>) {
    return `--candidate=${await save('translation.json', {
      input_hash: translation.input_hash,
      result: { fields },
    })}`;
  }
  const candidate = await saveCandidate(fields);
  const fidelity = await prepare('russian-audit', candidate);
  assert.match(String(fidelity.prompt), /Исаак Ньютон/);
  const fidelityReply = await save('fidelity.json', {
    input_hash: fidelity.input_hash,
    result: {
      covered: Object.keys(fields),
      uncovered: [],
      issues: [],
      coherent: true,
    },
  });
  await saveCandidate({ ...fields, 'key_moments.0.title': 'Издание «Начал»' });
  await assert.rejects(
    run('russian-audit', qid, candidate, `--result=${fidelityReply}`),
    /different inputs/,
  );
  await saveCandidate(fields);
  const heldReply = await save('held-fidelity.json', {
    input_hash: fidelity.input_hash,
    result: {
      covered: Object.keys(fields),
      uncovered: [],
      issues: ['key_moments.0.title: use the full Russian title'],
      coherent: true,
    },
  });
  assert.equal(
    (await run('russian-audit', qid, candidate, `--result=${heldReply}`))
      .status,
    'held',
  );
  const correction = await run('russian-translation', qid);
  assert.match(String(correction.prompt), /Исаак Ньютон/);
  assert.match(
    String(correction.prompt),
    /"paths":\["key_moments\.0\.title"\]/,
  );
  async function saveCorrection(fields: Record<string, string>) {
    return `--candidate=${await save('correction.json', {
      input_hash: correction.input_hash,
      model: 'gpt-6.2-sol',
      result: { fields },
    })}`;
  }
  const replacements = {
    'key_moments.0.title': '«Математические начала натуральной философии»',
  };
  const excess = await saveCorrection({ ...replacements, overview: 'Другое.' });
  await assert.rejects(
    run('russian-audit', qid, excess),
    /exactly the flagged/,
  );
  const invalid = await saveCorrection({
    'key_moments.0.title': 'Начала 1687',
  });
  await assert.rejects(run('russian-audit', qid, invalid), /changed numeric/);
  const corrected = await saveCorrection(replacements);
  const freshFidelity = await run('russian-audit', qid, corrected);
  const correctedFields = { ...fields, ...replacements };
  assert.ok(
    String(freshFidelity.prompt).includes(JSON.stringify(correctedFields)),
  );
  await assert.rejects(
    run('russian-audit', qid, corrected, `--result=${fidelityReply}`),
    /different inputs/,
  );
  const correctedReply = await save('corrected-fidelity.json', {
    input_hash: freshFidelity.input_hash,
    model: 'gemini-4-neon',
    result: {
      covered: Object.keys(fields),
      uncovered: [],
      issues: [],
      coherent: true,
    },
  });
  assert.equal(
    (await run('russian-audit', qid, corrected, `--result=${correctedReply}`))
      .status,
    'approved',
  );
  const savedTranslation = await readTranslation(options.filePath);
  assert.deepEqual(
    approvedTranslation(savedTranslation, english.record),
    correctedFields,
  );
  const { models } = asRecord(savedTranslation, 'saved translation');
  assert.ok(Array.isArray(models));
  assert.deepEqual(
    models.map((entry) => asRecord(entry, 'translation model').model),
    ['gpt-6.2-sol', 'gemini-4-neon'],
  );
  assert.deepEqual(await saved(options), english);
  assert.equal((await run('russian-translation', qid)).status, 'skipped');
});

test('visible HTML headings keep exact NFC offsets, hierarchy and cached titles', async () => {
  const document = extractHtmlDocument(
    '<title>Newton &amp; the Café</title><header><h1>Hidden</h1></header>' +
      '<h1>Newton</h1><p>Early life</p><h2>Cafe<span>&#769;</span>' +
      '<span class="extra mw-editsection"> [edit]</span></h2><p>First account</p>' +
      '<h5>Legends</h5><p>Second account</p><h2>Works</h2><h6>Letters</h6> Papers',
  );
  assert.equal(document.title, 'Newton & the Café');
  assert.equal(
    document.text,
    'Newton & the Café Newton Early life Café First account Legends Second account Works Letters Papers',
  );
  assert.deepEqual(
    document.headings.map(({ level, text }) => [level, text]),
    [
      [1, 'Newton'],
      [2, 'Café'],
      [5, 'Legends'],
      [2, 'Works'],
      [6, 'Letters'],
    ],
  );
  for (const { text, offset } of document.headings)
    assert.equal(document.text.slice(offset, offset + text.length), text);
  const offset = document.text.indexOf('Second account');
  assert.deepEqual(headingPathAt(document.headings, offset), [
    'Newton',
    'Café',
    'Legends',
  ]);
  assert.deepEqual(
    headingPathAt(document.headings, document.text.indexOf('Papers')),
    ['Newton', 'Works', 'Letters'],
  );

  const legacy = {
    url: URL,
    fetched_at: SOURCE.fetched_at,
    text: document.text,
  };
  assert.deepEqual(
    parseSourceSnapshot({ ...legacy, id: hash(legacy) }, hash(legacy)),
    { ...legacy, id: hash(legacy) },
  );
  assert.deepEqual(parseSourceSnapshot(SOURCE, SOURCE.id), SOURCE);
  const fields = { ...legacy, ...document };
  const snapshot = { ...fields, id: hash(fields) };
  assert.deepEqual(parseSourceSnapshot(snapshot, snapshot.id), snapshot);
  assert.throws(
    () =>
      parseSourceSnapshot(
        { ...snapshot, id: hash(snapshot.text) },
        hash(snapshot.text),
      ),
    /content does not match/,
  );
  const badFields = {
    ...fields,
    headings: [{ ...document.headings[0], offset: 1 }],
  };
  assert.throws(
    () =>
      parseSourceSnapshot(
        { ...badFields, id: hash(badFields) },
        hash(badFields),
      ),
    /Invalid source heading/,
  );
  const store = new SourceStore(undefined, [snapshot]);
  const excerpt = await store.readExcerpt({ url: URL, offset });
  assert.equal(excerpt.title, snapshot.title);
  assert.deepEqual(excerpt.section, ['Newton', 'Café', 'Legends']);
  assert.equal(excerpt.text, document.text.slice(offset));
});

test('the English audit finds normalized quotes and keeps adjacent headings separate', async () => {
  const doc = extractHtmlDocument(
    '<title>Newton</title><h1>Biography</h1><p>Café account.</p><h2>Legends and myths</h2><p>A popular account.</p>',
  );
  const snapshot = { ...SOURCE, ...doc };
  const draft = parseModelProfile(raw(), 'test');
  const input = assessment(draft);
  const quotes = ['Cafe\u0301 \n  account.', 'A popular\taccount.'];
  for (const [index, finding] of input.findings.entries()) {
    const quote = quotes[index % quotes.length];
    assert.ok(quote);
    finding.evidence = [
      { source: snapshot.id, kind: 'scholarly', origin: 'Test', quote },
    ];
  }
  assert.deepEqual(checkEvidence(input, [snapshot]), []);
  const prompt = englishAuditPrompt(draft, SUBJECT, input, [snapshot]);
  const payload = JSON.parse(prompt.split('\n').at(-1) ?? '');
  assert.deepEqual(payload.source_contexts, [
    {
      source: 1,
      url: URL,
      title: 'Newton',
      excerpts: [
        { section: ['Biography'], text: 'Biography Café account. ' },
        {
          section: ['Biography', 'Legends and myths'],
          text: 'Legends and myths A popular account.',
        },
      ],
    },
  ]);
  assert.deepEqual(
    payload.assessment.findings.map(
      (finding: { evidence: { source_excerpt_index: number }[] }) =>
        finding.evidence[0]?.source_excerpt_index,
    ),
    [0, 1, 0, 1],
  );
});

test('English repair allows two prose changes and tracks repair count in pending.json outside meta', async (t) => {
  const { root, options } = await setup(t);
  const held = { ...cleanAudit, issues: ['overview: unresolved'] };
  for (const count of [1, 2]) {
    assert.equal(
      (await applyEnglishAudit({ ...options, repairs: count - 1, audit: held }))
        .status,
      'held',
    );
    const { record, report } = await saved(options);
    const updated = parseModelProfile(
      { ...record, overview: `Newton was a mathematician. Revision ${count}.` },
      'test',
    );
    const result = await checkpointEnglishRepair({
      ...options,
      record,
      report: { ...report },
      model: 'writer',
      result: assessedDraft(updated),
    });
    assert.equal(result.status, 'draft');
    const savedRecord = JSON.parse(await readFile(options.filePath, 'utf8'));
    assert.equal(savedRecord.meta.coordinator_repair, undefined);
    assert.equal(savedRecord.meta.pending_assessment, undefined);
    assert.equal(
      await readCompletedRepairs(root, SUBJECT.qid, savedRecord),
      count,
    );
  }
  assert.equal(
    (await applyEnglishAudit({ ...options, repairs: 2, audit: held })).status,
    'held',
  );
  const { record, report } = await saved(options);
  const revised = parseModelProfile(
    { ...record, overview: 'Third revision.' },
    'test',
  );
  await assert.rejects(
    checkpointEnglishRepair({
      ...options,
      record,
      report: { ...report },
      model: 'writer',
      result: assessedDraft(revised),
    }),
    /draft repair limit reached/,
  );
  assert.deepEqual(await saved(options), { record, report });
  const current = parseModelProfile(record, 'test');
  const updatedAssessment = assessment(current);
  updatedAssessment.issues.push('overview: new evidence assessment');
  assert.equal(
    (
      await checkpointEnglishRepair({
        ...options,
        record,
        report: { ...report },
        model: 'writer',
        result: assessedDraft(current, updatedAssessment),
      })
    ).status,
    'evidence-only',
  );
  const { record: repaired } = await saved(options);
  assert.equal(await readCompletedRepairs(root, SUBJECT.qid, repaired), 2);
  assert.equal(profileHash(repaired), profileHash(record));
});

test('coordinator rejects --out when applying a result', async () => {
  for (const command of ['english-audit', 'english-repair', 'russian-audit']) {
    await assert.rejects(
      runCoordinatorCommand(command, [
        '--out=task.json',
        '--result=reply.json',
      ]),
      /--out cannot be combined with --result/,
    );
  }
});

test('evidenceStore shares blocked-hosts cache and clears blocks on refresh', async (t) => {
  const { root } = await setup(t);
  let calls = 0;
  let shouldFail = true;
  const target = 'https://www.britannica.com/biography/Julius-Caesar';
  const fetchPage = async (url: string): Promise<Source> => {
    calls++;
    if (shouldFail) throw new SourceFetchError('Source returned HTTP 403', 403);
    const body = {
      url,
      fetched_at: '2026-11-25T00:00:00Z',
      text: 'Julius Caesar biography.',
      anchors: [],
    };
    return { id: hash(body), ...body };
  };

  await assert.rejects(
    evidenceStore(root, fetchPage, false).read(target),
    /HTTP 403/,
  );
  assert.equal(calls, 1);

  // Subsequent read on another URL on the same host fast-fails without calling fetchPage.
  await assert.rejects(
    evidenceStore(root, fetchPage, false).read(
      'https://www.britannica.com/topic/Julian-calendar',
    ),
    /Blocked host: Source returned HTTP 403/,
  );
  assert.equal(calls, 1);

  // Refresh bypasses and clears the host block once the source recovers.
  shouldFail = false;
  const recovered = await evidenceStore(root, fetchPage, true).read(target);
  assert.equal(calls, 2);
  assert.equal(recovered.url, target);

  // A new non-refresh read now works for another path on the cleared host.
  const other = await evidenceStore(root, fetchPage, false).read(
    'https://www.britannica.com/topic/Julian-calendar',
  );
  assert.equal(calls, 3);
  assert.match(other.url, /Julian-calendar/);
});

test('local validate flags misclassified Wikipedia, primary-text, low-trust and inconsistent sources', async (t) => {
  const { root, options } = await setup(t);
  const evidenceDir = path.join(root, 'evidence');
  await mkdir(evidenceDir);
  const makeSnapshot = (url: string, text: string): Source => {
    const body = { url, fetched_at: '2026-11-25T00:00:00Z', text, anchors: [] };
    return { id: hash(body), ...body };
  };
  const primaryText = makeSnapshot(
    'https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Suetonius/12Caesars/Julius*.html',
    'Suetonius wrote about Caesar.',
  );
  const lowTrust = makeSnapshot(
    'https://www.ancienttimeline.co.uk/Romans/timeline-detail.php?id=7',
    'Anonymous timeline text.',
  );
  const archivePage = makeSnapshot(
    'https://www.nationalarchives.gov.uk/education/item/',
    'Archive letter text and curator summary.',
  );
  for (const snap of [SOURCE, primaryText, lowTrust, archivePage]) {
    await writeFile(
      path.join(evidenceDir, `${snap.id}.json`),
      JSON.stringify(snap),
    );
  }
  const valid = raw();
  const checked = assessment(parseModelProfile(valid, 'fixture'));
  // 1. Wikipedia labeled scholarly
  checked.findings[0]?.evidence.push({
    source: SOURCE.id,
    quote: 'Newton was born in 1643.',
    kind: 'scholarly',
    origin: 'Wikipedia',
  });
  // 2. Primary classical text labeled scholarly
  checked.findings[0]?.evidence.push({
    source: primaryText.id,
    quote: primaryText.text,
    kind: 'scholarly',
    origin: 'Suetonius',
  });
  // 3. Low-trust timeline site labeled scholarly
  checked.findings[0]?.evidence.push({
    source: lowTrust.id,
    quote: lowTrust.text,
    kind: 'scholarly',
    origin: 'SPQR',
  });
  // 4. Archive page legitimately combining primary + scholarly should NOT trigger inconsistency,
  //    whereas scholarly + other on the same source ID should trigger inconsistency.
  checked.findings[1]?.evidence.push({
    source: archivePage.id,
    quote: 'Archive letter text',
    kind: 'primary',
    origin: 'National Archives',
  });
  checked.findings[1]?.evidence.push({
    source: archivePage.id,
    quote: 'curator summary',
    kind: 'scholarly',
    origin: 'National Archives',
  });
  checked.findings[2]?.evidence.push({
    source: lowTrust.id,
    quote: lowTrust.text,
    kind: 'other',
    origin: 'SPQR',
  });

  await writeFile(
    options.filePath,
    JSON.stringify({
      ...valid,
      meta: {
        ...valid.meta,
        pending_assessment: {
          profile_hash: profileHash(valid),
          assessment: checked,
          model: 'writer',
        },
      },
    }),
  );
  const result = await validateProfile({
    qid: SUBJECT.qid,
    subject: SUBJECT,
    filePath: options.filePath,
    profilesDir: root,
  });
  assert.equal(result.ok, false);
  const joined = result.issues.join('\n');
  assert.match(joined, /Wikipedia source .* must use kind "wikipedia"/);
  assert.match(joined, /primary text edition .* should use kind "primary"/);
  assert.match(
    joined,
    /low-trust reference site .* cannot be classified as "scholarly"/,
  );
  assert.match(
    joined,
    /inconsistent evidence\.kind \("scholarly" and "other"\)/,
  );
  assert.doesNotMatch(joined, /nationalarchives\.gov\.uk/);
});

test('readExcerpt strips anchors and headings, and evidence --batch runs multiple reads in one call', async (t) => {
  const { root, options } = await setup(t);
  const doc = extractHtmlDocument(
    '<title>Newton</title><h1 id="a1">Bio</h1><p id="p1">Isaac Newton published Principia in 1687.</p><h2 id="a2">Optics</h2><p id="p2">He studied prisms.</p>',
    new Set(['a1', 'p1', 'a2', 'p2']),
  );
  const snapshot: Source = {
    id: hash({
      url: URL,
      fetched_at: SOURCE.fetched_at,
      ...doc,
      anchors: ['a1', 'p1', 'a2', 'p2'],
    }),
    url: URL,
    fetched_at: SOURCE.fetched_at,
    ...doc,
    anchors: ['a1', 'p1', 'a2', 'p2'],
  };
  const store = new SourceStore(undefined, [snapshot]);
  const hit = await store.readExcerpt({ url: URL, query: 'Principia' });
  assert.equal('anchors' in hit, false);
  assert.equal('headings' in hit, false);
  assert.equal(hit.title, 'Newton');
  assert.match(hit.text, /Principia/);
  const miss = await store.readExcerpt({ url: URL, query: 'missing-phrase' });
  assert.equal('anchors' in miss, false);
  assert.equal('headings' in miss, false);
  assert.equal(miss.text, '');

  let fetches = 0;
  let emitted: unknown;
  const commands = {
    profilesDir: root,
    subjects: () => [SUBJECT],
    resolve: options.resolve,
    fetch: async (url: string) => {
      fetches++;
      if (url.includes('fail')) throw new SourceFetchError('HTTP 404', 404);
      const body = {
        url,
        fetched_at: '2026-11-25T00:00:00Z',
        ...doc,
        anchors: ['a1', 'p1'],
      };
      return { id: hash(body), ...body };
    },
    emit: (value: unknown) => {
      emitted = value;
    },
  };
  const batch = JSON.stringify([
    { url: URL, outline: true },
    { url: URL, query: 'prisms', length: 500 },
    { url: 'https://example.org/fail', query: 'x' },
  ]);
  assert.equal(
    await runCoordinatorCommand('evidence', [`--batch=${batch}`], commands),
    true,
  );
  const { results } = asRecord(emitted, 'batch evidence') as {
    results: Record<string, unknown>[];
  };
  assert.equal(results.length, 3);
  assert.ok(Array.isArray(results[0]?.headings));
  assert.match(String(results[1]?.text), /prisms/);
  assert.equal('anchors' in (results[1] ?? {}), false);
  assert.match(String(results[2]?.error), /HTTP 404/);
  assert.equal(fetches, 2);

  await assert.rejects(
    runCoordinatorCommand(
      'evidence',
      [`--batch=${batch}`, `--url=${URL}`],
      commands,
    ),
    /--batch cannot be combined/,
  );
});

test('compact patch English repair preserves untouched passages, validates locally, and passes re_audit context', async (t) => {
  const { root, options } = await setup(t);
  const evidenceDir = path.join(root, 'evidence');
  await mkdir(evidenceDir);
  await writeFile(
    path.join(evidenceDir, `${SOURCE.id}.json`),
    JSON.stringify(SOURCE),
  );
  const initial = {
    ...raw(),
    deep_facts: [
      {
        text: 'Isaac Newton published the Principia in 1687.',
        type: 'hidden_story' as const,
        is_legend: false,
        confidence: 'high' as const,
        source: URL,
      },
      {
        text: 'Newton was born in 1643 and died in 1727.',
        type: 'unique_detail' as const,
        is_legend: false,
        confidence: 'medium' as const,
        source: URL,
      },
    ],
  };
  await writeFile(options.filePath, JSON.stringify(initial));
  const initialProfile = parseModelProfile(initial, 'test');
  const initialAssessment = assessment(initialProfile);
  const hold = {
    ...cleanAudit,
    issues: ['overview: clarify Newton was a mathematician and physicist'],
  };
  assert.equal(
    (
      await applyEnglishAudit({
        ...options,
        assessment: initialAssessment,
        audit: hold,
        snapshots: [SOURCE],
      })
    ).status,
    'held',
  );

  let emitted: unknown;
  const run = async (command: string, ...args: string[]) => {
    emitted = undefined;
    await runCoordinatorCommand(command, ['--qid=Q935', ...args], {
      profilesDir: root,
      subjects: () => [SUBJECT],
      resolve: options.resolve,
      fetch: async () => assert.fail('unexpected fetch'),
      emit: (value) => {
        emitted = value;
      },
    });
    return asRecord(emitted, command);
  };

  const repairTask = await run('english-repair');
  const repairPayload = JSON.parse(
    String(repairTask.prompt).slice(
      String(repairTask.prompt).lastIndexOf('\n') + 1,
    ),
  );
  assert.deepEqual(repairPayload.flagged_paths, ['overview']);
  assert.equal(repairPayload.flagged_findings.length, 1);
  assert.equal(repairPayload.flagged_findings[0].path, 'overview');

  const patchReply = path.join(root, 'patch-reply.json');
  await writeFile(
    patchReply,
    JSON.stringify({
      input_hash: repairTask.input_hash,
      model: 'writer',
      result: {
        patches: {
          overview: {
            text: 'Newton was an English mathematician who published the Principia.',
            findings: [
              {
                claim:
                  'Newton was an English mathematician who published the Principia.',
                verdict: 'supported',
                risk: 'ordinary',
                explanation: 'Supported by Wikipedia.',
                correction: '',
                evidence: [
                  {
                    source: SOURCE.id,
                    quote: 'Newton was an English mathematician.',
                    kind: 'wikipedia',
                    origin: 'Newton article',
                  },
                ],
              },
            ],
          },
        },
        drop_deep_facts: [1],
      },
    }),
  );

  const validation = await run('validate', `--file=${patchReply}`);
  assert.equal(validation.ok, true);
  assert.equal(validation.checked_passages, 5);

  const applied = await run('english-repair', `--result=${patchReply}`);
  assert.equal(applied.status, 'draft');
  const updated = JSON.parse(await readFile(options.filePath, 'utf8'));
  assert.equal(
    updated.overview,
    'Newton was an English mathematician who published the Principia.',
  );
  assert.equal(updated.deep_facts.length, 1);
  assert.equal(updated.key_moments[0].text, initial.key_moments[0]?.text);
  assert.equal(updated.meta.pending_assessment, undefined);
  assert.equal(updated.meta.coordinator_repair, undefined);

  // Follow-up audit receives re_audit context pointing to repaired_paths and prior_blockers.
  const followUpAudit = await run('english-audit');
  const auditPayload = JSON.parse(
    String(followUpAudit.prompt).slice(
      String(followUpAudit.prompt).lastIndexOf('\n') + 1,
    ),
  );
  assert.deepEqual(auditPayload.re_audit, {
    repaired_paths: ['overview'],
    prior_blockers: [
      'overview: clarify Newton was a mathematician and physicist',
    ],
  });
});
