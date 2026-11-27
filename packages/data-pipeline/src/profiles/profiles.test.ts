import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { applyProfilePatch, applyProfilePolishPatch } from './patch.ts';
import { workFile } from './paths.ts';
import {
  type CheckVerdict,
  CheckVerdictSchema,
  CURRENT_PROMPT_VERSION,
  computeEnglishSourceHash,
  computePromptHash,
  type ProfileDraft,
  ProfilePatchSchema,
  type StoredProfile,
  StoredProfileSchema,
} from './schemas.ts';
import {
  extractMarkdownHeadings,
  fetchSource,
  htmlToCleanMarkdown,
  readSourceIndex,
} from './sources.ts';
import { writeJsonFile } from './store.ts';
import { findEntities, formatDates, type ProfileSubject } from './subjects.ts';
import { validateCheck, validateDraft } from './validate.ts';
import {
  computeLocalePromptHash,
  getProfileStatus,
  prepareProfiles,
  promoteProfile,
} from './workflow.ts';

const EINSTEIN: ProfileSubject = {
  qid: 'Q937',
  lane: 'people',
  slug: 'albert-einstein',
  name: 'Albert Einstein',
  tagline: 'German-born theoretical physicist',
  dateSpan: { startYear: 1879, endYear: 1955 },
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Albert_Einstein',
  fameScore: 98,
  detailLevel: 1,
  ru: { name: 'Альберт Эйнштейн' },
};

const SUBJECTS: ProfileSubject[] = [
  EINSTEIN,
  {
    qid: 'Q9021',
    lane: 'people',
    slug: 'max-planck',
    name: 'Max Planck',
    tagline: 'German theoretical physicist',
    dateSpan: { startYear: 1858, endYear: 1947 },
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Max_Planck',
    fameScore: 86,
    detailLevel: 3,
    ru: { name: 'Макс Планк' },
  },
  {
    qid: 'Q11452',
    lane: 'milestones',
    slug: 'general-relativity',
    name: 'general relativity',
    tagline: 'theory of gravitation',
    dateSpan: { startYear: 1915 },
    wikipediaUrl: 'https://en.wikipedia.org/wiki/General_relativity',
    fameScore: 84,
    detailLevel: 2,
    ru: { name: 'общая теория относительности' },
  },
];

const SUBJECT_BY_QID = new Map(SUBJECTS.map((s) => [s.qid, s]));

function sampleEnDraft(overrides: Partial<ProfileDraft> = {}): ProfileDraft {
  return {
    qid: 'Q937',
    subjectDates: '1879–1955',
    writerModel: 'test-writer',
    overview: 'Albert Einstein reshaped **modern physics**.',
    keyMoments: [
      {
        date: '1905',
        title: 'Miracle year',
        text: 'He published **special relativity** in Bern.',
        sourceUrl: 'https://en.wikipedia.org/wiki/Albert_Einstein#1905',
      },
      {
        date: '1915–1919',
        title: 'Eclipse confirmation',
        text: 'General relativity passed its **1919 eclipse** test.',
        sourceUrl: 'https://example.org/eclipse',
      },
    ],
    deepFacts: [
      {
        text: 'He co-patented a **1930** refrigerator with Leó Szilárd.',
        isLegend: false,
        sourceUrl: 'https://example.org/fridge',
      },
    ],
    connections: [
      {
        qid: 'Q9021',
        reason: 'Planck persuaded Einstein to move to Berlin.',
      },
    ],
    ...overrides,
  };
}

function sampleStoredEn(overrides: Partial<StoredProfile> = {}): StoredProfile {
  const draft = sampleEnDraft();
  return {
    overview: draft.overview,
    keyMoments: draft.keyMoments,
    deepFacts: draft.deepFacts,
    connections: draft.connections,
    meta: {
      qid: 'Q937',
      locale: 'en',
      subjectDates: '1879–1955',
      approvedAt: '2026-11-26T00:00:00.000Z',
    },
    ...overrides,
  };
}

