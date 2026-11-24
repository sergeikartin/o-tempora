import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type TestContext, test } from 'node:test';
import OpenAI from 'openai';
import type { ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses';
import {
  parseRawProfile,
  readRawProfiles,
  shipProfiles,
} from '../../output/profiles.js';
import { runCoordinatorCommand } from '../coordinator.js';
import { type ModelProfile, parseModelProfile } from '../model-profile.js';
import { routeVerificationModels } from '../model-routing.js';
import { passages } from '../passages.js';
import { preflightProfile } from '../preflight.js';
import type { Complete } from '../providers.js';
import type { ProfileSubject } from '../subjects.js';
import { approvedTranslation, readTranslation } from '../translation.js';
import { asRecord } from '../values.js';
import {
  type AdversarialCheck,
  type AdversarialTarget,
  adversarialPrompt,
  mergeAdversarialResult,
  parseAdversarialResult,
  selectAdversarialTargets,
} from './adversarial.js';
import { auditSavedProfile } from './audit-saved.js';
import { evidenceChecks, mechanicalChecks, yearRange } from './mechanical.js';
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
} from './policy.js';
import { auditProfile, type Research } from './researcher.js';
import { reportPathFor, type VerifyOptions, verifyProfile } from './runner.js';
import {
  extractHtmlDocument,
  headingPathAt,
  htmlText,
  parseSourceSnapshot,
  publicIPv4,
  SourceStore,
  sourceUrl,
} from './sources.js';

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

const research: Research = async (profile, _subject, sources) => {
  await sources.read(URL);
  return { assessment: assessment(profile), model: 'verifier' };
};
const complete: Complete = async () => ({
  text: JSON.stringify({ uncovered: [], issues: [], coherent: true }),
  model: 'auditor',
  tokens: { input: 0, output: 0 },
});

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
  await auditProfile(
    profile,
    SUBJECT,
    report,
    sources.all(),
    async (prompt, role) => {
      assert.equal(role, 'audit');
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
              text: text.slice(
                0,
                text.indexOf(quotes[1]) + quotes[1].length + 700,
              ),
            },
            { section: [], text: text.slice(text.indexOf(quotes[2]) - 700) },
          ],
        },
      ]);
      return complete(prompt, role);
    },
  );
});

