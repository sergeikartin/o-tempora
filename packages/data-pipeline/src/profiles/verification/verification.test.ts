import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type TestContext, test } from 'node:test';
import {
  parseRawProfile,
  readRawProfiles,
  shipProfiles,
} from '../../output/profiles.js';
import { type ModelProfile, parseModelProfile } from '../model-profile.js';
import type { Complete } from '../providers.js';
import type { ProfileSubject } from '../subjects.js';
import { auditSavedProfile } from './audit-saved.js';
import { evidenceChecks, mechanicalChecks, yearRange } from './mechanical.js';
import {
  type Assessment,
  blockers,
  checkEvidence,
  hasApproval,
  hash,
  POLICY_VERSION,
  passages,
  profileHash,
  type Report,
  type Source,
} from './policy.js';
import { auditProfile, type Research } from './researcher.js';
import { reportPathFor, type VerifyOptions, verifyProfile } from './runner.js';
import { htmlText, publicIPv4, SourceStore, sourceUrl } from './sources.js';

const URL = 'https://en.wikipedia.org/wiki/Isaac_Newton';
const SUBJECT: ProfileSubject = {
  qid: 'Q935',
  lane: 'people',
  name: 'Isaac Newton',
  dates: '1643–1727',
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
  const text = `Nearby quote one. Nearby quote two. ${'Padding '.repeat(250)} Distant quote.`;
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
      assert.deepEqual(payload.source_contexts, [
        {
          source: source.id,
          url: URL,
          excerpts: [
            text.slice(0, text.indexOf(quotes[1]) + quotes[1].length + 700),
            text.slice(text.indexOf(quotes[2]) - 700),
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
        { source: SOURCE.id, url: SOURCE.url, excerpts: [TEXT] },
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

  const snapshotPath = path.join(root, 'evidence', `${SOURCE.id}.json`);
  await writeFile(snapshotPath, JSON.stringify({ ...SOURCE, text: 'changed' }));
  await assert.rejects(
    auditSavedProfile(options.filePath, SUBJECT, complete),
    /Saved source content does not match/,
  );
});

test('verified content ships through Output; changing prose, identity, policy or report revokes approval', async (t) => {
  const { root, options } = await setup(t);
  assert.equal((await verifyProfile(options)).status, 'approved');
  const { record, report } = await saved(options);
  const paths = passages(parseModelProfile(record, 'test')).map(
    (item) => item.path,
  );
  assert.equal(hasApproval(record, report, paths), true);
  const files = await readRawProfiles(root);
  assert.equal(
    shipProfiles(files, [
      {
        qid: 'Q935',
        name: 'Isaac Newton',
        slug: 'newton',
        lane: 'people',
        fameScore: 99,
        dates: SUBJECT.dates,
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
  ])
    assert.equal(hasApproval(change(), report, paths), false);
  assert.equal(
    hasApproval(record, { ...report, verified_at: 'tampered' }, paths),
    false,
  );
  assert.equal(
    hasApproval(record, { ...report, policy_version: 'old' }, paths),
    false,
  );
  assert.equal(hasApproval(record, undefined, paths), false);
  assert.equal(
    parseRawProfile(
      { ...raw(), meta: { ...raw().meta, review: { status: 'edited' } } },
      'test',
    ).approved,
    false,
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
  const target = { ...SUBJECT, slug: 'newton', fameScore: 99 };
  const files = await readRawProfiles(root);
  assert.equal(shipProfiles(files, [target]).size, 1);
  const changed = { ...target, dates: '1642–1727' };
  assert.equal(shipProfiles(files, [changed]).size, 0);
  assert.equal(
    (await verifyProfile({ ...options, subject: changed })).status,
    'approved',
  );
  assert.equal(shipProfiles(await readRawProfiles(root), [changed]).size, 1);
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
  assert.equal((await readRawProfiles(root))[0]?.approved, false);
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
  const item = assessment(parseModelProfile(raw(), 'test'));
  const first = item.findings[0];
  assert.ok(first?.evidence[0]);
  first.risk = 'corroborate';
  const report: Omit<Report, 'blockers'> = {
    policy_version: POLICY_VERSION,
    profile_hash: 'hash',
    verified_at: 'date',
    subject: { qid: 'Q935', dates: SUBJECT.dates },
    models: ['test'],
    assessment: item,
    audit: { uncovered: [], issues: [], coherent: true },
    sources: [SOURCE],
    evidence_errors: [],
    mechanical: [],
    repairs: 0,
  };
  assert.match(blockers(report, item.covered).join(), /corroboration missing/);
  report.sources.push({
    ...SOURCE,
    id: 'second',
    url: 'https://archive.example.org/book',
  });
  first.evidence.push({
    ...first.evidence[0],
    source: 'second',
    kind: 'scholarly',
  });
  assert.match(blockers(report, item.covered).join(), /corroboration missing/);
  first.evidence[1] = {
    ...first.evidence[0],
    source: 'second',
    kind: 'scholarly',
    origin: 'Independent archival research',
  };
  assert.deepEqual(blockers(report, item.covered), []);
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