function sampleCheck(overrides: Partial<CheckVerdict> = {}): CheckVerdict {
  return {
    qid: 'Q937',
    locale: 'en',
    verdict: 'pass',
    checkerModel: 'test-checker',
    checks: [{ path: 'overview', status: 'pass', note: 'Verified.' }],
    blockers: [],
    suggestions: [],
    ...overrides,
  };
}

test('CheckVerdictSchema enforces blocker consistency for pass and revise', () => {
  assert.equal(CheckVerdictSchema.safeParse(sampleCheck()).success, true);
  assert.equal(
    CheckVerdictSchema.safeParse(
      sampleCheck({
        verdict: 'pass',
        blockers: [{ path: 'overview', issue: 'x', fix: 'y' }],
      }),
    ).success,
    false,
  );
  assert.equal(
    CheckVerdictSchema.safeParse(
      sampleCheck({ verdict: 'revise', blockers: [] }),
    ).success,
    false,
  );
});

test('computeEnglishSourceHash ignores sourceUrl edits but detects prose changes', () => {
  const base = sampleStoredEn();
  const [firstMoment, secondMoment] = base.keyMoments;
  assert.ok(firstMoment && secondMoment);
  const urlChanged = sampleStoredEn({
    keyMoments: [
      {
        ...firstMoment,
        sourceUrl: 'https://example.org/different-source',
      },
      secondMoment,
    ],
  });
  const proseChanged = sampleStoredEn({
    overview: 'Albert Einstein transformed **physics**.',
  });

  assert.equal(
    computeEnglishSourceHash(base),
    computeEnglishSourceHash(urlChanged),
  );
  assert.notEqual(
    computeEnglishSourceHash(base),
    computeEnglishSourceHash(proseChanged),
  );
});

test('findEntities matches by name, Russian name, QID, and Wikipedia URL offline', () => {
  assert.equal(findEntities(SUBJECTS, 'Planck')[0]?.qid, 'Q9021');
  assert.equal(findEntities(SUBJECTS, 'Q11452')[0]?.slug, 'general-relativity');
  assert.equal(findEntities(SUBJECTS, 'Альберт Эйнштейн')[0]?.qid, 'Q937');
  assert.equal(
    findEntities(SUBJECTS, 'https://en.wikipedia.org/wiki/Max_Planck')[0]?.qid,
    'Q9021',
  );
  assert.deepEqual(findEntities(SUBJECTS, 'Nonexistent Person'), []);
});

test('formatDates handles BC/AD, approximate, and ongoing spans', () => {
  assert.equal(formatDates({ startYear: 1879, endYear: 1955 }), '1879–1955');
  assert.equal(formatDates({ startYear: -550, endYear: -478 }), '551–479 BC');
  assert.equal(formatDates({ startYear: -43, endYear: 14 }), '44 BC–AD 14');
  assert.equal(formatDates({ startYear: 1950, ongoing: true }), '1950–present');
});

test('htmlToCleanMarkdown strips scripts/nav and preserves headings for line indexing', () => {
  const html = `
    <html><head><title>Test Page</title></head>
    <body>
      <nav><a href="/">Skip nav</a></nav>
      <script>alert(1)</script>
      <h1>Main Title</h1>
      <p>Hello <b>world</b>.</p>
      <h2>Early life<span class="mw-editsection">[edit]</span></h2>
      <p>Born in 1879.</p>
    </body></html>
  `;
  const md = htmlToCleanMarkdown(html);
  assert.ok(!md.includes('Skip nav'));
  assert.ok(!md.includes('alert(1)'));
  assert.ok(!md.includes('[edit]'));
  assert.ok(md.includes('# Main Title'));
  assert.ok(md.includes('## Early life'));
  const headings = extractMarkdownHeadings(md);
  assert.deepEqual(
    headings.map((h) => ({ level: h.level, heading: h.heading })),
    [
      { level: 1, heading: 'Main Title' },
      { level: 2, heading: 'Early life' },
    ],
  );
});