async function setup(t: TestContext) {
  const root = await mkdtemp(path.join(tmpdir(), 'profile-verify-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const filePath = path.join(root, 'people', 'Q935-newton.en.json');
  await mkdir(path.dirname(filePath));
  await writeFile(filePath, JSON.stringify(raw()));
  const options: VerifyOptions = {
    filePath,
    subject: SUBJECT,
    research,
    complete,
    resolve: async (urls) => new Map(urls.map((url) => [url, 'Q935'])),
    repair: true,
    sources: new SourceStore(async () => SOURCE),
  };
  return { root, options };
}

async function saved(options: VerifyOptions) {
  return {
    record: JSON.parse(await readFile(options.filePath, 'utf8')),
    report: JSON.parse(
      await readFile(reportPathFor(options.filePath), 'utf8'),
    ) as Report,
  };
}

test('saved-evidence audits use the original findings and leave approvals intact', async (t) => {
  const { root, options } = await setup(t);
  const { id: _legacyId, ...fields } = SOURCE;
  const titled = {
    ...fields,
    title: 'Newton',
    headings: [{ level: 1 as const, offset: 0, text: 'Isaac Newton' }],
  };
  const snapshot = { ...titled, id: hash(titled) };
  options.sources = new SourceStore(async () => snapshot);
  options.research = async (...args) => {
    const result = await research(...args);
    for (const finding of result.assessment.findings)
      for (const item of finding.evidence) item.source = snapshot.id;
    return result;
  };
  assert.equal((await verifyProfile(options)).status, 'approved');
  const before = await saved(options);
  const issues = ['overview: pilot disagrees with the original audit'];
  const result = await auditSavedProfile(
    options.filePath,
    SUBJECT,
    async (prompt, role) => {
      assert.equal(role, 'audit');
      const payload = JSON.parse(prompt.slice(prompt.lastIndexOf('\n') + 1));
      assert.equal(
        payload.assessment.findings.length,
        before.report.assessment.findings.length,
      );
      assert.deepEqual(payload.source_contexts, [
        {
          source: 1,
          url: SOURCE.url,
          title: 'Newton',
          excerpts: [{ section: ['Isaac Newton'], text: TEXT }],
        },
      ]);
      return {
        model: 'pilot',
        tokens: { input: 300, output: 20 },
        text: JSON.stringify({ uncovered: [], issues, coherent: true }),
      };
    },
  );
  assert.deepEqual(result.originalAudit, before.report.audit);
  assert.deepEqual(result.audit.issues, issues);
  assert.deepEqual(result.tokens, { input: 300, output: 20 });
  assert.deepEqual(await saved(options), before);

  const snapshotPath = path.join(root, 'evidence', `${snapshot.id}.json`);
  await writeFile(
    snapshotPath,
    JSON.stringify({ ...snapshot, title: 'changed' }),
  );
  await assert.rejects(
    auditSavedProfile(options.filePath, SUBJECT, complete),
    /Saved source content does not match/,
  );
});

test('verified content ships through Output; changing prose, identity, policy or report revokes approval', async (t) => {
  const { root, options } = await setup(t);
  assert.equal((await verifyProfile(options)).status, 'approved');
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
  const skipped = await verifyProfile({
    ...options,
    research: async () => {
      throw new Error('should skip paid work');
    },
  });
  assert.equal(skipped.status, 'skipped');
});

test('Output withholds an approval after dataset dates change until reverification', async (t) => {
  const { root, options } = await setup(t);
  await verifyProfile(options);
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
    (await verifyProfile({ ...options, subject: changed })).status,
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
  function researchWithBirthYear(year: number): Research {
    return async (...args) => {
      const researched = await research(...args);
      researched.assessment.subject_dates.push({
        path: 'overview',
        boundary: 'start',
        year,
      });
      return researched;
    };
  }
  const result = await verifyProfile({
    ...options,
    subject,
    repair: false,
    research: researchWithBirthYear(1642),
  });
  assert.equal(result.status, 'held');
  assert.ok(
    result.blockers.some((blocker) =>
      blocker.includes('subject start year 1642 disagrees with dataset 1643'),
    ),
  );
  const corrected = await verifyProfile({
    ...options,
    subject,
    research: researchWithBirthYear(1643),
  });
  assert.equal(corrected.status, 'approved');
  const { report } = await saved(options);
  assert.equal(report.subject.dates, '1643–present');
  assert.equal(report.policy_version, POLICY_VERSION);
});

test('Output accepts version 2 approvals for closed spans but withholds them for ongoing subjects', async (t) => {
  const { options } = await setup(t);
  await verifyProfile(options);
  const { record, report } = await saved(options);

  for (const [dates, expected] of [
    ['1643–1727', 1],
    ['1643–present', 0],
  ] as const) {
    const legacyReport = {
      ...report,
      policy_version: '2',
      subject: { ...report.subject, dates },
    };
    const legacyRecord = {
      ...record,
      meta: {
        ...record.meta,
        review: {
          ...record.meta.review,
          approval: {
            ...record.meta.review.approval,
            policy_version: '2',
            report_hash: hash(legacyReport),
          },
        },
      },
    };
    const raw = parseRawProfile(legacyRecord, options.filePath, legacyReport);
    const target = { ...SUBJECT, slug: 'newton', fameScore: 99, dates };
    assert.equal(shipProfiles([raw], [target]).size, expected, dates);
  }
});

test('an edited Profile can earn approval without changing its protected content', async (t) => {
  const { options } = await setup(t);
  const original = {
    ...raw(),
    meta: { ...raw().meta, review: { status: 'edited' } },
  };
  await writeFile(options.filePath, JSON.stringify(original));
  assert.equal((await verifyProfile(options)).status, 'approved');
  const { record } = await saved(options);
  assert.equal(record.meta.review.status, 'edited');
  assert.equal(profileHash(record), profileHash(original));
});

test('malformed old reports withhold publishing and can be replaced by fresh verification', async (t) => {
  const { root, options } = await setup(t);
  await writeFile(reportPathFor(options.filePath), '{broken');
  assert.equal((await readRawProfiles(root))[0]?.approval, undefined);
  assert.equal((await verifyProfile(options)).status, 'approved');
});

test('an omitted title, fabricated quote and independent audit failure block publication', async (t) => {
  const { options } = await setup(t);
  options.repair = false;
  options.research = async (profile, subject, sources) => {
    const result = await research(profile, subject, sources);
    result.assessment.covered = result.assessment.covered.filter(
      (item) => !item.endsWith('.title'),
    );
    const finding = result.assessment.findings[0];
    assert.ok(finding?.evidence[0]);
    finding.evidence[0].quote = 'Fabricated source passage';
    return result;
  };
  options.complete = async () => ({
    text: JSON.stringify({
      uncovered: ['overview: overlooked age'],
      issues: [],
      coherent: true,
    }),
    model: 'audit',
    tokens: { input: 0, output: 0 },
  });
  const result = await verifyProfile(options);
  assert.equal(result.status, 'held');
  assert.match(result.blockers.join('\n'), /every visible field/);
  assert.match(result.blockers.join('\n'), /evidence was not found/);
  assert.match(result.blockers.join('\n'), /overlooked age/);
  const { record } = await saved(options);
  assert.equal(record.meta.review.status, 'draft');
  assert.equal(record.meta.review.approval, undefined);
});

test('repair drops unsupported optional content and verifies the resulting Profile before approval', async (t) => {
  const { options } = await setup(t);
  const initial = {
    ...raw(),
    deep_facts: [
      {
        text: 'An unsupported story.',
        type: 'hidden_story',
        is_legend: false,
        confidence: 'high',
        claims: ['Unsupported.'],
        source: URL,
      },
    ],
  };
  await writeFile(options.filePath, JSON.stringify(initial));
  let passes = 0;
  options.research = async (profile, subject, sources) => {
    passes++;
    const result = await research(profile, subject, sources);
    for (const finding of result.assessment.findings)
      if (finding.path.startsWith('deep_facts'))
        finding.verdict = 'unverifiable';
    return result;
  };
  options.complete = async (prompt) =>
    prompt.startsWith('Repair')
      ? {
          text: JSON.stringify(raw()),
          model: 'repair',
          tokens: { input: 0, output: 0 },
        }
      : complete(prompt);
  const result = await verifyProfile(options);
  assert.equal(result.status, 'approved');
  assert.equal(passes, 2);
  const { record, report } = await saved(options);
  assert.deepEqual(record.deep_facts, []);
  assert.equal(report.repairs, 1);
  assert.equal(report.profile_hash, profileHash(record));
});

test('protected human edits receive a proposal and never get overwritten by repair', async (t) => {
  const { options } = await setup(t);
  const initial = {
    ...raw(),
    meta: { ...raw().meta, review: { status: 'edited' } },
  };
  await writeFile(options.filePath, JSON.stringify(initial));
  options.research = async (profile, subject, sources) => {
    const result = await research(profile, subject, sources);
    result.assessment.issues.push('overview: essential disputed wording');
    return result;
  };
  options.complete = async (prompt) =>
    prompt.startsWith('Repair')
      ? {
          text: JSON.stringify({ ...raw(), overview: 'Proposed replacement.' }),
          model: 'repair',
          tokens: { input: 0, output: 0 },
        }
      : complete(prompt);
  const result = await verifyProfile(options);
  assert.equal(result.status, 'held');
  assert.ok(result.proposalPath);
  const { record } = await saved(options);
  assert.equal(record.overview, initial.overview);
  assert.equal(record.meta.review.status, 'edited');
  assert.equal(record.meta.review.approval, undefined);
  assert.equal(
    JSON.parse(await readFile(result.proposalPath, 'utf8')).proposed.overview,
    'Proposed replacement.',
  );
});

test('repair attempts are bounded and unresolved contradictions never auto-promote', async (t) => {
  const { options } = await setup(t);
  let repairs = 0;
  options.research = async (profile, subject, sources) => {
    const result = await research(profile, subject, sources);
    const first = result.assessment.findings[0];
    assert.ok(first);
    first.verdict = 'contradicted';
    return result;
  };
  options.complete = async (prompt) =>
    prompt.startsWith('Repair')
      ? {
          text: JSON.stringify({
            ...raw(),
            overview: `Still wrong ${++repairs}`,
          }),
          model: 'repair',
          tokens: { input: 0, output: 0 },
        }
      : complete(prompt);
  assert.equal((await verifyProfile(options)).status, 'held');
  assert.equal(repairs, 2);
  assert.equal((await saved(options)).record.meta.review.status, 'draft');
});

test('a concurrent human edit is preserved and receives no stale report', async (t) => {
  const { options } = await setup(t);
  options.research = async (profile, subject, sources) => {
    await writeFile(
      options.filePath,
      JSON.stringify({ ...raw(), overview: 'Human edit during verification.' }),
    );
    return research(profile, subject, sources);
  };
  await assert.rejects(verifyProfile(options), /changed during verification/);
  assert.equal(
    JSON.parse(await readFile(options.filePath, 'utf8')).overview,
    'Human edit during verification.',
  );
  await assert.rejects(readFile(reportPathFor(options.filePath)), {
    code: 'ENOENT',
  });
});

test('fetch failures request a retry instead of removing optional material', async (t) => {
  const { options } = await setup(t);
  options.sources = new SourceStore(async () => {
    throw new Error('HTTP 503');
  });
  options.research = async (profile, _subject, sources) => {
    await assert.rejects(sources.read(URL));
    return { assessment: assessment(profile), model: 'verifier' };
  };
  options.complete = async (prompt) => {
    assert.ok(!prompt.startsWith('Repair'));
    return complete(prompt);
  };
  assert.equal((await verifyProfile(options)).status, 'retry');
  assert.equal((await saved(options)).record.overview, raw().overview);
});

test('corroboration needs distinct original accounts and primary or scholarly support', () => {
  const profile = parseModelProfile(raw(), 'test');
  const item = assessment(profile);
  const first = item.findings[0];
  assert.ok(first?.evidence[0]);
  first.risk = 'corroborate';
  const report: Omit<Report, 'blockers'> = {
    policy_version: POLICY_VERSION,
    adversarial_disabled: true,
    profile_hash: 'hash',
    verified_at: 'date',
    subject: { qid: 'Q935', dates: '1643–1727' },
    models: ['test'],
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

test('local preflight reports schema, identity, prose, citation and assessment defects', async (t) => {
  const { root, options } = await setup(t);
  await mkdir(path.join(root, 'evidence'));
  await writeFile(
    path.join(root, 'evidence', `${SOURCE.id}.json`),
    JSON.stringify(SOURCE),
  );
  const preflight = () =>
    preflightProfile({
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
  assert.equal((await preflight()).ok, true);

  await writeFile(options.filePath, JSON.stringify(valid));
  await writeFile(
    reportPathFor(options.filePath),
    JSON.stringify({
      profile_hash: profileHash(valid),
      assessment: supported,
    }),
  );
  assert.equal((await preflight()).ok, true);

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
    const result = await preflight();
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
    (await preflight()).issues.join('\n'),
    /replace source with a fetched supporting URL/,
  );

  await writeFile(options.filePath, '{');
  const malformed = await preflight();
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
  async function legacyResearch() {
    const findings = evidenceFor(initial);
    findings.uncovered.push('connections.0.connection: dropped by finalize');
    return `--research=${await save('research.json', {
      assessment: findings,
      connection_urls: ['https://en.wikipedia.org/wiki/Out_of_dataset'],
      model: 'researcher-writer',
    })}`;
  }
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
  const preflightOptions = {
    ...commands,
    resolve: async () => assert.fail('Preflight must not resolve articles'),
    fetch: async () => assert.fail('Preflight must not fetch evidence'),
  };
  assert.equal(
    await runCoordinatorCommand('preflight', [qid], preflightOptions),
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
      'preflight',
      [qid, `--file=${invalidStaged}`],
      preflightOptions,
    ),
    true,
  );
  assert.equal(asRecord(output, 'preflight').ok, false);
  assert.match(
    String(asRecord(output, 'preflight').issues),
    /overview: no factual claims/,
  );

  const researchFlag = await legacyResearch();
  assert.deepEqual(await run('english-adversarial', qid, researchFlag), {
    status: 'skipped',
    targets: 0,
  });
  const audit = await run('english-audit', qid, researchFlag);
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
    (await run('english-audit', qid, researchFlag, `--result=${rejected}`))
      .status,
    'held',
  );

  const evidenceRepair = await run('english-repair', qid);
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
  await assert.rejects(
    run('english-audit', qid, researchFlag),
    /without --research/,
  );
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
    result: assessed(revised),
  });
  assert.equal(
    (await run('english-repair', qid, `--result=${repairReply}`)).status,
    'draft',
  );
  const checkpoint = await saved(options);
  assert.equal(checkpoint.record.overview, revised.overview);
  assert.equal(checkpoint.record.meta.review.status, 'draft');
  assert.equal(checkpoint.record.key_moments[0].claims, undefined);
  assert.equal(checkpoint.report.profile_hash, profileHash(initial));
  await assert.rejects(run('english-audit', qid), /Run english-adversarial/);
  const prepared = await run('english-adversarial', qid);
  assert.equal(typeof prepared.input_hash, 'string');
  assert.match(String(prepared.prompt), /targeted falsification/);
  assert.doesNotMatch(String(prepared.prompt), /Confirmed by the article/);
  const checks: AdversarialCheck[] = [
    {
      finding_index: 0,
      path: 'overview',
      queries: [
        'Principia publication chronology',
        'Principia first printing historians',
      ],
      outcome: 'conflict_found',
      note: 'An archival account gives a different year.',
      counterevidence: [
        {
          source: String(contrary.id),
          quote: contraryText,
          kind: 'scholarly',
          origin: 'Archival account',
        },
      ],
    },
  ];
  const stale = await save('adversarial-stale.json', {
    input_hash: 'stale',
    result: { checks },
  });
  await assert.rejects(
    run('english-adversarial', qid, `--result=${stale}`),
    /different inputs/,
  );
  const malformed = await save('adversarial-malformed.json', {
    input_hash: prepared.input_hash,
    result: { checks: [{ ...checks[0], counterevidence: [] }] },
  });
  await assert.rejects(
    run('english-adversarial', qid, `--result=${malformed}`),
    /needs counterevidence/,
  );
  const fabricated = await save('adversarial-fabricated.json', {
    input_hash: prepared.input_hash,
    result: {
      checks: [
        {
          ...checks[0],
          counterevidence: [
            { ...checks[0]?.counterevidence[0], quote: 'fabricated quote' },
          ],
        },
      ],
    },
  });
  await assert.rejects(
    run('english-adversarial', qid, `--result=${fabricated}`),
    /evidence was not found/,
  );
  assert.deepEqual(await saved(options), checkpoint);
  const valid = await save('adversarial.json', {
    input_hash: prepared.input_hash,
    model: 'independent researcher',
    result: { checks },
  });
  assert.deepEqual(await run('english-adversarial', qid, `--result=${valid}`), {
    status: 'saved',
    checks: 1,
    conflicts: 1,
  });
  const pending = (await saved(options)).record;
  assert.equal(
    pending.meta.pending_adversarial.profile_hash,
    profileHash(pending),
  );
  assert.equal(
    pending.meta.pending_adversarial.assessment_hash,
    hash(pending.meta.pending_assessment.assessment),
  );
  await writeFile(
    options.filePath,
    JSON.stringify({
      ...pending,
      meta: {
        ...pending.meta,
        pending_assessment: {
          ...pending.meta.pending_assessment,
          assessment: {
            ...pending.meta.pending_assessment.assessment,
            issues: ['changed assessment'],
          },
        },
      },
    }),
  );
  await assert.rejects(run('english-audit', qid), /Run english-adversarial/);
  await assert.rejects(
    run('english-adversarial', qid, `--result=${valid}`),
    /different inputs/,
  );
  await writeFile(options.filePath, JSON.stringify(pending));

  const freshAudit = await run('english-audit', qid);
  const auditPayload = JSON.parse(
    String(freshAudit.prompt).split('\n').at(-1) ?? '',
  );
  assert.equal(
    auditPayload.assessment.findings[0].counterevidence[0].quote,
    contraryText,
  );
  assert.equal(auditPayload.adversarial_notes[0].note, checks[0]?.note);
  const accepted = await save('accepted-audit.json', {
    input_hash: freshAudit.input_hash,
    result: { uncovered: [], issues: [], coherent: true },
  });
  assert.equal(
    (await run('english-audit', qid, `--result=${accepted}`)).status,
    'approved',
  );
  const english = await saved(options);
  assert.equal(english.record.meta.pending_assessment, undefined);
  assert.equal(english.record.meta.pending_adversarial, undefined);
  assert.deepEqual(english.report.adversarial, {
    model: 'independent researcher',
    checks,
  });
  assert.ok(english.report.models.includes('independent researcher'));
  assert.equal(english.report.repairs, 1);
  assert.equal(fetches, 3);
  assert.deepEqual(
    english.report.sources.map(({ id }) => id),
    [first.id, contrary.id],
  );
  await auditSavedProfile(options.filePath, SUBJECT, async (prompt, role) => {
    checkCounterevidence(prompt);
    return complete(prompt, role);
  });

  const translation = await run('russian-translation', qid);
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
  const fidelity = await run('russian-audit', qid, candidate);
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
  assert.deepEqual(
    approvedTranslation(
      await readTranslation(options.filePath),
      english.record,
    ),
    correctedFields,
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
  const checks = [
    makeCheck(
      { finding_index: 1, path: 'key_moments.0.date' },
      'no_conflict_found',
    ),
    makeCheck(
      { finding_index: 2, path: 'key_moments.0.title' },
      'fetch_blocked',
    ),
  ];
  await auditProfile(
    draft,
    SUBJECT,
    input,
    [snapshot],
    async (prompt, role) => {
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
      assert.deepEqual(payload.adversarial_notes, [
        {
          finding_index: 2,
          path: 'key_moments.0.title',
          outcome: 'fetch_blocked',
          note: checks[1]?.note,
        },
      ]);
      return complete(prompt, role);
    },
    checks,
  );
});

function highRiskDraft(
  overview = 'Newton was the first to describe a result.',
) {
  return {
    ...raw(),
    overview,
    deep_facts: [
      {
        text: 'Newton revised his account in a letter.',
        type: 'hidden_story',
        is_legend: false,
        confidence: 'high',
        source: URL,
      },
    ],
  };
}

function makeCheck(
  target: Pick<AdversarialTarget, 'finding_index' | 'path'>,
  outcome: AdversarialCheck['outcome'] = 'no_conflict_found',
  counterevidence: AdversarialCheck['counterevidence'] = [],
): AdversarialCheck {
  return {
    finding_index: target.finding_index,
    path: target.path,
    outcome,
    counterevidence,
    note: `Search outcome for ${target.path}`,
    queries: ['Newton result chronology', 'Newton result disputed attribution'],
  };
}

test('adversarial targets are deterministic and capped, and the prompt omits writer explanations', () => {
  const draft = parseModelProfile(highRiskDraft(), 'test');
  const input = assessment(draft);
  const example = input.findings[0];
  assert.ok(example);
  input.subject_dates = [
    { path: 'overview', boundary: 'start', year: 1643 },
    { path: 'overview', boundary: 'end', year: 1727 },
  ];
  input.findings = [
    {
      ...example,
      claim: 'Newton was born in AD 1643 and died in 1727.',
      risk: 'corroborate',
    },
    { ...example, path: 'deep_facts.0.text', verdict: 'disputed' },
    { ...example, claim: 'Newton invented something, allegedly.' },
    {
      ...example,
      path: 'key_moments.0.text',
      claim: '“This is an attributed quotation”',
    },
    { ...example, path: 'key_moments.0.text', claim: 'A short “quotation”.' },
    { ...example, claim: 'A claim needing corroboration', risk: 'corroborate' },
    {
      ...example,
      path: 'deep_facts.0.text',
      claim: 'Newton revised an account.',
    },
    { ...example, path: 'key_moments.0.text', claim: 'A legend about Newton.' },
    { ...example, path: 'key_moments.0.title', claim: 'The only printing.' },
  ];
  const targets = selectAdversarialTargets(draft, input);
  assert.deepEqual(
    targets.map(({ finding_index }) => finding_index),
    [6, 5, 2, 3, 7],
  );
  assert.deepEqual(targets, selectAdversarialTargets(draft, input));
  assert.equal(
    targets[0]?.claim_hash,
    hash({ path: targets[0]?.path, claim: targets[0]?.claim }),
  );
  const prompt = adversarialPrompt(draft, SUBJECT, input, targets, [SOURCE]);
  const payload = JSON.parse(prompt.split('\n').at(-1) ?? '');
  assert.deepEqual(Object.keys(payload).sort(), [
    'cited_urls',
    'subject',
    'targets',
  ]);
  assert.equal(payload.subject.qid, SUBJECT.qid);
  assert.deepEqual(payload.cited_urls, [URL]);
  assert.equal(payload.targets[0].passage_text, draft.deep_facts[0]?.text);
  assert.doesNotMatch(prompt, /Confirmed by the article/);
});

test('adversarial merging preserves supporting evidence and verifies every added quote', () => {
  const draft = parseModelProfile(highRiskDraft(), 'test');
  const input = assessment(draft);
  const target = selectAdversarialTargets(draft, input).find(
    ({ path }) => path === 'overview',
  );
  assert.ok(target);
  const finding = input.findings[target.finding_index];
  assert.ok(finding);
  const excerpt = {
    source: SOURCE.id,
    quote: 'English mathematician.',
    kind: 'other' as const,
    origin: 'Newton article',
  };
  finding.counterevidence = [excerpt];
  const checks = [
    makeCheck(target, 'conflict_found', [
      { ...excerpt, quote: 'English\n mathematician.' },
      { ...excerpt, quote: 'Fabricated text' },
      { ...excerpt, source: 'a'.repeat(64) },
    ]),
  ];
  const merged = mergeAdversarialResult(input, { checks });
  assert.deepEqual(finding.counterevidence, [excerpt]);
  assert.deepEqual(merged.findings[target.finding_index]?.counterevidence, [
    excerpt,
    ...(checks[0]?.counterevidence.slice(1) ?? []),
  ]);
  assert.deepEqual(
    merged.findings[target.finding_index]?.evidence,
    finding.evidence,
  );
  assert.equal(merged.findings[target.finding_index]?.verdict, 'supported');
  assert.equal(checkEvidence(merged, [SOURCE]).length, 2);
  assert.throws(
    () =>
      parseAdversarialResult(
        { checks },
        selectAdversarialTargets(draft, input),
      ),
    /Missing adversarial checks/,
  );
  assert.throws(
    () => parseAdversarialResult({ checks: [...checks, ...checks] }, [target]),
    /duplicate/,
  );
});

test('API verification rechecks a repaired claim and reindexes unchanged cached findings', async (t) => {
  const { options, root } = await setup(t);
  await writeFile(options.filePath, JSON.stringify(highRiskDraft()));
  const revised = highRiskDraft(
    'Newton is traditionally credited with the first description.',
  );
  const calls: string[][] = [];
  const counterUrl = 'https://archive.example.org/newton';
  const fields = {
    url: counterUrl,
    fetched_at: SOURCE.fetched_at,
    text: 'An earlier description survives in an archive.',
  };
  const source = { ...fields, id: hash(fields) };
  options.sources = new SourceStore(async (url) =>
    url === URL ? SOURCE : source,
  );
  let pass = 0;
  options.research = async (...args) => {
    const result = await research(...args);
    if (++pass > 1) result.assessment.findings.reverse();
    return result;
  };
  options.adversarial = async (
    _profile,
    _subject,
    _assessment,
    targets,
    sources,
  ) => {
    calls.push(targets.map(({ path }) => path));
    const checked = await sources.read(counterUrl);
    return {
      model: 'adversarial-model',
      checks: targets.map((target) =>
        target.path === 'overview'
          ? makeCheck(target, 'conflict_found', [
              {
                source: checked.id,
                quote: checked.text,
                kind: 'scholarly',
                origin: 'Archive',
              },
            ])
          : makeCheck(target),
      ),
    };
  };
  options.complete = async (prompt, role) => {
    assert.ok(calls.length);
    if (role === 'repair')
      return {
        ...(await complete(prompt, role)),
        text: JSON.stringify(revised),
      };
    const payload = JSON.parse(prompt.split('\n').at(-1) ?? '');
    assert.equal(payload.adversarial_notes.length, 1);
    const note = payload.adversarial_notes[0];
    assert.equal(
      payload.assessment.findings[note.finding_index].counterevidence[0].quote,
      source.text,
    );
    return {
      ...(await complete(prompt, role)),
      text: JSON.stringify({
        coherent: true,
        uncovered: [],
        issues: pass === 1 ? ['overview: qualify the first claim'] : [],
      }),
    };
  };
  assert.equal((await verifyProfile(options)).status, 'approved');
  assert.deepEqual(calls, [['deep_facts.0.text', 'overview'], ['overview']]);
  const { record, report } = await saved(options);
  assert.equal(record.overview, revised.overview);
  assert.equal(report.repairs, 1);
  assert.equal(report.adversarial?.model, 'adversarial-model');
  assert.deepEqual(report.models, ['verifier', 'adversarial-model', 'auditor']);
  assert.deepEqual(
    report.adversarial?.checks.map(({ finding_index, path }) => [
      finding_index,
      path,
    ]),
    [
      [0, 'deep_facts.0.text'],
      [4, 'overview'],
    ],
  );
  assert.deepEqual(
    JSON.parse(
      await readFile(path.join(root, 'evidence', `${source.id}.json`), 'utf8'),
    ),
    source,
  );

  const target = {
    ...SUBJECT,
    slug: 'newton',
    fameScore: 99,
    dates: '1643–1727',
  };
  const { adversarial, ...base } = report;
  assert.ok(adversarial);
  function published(updated: Report) {
    const receipted = {
      ...record,
      meta: {
        ...record.meta,
        review: {
          ...record.meta.review,
          approval: {
            ...record.meta.review.approval,
            policy_version: updated.policy_version,
            report_hash: hash(updated),
          },
        },
      },
    };
    return shipProfiles(
      [parseRawProfile(receipted, options.filePath, updated)],
      [target],
    ).size;
  }
  assert.equal(published(report), 1);
  assert.equal(published(base), 0);
  assert.equal(
    published({
      ...report,
      adversarial: { ...adversarial, checks: adversarial.checks.slice(1) },
    }),
    0,
  );
  assert.equal(
    published({
      ...report,
      adversarial: {
        ...adversarial,
        checks: adversarial.checks.map((check) => ({
          ...check,
          counterevidence: [],
        })),
      },
    }),
    0,
  );
  for (const policy_version of ['2', '3', '4', '5', '6'])
    assert.equal(published({ ...base, policy_version }), 1, policy_version);
});

test('verification skips absent targets and retries a failed adversarial fetch without repairing prose', async (t) => {
  const { options } = await setup(t);
  options.adversarial = async () =>
    assert.fail('ordinary claims need no adversarial call');
  assert.equal((await verifyProfile(options)).status, 'approved');

  const draft = highRiskDraft();
  await writeFile(options.filePath, JSON.stringify(draft));
  const failedUrl = 'https://archive.example.org/unavailable';
  options.sources = new SourceStore(async (url) => {
    if (url === failedUrl) throw new Error('Temporary failure');
    return SOURCE;
  });
  options.adversarial = async (
    _profile,
    _subject,
    _assessment,
    targets,
    sources,
  ) => {
    await assert.rejects(sources.read(failedUrl), /Temporary failure/);
    return {
      model: 'independent',
      checks: targets.map((target) => makeCheck(target, 'fetch_blocked')),
    };
  };
  options.complete = async (prompt, role) => {
    assert.equal(role, 'audit');
    return complete(prompt, role);
  };
  assert.equal((await verifyProfile(options)).status, 'retry');
  assert.equal((await saved(options)).record.overview, draft.overview);

  const disabled = routeVerificationModels(['--no-adversarial']);
  const { adversarial, adversarialDisabled } = disabled;
  options.sources = new SourceStore(undefined, [SOURCE]);
  assert.equal(adversarial, undefined);
  assert.equal(adversarialDisabled, true);
  assert.equal(
    (await verifyProfile({ ...options, adversarial, adversarialDisabled }))
      .status,
    'approved',
  );
  assert.equal((await saved(options)).report.adversarial_disabled, true);
});

test('OpenAI routing honors the model override and caps adversarial searches, reads and turns', async (t) => {
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  t.after(() => {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  });
  const draft = parseModelProfile(highRiskDraft(), 'test');
  const input = assessment(draft);
  const targets = selectAdversarialTargets(draft, input);
  const args = [draft, SUBJECT, input, targets] as const;
  const routed = routeVerificationModels([
    '--model=research-model',
    '--adversarial-model=search-model',
  ]);
  assert.ok(routed.adversarial);
  const requests: ResponseCreateParamsNonStreaming[] = [];
  const functionCall = (id: number) => ({
    type: 'function_call',
    name: 'read_source',
    call_id: `call_${id}`,
    arguments: JSON.stringify({ url: URL, offset: 0, query: null }),
  });
  const mock = t.mock.method(
    OpenAI.Responses.prototype,
    'create',
    async (request: ResponseCreateParamsNonStreaming) => {
      requests.push(request);
      const step = requests.length;
      if (step === 1)
        return {
          status: 'completed',
          output: [
            ...Array.from({ length: 6 }, () => ({ type: 'web_search_call' })),
            functionCall(step),
          ],
        };
      if (step < 6)
        return { status: 'completed', output: [functionCall(step)] };
      return {
        status: 'completed',
        model: request.model,
        output: [],
        output_text: JSON.stringify({
          checks: targets.map((target) => makeCheck(target)),
        }),
      };
    },
  );
  const snapshots = new SourceStore(undefined, [SOURCE]);
  const budget = { turns: 0, searches: 0, reads: 0 };
  const result = await routed.adversarial(...args, snapshots, budget);
  assert.equal(result.model, 'search-model');
  assert.equal(requests.length, 6);
  assert.equal(requests[0]?.max_tool_calls, 6);
  assert.equal(requests[0]?.reasoning?.effort, 'medium');
  assert.deepEqual(
    requests[1]?.tools?.map(({ type }) => type),
    ['function'],
  );
  assert.equal(requests[5]?.tools, undefined);
  const secondInput = requests[1]?.input;
  assert.ok(Array.isArray(secondInput));
  const toolOutput = secondInput.find(
    ({ type }) => type === 'function_call_output',
  );
  assert.equal(
    toolOutput?.type === 'function_call_output' &&
      JSON.parse(String(toolOutput.output)).id,
    SOURCE.id,
  );
  await assert.rejects(
    routed.adversarial(...args, snapshots, budget),
    /turn budget exhausted/,
  );
  mock.mock.restore();

  let reads = 0;
  const sourceStore = new SourceStore(undefined, [SOURCE]);
  const readExcerpt = sourceStore.readExcerpt.bind(sourceStore);
  t.mock.method(
    sourceStore,
    'readExcerpt',
    async (input: Record<string, unknown>) => {
      reads++;
      return readExcerpt(input);
    },
  );
  const fallback = routeVerificationModels(['--model=research-model']);
  assert.ok(fallback.adversarial);
  t.mock.method(
    OpenAI.Responses.prototype,
    'create',
    async (request: ResponseCreateParamsNonStreaming) => {
      assert.equal(request.model, 'research-model');
      return {
        status: 'completed',
        output: Array.from({ length: 9 }, (_, index) => functionCall(index)),
      };
    },
  );
  await assert.rejects(
    fallback.adversarial(...args, sourceStore),
    /source-read budget exhausted/,
  );
  assert.equal(reads, 8);
});