test('fetchSource caches clean markdown, indexes redirects, and rejects bot walls / PDFs', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'profiles-sources-'));
  t.after(() => rm(dir, { recursive: true, force: true }));

  const longBody = 'Historical fact paragraph. '.repeat(20);
  const mockFetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('redirect')) {
      return new Response(
        `<html><head><title>Target</title></head><body><h1>Heading</h1><p>${longBody}</p></body></html>`,
        {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        },
      );
    }
    if (url.includes('botwall')) {
      return new Response(
        `<html><head><title>Just a moment...</title></head><body><p>Verify you are human ${longBody}</p></body></html>`,
        { status: 200, headers: { 'content-type': 'text/html' } },
      );
    }
    if (url.includes('paper.pdf')) {
      return new Response('%PDF-1.7', {
        status: 200,
        headers: { 'content-type': 'application/pdf' },
      });
    }
    return new Response('Not found', { status: 404 });
  }) as unknown as typeof fetch;

  const first = await fetchSource('https://example.org/redirect', {
    sourcesDir: dir,
    fetchImpl: mockFetch,
  });
  assert.equal(first.cached, false);
  assert.equal(first.title, 'Target');
  assert.ok(first.headings.some((h) => h.heading === 'Heading'));

  const second = await fetchSource('https://example.org/redirect#Heading', {
    sourcesDir: dir,
    fetchImpl: mockFetch,
  });
  assert.equal(second.cached, true);
  assert.equal(second.path, first.path);

  const index = await readSourceIndex(dir);
  assert.ok(index['https://example.org/redirect']);

  await assert.rejects(
    fetchSource('https://example.org/botwall', {
      sourcesDir: dir,
      fetchImpl: mockFetch,
    }),
    /bot challenge/i,
  );
  await assert.rejects(
    fetchSource('https://example.org/paper.pdf', {
      sourcesDir: dir,
      fetchImpl: mockFetch,
    }),
    /Unsupported content-type/i,
  );
});

test('validateDraft checks English cached URLs, dates, markup, and Connections', () => {
  const sourceIndex = {
    'https://en.wikipedia.org/wiki/Albert_Einstein': {
      hash: 'a',
      file: 'a.md',
      requestedUrl: 'https://en.wikipedia.org/wiki/Albert_Einstein',
      finalUrl: 'https://en.wikipedia.org/wiki/Albert_Einstein',
      title: 'Albert Einstein',
      fetchedAt: '2026-11-26T00:00:00Z',
      lineCount: 100,
    },
    'https://example.org/eclipse': {
      hash: 'b',
      file: 'b.md',
      requestedUrl: 'https://example.org/eclipse',
      finalUrl: 'https://example.org/eclipse',
      title: 'Eclipse',
      fetchedAt: '2026-11-26T00:00:00Z',
      lineCount: 40,
    },
    'https://example.org/fridge': {
      hash: 'c',
      file: 'c.md',
      requestedUrl: 'https://example.org/fridge',
      finalUrl: 'https://example.org/fridge',
      title: 'Fridge',
      fetchedAt: '2026-11-26T00:00:00Z',
      lineCount: 40,
    },
  };

  const valid = validateDraft(sampleEnDraft(), {
    locale: 'en',
    subject: EINSTEIN,
    subjectByQid: SUBJECT_BY_QID,
    sourceIndex,
  });
  assert.equal(valid.ok, true);

  const invalid = validateDraft(
    sampleEnDraft({
      overview: 'Unpaired **bold',
      keyMoments: [
        {
          date: '1950–1910',
          title: 'Bad range',
          text: 'Text',
          sourceUrl: 'https://uncached.example/page',
        },
      ],
      connections: [
        { qid: 'Q937', reason: 'Self.' },
        { qid: 'Q999999', reason: 'Missing.' },
      ],
    }),
    {
      locale: 'en',
      subject: EINSTEIN,
      subjectByQid: SUBJECT_BY_QID,
      sourceIndex,
    },
  );
  assert.equal(invalid.ok, false);
  assert.ok(invalid.issues.some((i) => i.includes('unpaired "**"')));
  assert.ok(invalid.issues.some((i) => i.includes('reversed year range')));
  assert.ok(invalid.issues.some((i) => i.includes('not been fetched')));
  assert.ok(
    invalid.issues.some((i) => i.includes('connect subject to itself')),
  );
  assert.ok(invalid.issues.some((i) => i.includes('Q999999')));
});

test('validateDraft checks Russian alignment, bold, Cyrillic, and Roman numerals', () => {
  const en = sampleStoredEn({
    overview: 'A **19th**-century pioneer.',
  });
  const sourceHash = computeEnglishSourceHash(en);

  const ruOk = validateDraft(
    {
      qid: 'Q937',
      subjectDates: '1879–1955',
      sourceHash,
      overview: 'Новатор **XIX** века.',
      keyMoments: [
        {
          date: '1905',
          title: 'Год чудес',
          text: 'Он опубликовал **специальную теорию относительности** в Берне.',
          sourceUrl: en.keyMoments[0]?.sourceUrl,
        },
        {
          date: '1915–1919',
          title: 'Затмение',
          text: 'Общая теория прошла проверку во время **затмения 1919 года**.',
          sourceUrl: en.keyMoments[1]?.sourceUrl,
        },
      ],
      deepFacts: [
        {
          text: 'В **1930** году он запатентовал холодильник с Лео Силардом.',
          isLegend: false,
          sourceUrl: en.deepFacts[0]?.sourceUrl,
        },
      ],
      connections: [
        { qid: 'Q9021', reason: 'Планк убедил Эйнштейна переехать в Берлин.' },
      ],
    },
    {
      locale: 'ru',
      subject: EINSTEIN,
      subjectByQid: SUBJECT_BY_QID,
      englishProfile: en,
    },
  );
  assert.equal(ruOk.ok, true, ruOk.issues.join('; '));

  const ruBad = validateDraft(
    {
      qid: 'Q937',
      subjectDates: '1879–1955',
      sourceHash: 'wrong-hash',
      overview: 'Still in English without bold.',
      keyMoments: [],
      deepFacts: [],
      connections: [],
    },
    {
      locale: 'ru',
      subject: EINSTEIN,
      subjectByQid: SUBJECT_BY_QID,
      englishProfile: en,
    },
  );
  assert.equal(ruBad.ok, false);
});

test('applyProfilePatch enforces blocker paths and preserves untouched passages verbatim', () => {
  const draft = sampleEnDraft();
  const check = sampleCheck({
    verdict: 'revise',
    blockers: [
      {
        path: 'deepFacts.0.text',
        issue: 'Check refrigerator claim.',
        fix: 'Drop or clarify.',
      },
    ],
  });

  const disallowedPatch = ProfilePatchSchema.parse({
    overview: 'Changed overview sneakily.',
  });
  assert.throws(
    () => applyProfilePatch(draft, check, disallowedPatch),
    /unflagged path\(s\): overview/,
  );

  const dropPatch = ProfilePatchSchema.parse({
    deepFacts: { '0': null },
  });
  const { draft: merged, patchedPaths } = applyProfilePatch(
    draft,
    check,
    dropPatch,
  );
  assert.deepEqual(patchedPaths, ['deepFacts.0']);
  assert.equal(merged.overview, draft.overview);
  assert.deepEqual(merged.keyMoments, draft.keyMoments);
  assert.deepEqual(merged.deepFacts, []);
});

test('prepare, promote, and status work end-to-end across EN and RU', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'profiles-flow-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const rawProfilesDir = path.join(root, 'raw');
  const workDir = path.join(root, '.work');
  const sourcesDir = path.join(workDir, 'sources');

  const longPage =
    'Einstein biography details and historical milestones. '.repeat(15);
  const mockFetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('wikidata.org')) {
      return new Response(
        JSON.stringify({
          entities: {
            Q937: { sitelinks: { ruwiki: { title: 'Эйнштейн, Альберт' } } },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    return new Response(
      `<html><head><title>Page</title></head><body><h1>Section</h1><p>${longPage}</p></body></html>`,
      { status: 200, headers: { 'content-type': 'text/html' } },
    );
  }) as unknown as typeof fetch;

  // 1. Prepare EN
  const enPrepared = await prepareProfiles({
    qids: ['Q937'],
    locale: 'en',
    subjects: SUBJECTS,
    rawProfilesDir,
    workDir,
    sourcesDir,
    fetchImpl: mockFetch,
  });
  assert.equal(enPrepared.length, 1);
  assert.ok(enPrepared[0]?.wikipediaPath);

  // Cache additional cited sources used by sampleEnDraft
  await fetchSource('https://example.org/eclipse', {
    sourcesDir,
    fetchImpl: mockFetch,
  });
  await fetchSource('https://example.org/fridge', {
    sourcesDir,
    fetchImpl: mockFetch,
  });

  // 2. Write EN draft & escalated check -> status shows needs-review
  await writeJsonFile(
    workFile('Q937', 'en.draft.json', workDir),
    sampleEnDraft(),
  );
  await writeJsonFile(
    workFile('Q937', 'en.check.json', workDir),
    sampleCheck({
      verdict: 'escalate',
      blockers: [{ path: 'overview', issue: 'Disputed', fix: 'Human review' }],
    }),
  );

  const needsReviewStatus = await getProfileStatus({
    locale: 'en',
    qids: ['Q937'],
    subjects: SUBJECTS,
    rawProfilesDir,
    workDir,
  });
  assert.equal(needsReviewStatus.items[0]?.stage, 'needs-review');

  // Cannot promote without --human-approved while escalated
  await assert.rejects(
    promoteProfile({
      qid: 'Q937',
      locale: 'en',
      subjects: SUBJECTS,
      rawProfilesDir,
      workDir,
      sourcesDir,
    }),
    /latest verdict is "escalate"/,
  );

  // Pass check and promote
  await writeJsonFile(
    workFile('Q937', 'en.check.json', workDir),
    sampleCheck(),
  );
  const promoted = await promoteProfile({
    qid: 'Q937',
    locale: 'en',
    subjects: SUBJECTS,
    writerModel: 'gpt-6.2-astra',
    checkerModel: 'gpt-6.2-astra',
    harness: 'codex',
    rawProfilesDir,
    workDir,
    sourcesDir,
  });
  const storedRaw = JSON.parse(await readFile(promoted.filePath, 'utf8'));
  const stored = StoredProfileSchema.parse(storedRaw);
  assert.equal(stored.meta.qid, 'Q937');
  assert.equal(stored.meta.subjectDates, '1879–1955');
  assert.equal(stored.meta.writerModel, 'gpt-6.2-astra');
  assert.equal(stored.meta.checkerModel, 'gpt-6.2-astra');
  assert.equal(stored.meta.harness, 'codex');
  assert.equal(stored.meta.promptVersion, CURRENT_PROMPT_VERSION);
  assert.equal(stored.meta.promptHash, await computeLocalePromptHash('en'));
  assert.equal(stored.meta.approval, 'checker');
  assert.equal(stored.meta.revised, false);

  // Overwrite guard without --force
  await assert.rejects(
    promoteProfile({
      qid: 'Q937',
      locale: 'en',
      subjects: SUBJECTS,
      rawProfilesDir,
      workDir,
      sourcesDir,
    }),
    /Pass --force to overwrite/,
  );

  // 3. Prepare RU fetches Russian Wikipedia + includes connectionNamesRu
  const ruPrepared = await prepareProfiles({
    qids: ['Q937'],
    locale: 'ru',
    subjects: SUBJECTS,
    rawProfilesDir,
    workDir,
    sourcesDir,
    fetchImpl: mockFetch,
  });
  const ruFirst = ruPrepared[0];
  assert.ok(ruFirst?.wikipediaPath);
  const ruBrief = JSON.parse(await readFile(ruFirst.briefPath, 'utf8'));
  assert.equal(ruBrief.connectionNamesRu.Q9021, 'Макс Планк');
  assert.equal(ruBrief.sourceHash, computeEnglishSourceHash(stored));

  // 4. Validate check helper
  assert.equal(
    validateCheck(sampleCheck(), { qid: 'Q937', locale: 'en' }).ok,
    true,
  );
});

test('computePromptHash normalizes line endings and tracks prompt edits', () => {
  assert.equal(
    computePromptHash(['line1\r\nline2', 'checker\r\n']),
    computePromptHash(['line1\nline2', 'checker\n']),
  );
  assert.notEqual(
    computePromptHash(['writer v1', 'checker v1']),
    computePromptHash(['writer v2', 'checker v1']),
  );
});

test('promoteProfile requires model provenance and records revised/human approval metadata', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'profiles-meta-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const rawProfilesDir = path.join(root, 'raw');
  const workDir = path.join(root, '.work');
  const sourcesDir = path.join(workDir, 'sources');

  const longPage =
    'Einstein biography details and historical milestones. '.repeat(15);
  const mockFetch = (async () =>
    new Response(
      `<html><head><title>Page</title></head><body><h1>Section</h1><p>${longPage}</p></body></html>`,
      { status: 200, headers: { 'content-type': 'text/html' } },
    )) as unknown as typeof fetch;

  await fetchSource('https://en.wikipedia.org/wiki/Albert_Einstein', {
    sourcesDir,
    fetchImpl: mockFetch,
  });
  await fetchSource('https://example.org/eclipse', {
    sourcesDir,
    fetchImpl: mockFetch,
  });
  await fetchSource('https://example.org/fridge', {
    sourcesDir,
    fetchImpl: mockFetch,
  });

  const draftWithoutModel = sampleEnDraft();
  delete draftWithoutModel.writerModel;
  await writeJsonFile(
    workFile('Q937', 'en.draft.json', workDir),
    draftWithoutModel,
  );
  const checkWithoutModel = sampleCheck();
  delete checkWithoutModel.checkerModel;
  await writeJsonFile(
    workFile('Q937', 'en.check.json', workDir),
    checkWithoutModel,
  );

  await assert.rejects(
    promoteProfile({
      qid: 'Q937',
      locale: 'en',
      subjects: SUBJECTS,
      rawProfilesDir,
      workDir,
      sourcesDir,
    }),
    /Missing writerModel/,
  );

  await assert.rejects(
    promoteProfile({
      qid: 'Q937',
      locale: 'en',
      subjects: SUBJECTS,
      writerModel: 'gpt-6.2-astra',
      rawProfilesDir,
      workDir,
      sourcesDir,
    }),
    /Missing checkerModel/,
  );

  // Patch present + recheck pass records revised: true
  await writeJsonFile(workFile('Q937', 'en.patch.json', workDir), {
    overview: 'Updated **overview**.',
  });
  await writeJsonFile(
    workFile('Q937', 'en.recheck.json', workDir),
    sampleCheck({ checkerModel: 'recheck-self-report' }),
  );

  const promotedRevised = await promoteProfile({
    qid: 'Q937',
    locale: 'en',
    subjects: SUBJECTS,
    writerModel: 'gpt-6.2-astra',
    checkerModel: 'claude-opus-4-6',
    harness: 'claude',
    rawProfilesDir,
    workDir,
    sourcesDir,
  });
  const storedRevised = StoredProfileSchema.parse(
    JSON.parse(await readFile(promotedRevised.filePath, 'utf8')),
  );
  assert.equal(storedRevised.meta.writerModel, 'gpt-6.2-astra');
  assert.equal(storedRevised.meta.checkerModel, 'claude-opus-4-6');
  assert.equal(storedRevised.meta.harness, 'claude');
  assert.equal(storedRevised.meta.approval, 'checker');
  assert.equal(storedRevised.meta.revised, true);

  // Human-approved promote allows omitting checkerModel and records approval: "human"
  const promotedHuman = await promoteProfile({
    qid: 'Q937',
    locale: 'en',
    subjects: SUBJECTS,
    force: true,
    humanApproved: true,
    writerModel: 'gpt-6.2-astra',
    rawProfilesDir,
    workDir,
    sourcesDir,
  });
  const storedHuman = StoredProfileSchema.parse(
    JSON.parse(await readFile(promotedHuman.filePath, 'utf8')),
  );
  assert.equal(storedHuman.meta.approval, 'human');
  assert.equal(storedHuman.meta.checkerModel, undefined);
  assert.equal(storedHuman.meta.revised, true);
});

test('htmlToCleanMarkdown strips Wikipedia boilerplate, internal links, and reference tails', () => {
  const html = `
    <html><head><title>Albert Einstein - Wikipedia</title></head>
    <body>
      <div class="vector-header">Header chrome</div>
      <div class="hatnote">For other uses, see Einstein.</div>
      <h1>Albert Einstein</h1>
      <p>Born in <a href="/wiki/Germany">Germany</a>, a <a href="https://example.org/bio">physicist</a><sup class="reference"><a href="#cite_note-1">[1]</a></sup>.</p>
      <ul><li>Annus Mirabilis papers</li><li>General relativity</li></ul>
      <img src="//upload.wikimedia.org/einstein.jpg" alt="Portrait" />
      <h2>Career<span class="mw-editsection">[edit]</span></h2>
      <p>Developed <a href="/wiki/Relativity">relativity</a>.</p>
      <div class="navbox">Huge navbox table</div>
      <h2>References</h2>
      <div class="reflist"><ol><li>Footnote 1</li></ol></div>
      <h2>External links</h2>
      <p>External list</p>
    </body></html>
  `;

  const wikiMd = htmlToCleanMarkdown(
    html,
    'https://en.wikipedia.org/wiki/Albert_Einstein',
  );
  assert.ok(!wikiMd.includes('Header chrome'));
  assert.ok(!wikiMd.includes('For other uses'));
  assert.ok(!wikiMd.includes('/wiki/Germany'));
  assert.ok(!wikiMd.includes('/wiki/Relativity'));
  assert.ok(!wikiMd.includes('[1]'));
  assert.ok(!wikiMd.includes('upload.wikimedia.org'));
  assert.ok(!wikiMd.includes('Huge navbox table'));
  assert.ok(!wikiMd.includes('## References'));
  assert.ok(!wikiMd.includes('Footnote 1'));
  assert.ok(!wikiMd.includes('External list'));
  assert.ok(
    wikiMd.includes('Born in Germany, a [physicist](https://example.org/bio).'),
  );
  assert.ok(wikiMd.includes('* Annus Mirabilis papers'));
  assert.ok(wikiMd.includes('Developed relativity.'));

  // Non-Wikipedia pages preserve links and sections verbatim.
  const otherMd = htmlToCleanMarkdown(html, 'https://example.org/article');
  assert.ok(otherMd.includes('[Germany](/wiki/Germany)'));
  assert.ok(otherMd.includes('## References'));
});

test('applyProfilePolishPatch applies Russian polish without check verdict and forbids drops', () => {
  const draft = sampleEnDraft();
  const patch = ProfilePatchSchema.parse({
    overview: 'Polished **overview**.',
    connections: { '0': { qid: 'Q9021', reason: 'Polished reason.' } },
  });
  const { draft: merged, patchedPaths } = applyProfilePolishPatch(draft, patch);
  assert.deepEqual(patchedPaths, ['connections.0', 'overview']);
  assert.equal(merged.overview, 'Polished **overview**.');
  assert.equal(merged.connections[0]?.reason, 'Polished reason.');
  assert.deepEqual(merged.keyMoments, draft.keyMoments);
  assert.deepEqual(merged.deepFacts, draft.deepFacts);

  const dropPatch = ProfilePatchSchema.parse({ deepFacts: { '0': null } });
  assert.throws(
    () => applyProfilePolishPatch(draft, dropPatch),
    /cannot drop array item: deepFacts\.0/,
  );
});

test('promoteProfile allows Russian direct polish pass without recheck while enforcing English recheck', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'profiles-ru-polish-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const rawProfilesDir = path.join(root, 'raw');
  const workDir = path.join(root, '.work');
  const sourcesDir = path.join(workDir, 'sources');

  const en = sampleStoredEn();
  const sourceHash = computeEnglishSourceHash(en);
  await writeJsonFile(
    path.join(rawProfilesDir, 'people', 'Q937-albert-einstein.en.json'),
    en,
  );

  // Russian draft + polish patch + passing ru.check.json (no ru.recheck.json) -> promotes with revised: true
  const ruDraft: ProfileDraft = {
    qid: 'Q937',
    subjectDates: '1879–1955',
    sourceHash,
    writerModel: 'test-translator',
    overview: 'Альберт Эйнштейн изменил **современную физику**.',
    keyMoments: [
      {
        date: '1905',
        title: 'Год чудес',
        text: 'Он опубликовал **специальную теорию относительности** в Берне.',
        sourceUrl: en.keyMoments[0]?.sourceUrl,
      },
      {
        date: '1915–1919',
        title: 'Подтверждение затмением',
        text: 'Общая теория прошла проверку во время **затмения 1919 года**.',
        sourceUrl: en.keyMoments[1]?.sourceUrl,
      },
    ],
    deepFacts: [
      {
        text: 'В **1930** году он запатентовал холодильник с Лео Силардом.',
        isLegend: false,
        sourceUrl: en.deepFacts[0]?.sourceUrl,
      },
    ],
    connections: [
      { qid: 'Q9021', reason: 'Планк убедил Эйнштейна переехать в Берлин.' },
    ],
  };
  await writeJsonFile(workFile('Q937', 'ru.draft.json', workDir), ruDraft);
  await writeJsonFile(workFile('Q937', 'ru.patch.json', workDir), {
    overview: 'Альберт Эйнштейн преобразил **современную физику**.',
  });

  // If ru.check.json is `revise` (factual blocker), promote still requires ru.recheck.json
  await writeJsonFile(
    workFile('Q937', 'ru.check.json', workDir),
    sampleCheck({
      locale: 'ru',
      verdict: 'revise',
      blockers: [{ path: 'overview', issue: 'Wrong fact', fix: 'Fix fact' }],
    }),
  );
  await assert.rejects(
    promoteProfile({
      qid: 'Q937',
      locale: 'ru',
      subjects: SUBJECTS,
      rawProfilesDir,
      workDir,
      sourcesDir,
    }),
    /Missing checker verdict: ru\.recheck\.json/,
  );

  // Passing ru.check.json after direct --polish promotes without ru.recheck.json
  await writeJsonFile(
    workFile('Q937', 'ru.check.json', workDir),
    sampleCheck({ locale: 'ru', verdict: 'pass', checkerModel: 'ru-checker' }),
  );
  const promotedRu = await promoteProfile({
    qid: 'Q937',
    locale: 'ru',
    subjects: SUBJECTS,
    rawProfilesDir,
    workDir,
    sourcesDir,
  });
  const storedRu = StoredProfileSchema.parse(
    JSON.parse(await readFile(promotedRu.filePath, 'utf8')),
  );
  assert.equal(storedRu.meta.revised, true);
  assert.equal(storedRu.meta.checkerModel, 'ru-checker');

  // English with patch + passing en.check.json (no en.recheck.json) MUST still be rejected
  const longPage = 'Einstein historical text paragraph. '.repeat(15);
  const mockFetch = (async () =>
    new Response(
      `<html><head><title>Page</title></head><body><h1>Section</h1><p>${longPage}</p></body></html>`,
      { status: 200, headers: { 'content-type': 'text/html' } },
    )) as unknown as typeof fetch;
  await fetchSource('https://en.wikipedia.org/wiki/Albert_Einstein', {
    sourcesDir,
    fetchImpl: mockFetch,
  });
  await fetchSource('https://example.org/eclipse', {
    sourcesDir,
    fetchImpl: mockFetch,
  });
  await fetchSource('https://example.org/fridge', {
    sourcesDir,
    fetchImpl: mockFetch,
  });
  await writeJsonFile(
    workFile('Q937', 'en.draft.json', workDir),
    sampleEnDraft(),
  );
  await writeJsonFile(workFile('Q937', 'en.patch.json', workDir), {
    overview: 'Updated **overview**.',
  });
  await writeJsonFile(
    workFile('Q937', 'en.check.json', workDir),
    sampleCheck({ locale: 'en', verdict: 'pass' }),
  );
  await assert.rejects(
    promoteProfile({
      qid: 'Q937',
      locale: 'en',
      subjects: SUBJECTS,
      force: true,
      rawProfilesDir,
      workDir,
      sourcesDir,
    }),
    /Missing checker verdict: en\.recheck\.json/,
  );
});
