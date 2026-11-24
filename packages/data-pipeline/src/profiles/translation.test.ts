import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type TestContext, test } from 'node:test';
import {
  readRawProfiles,
  shipProfiles,
  writeProfiles,
} from '../output/profiles.js';
import { passages } from './passages.js';
import { readPromptText } from './prompt.js';
import type { Complete } from './providers.js';
import type { ProfileSubject } from './subjects.js';
import {
  approvedTranslation,
  buildRussianGlossary,
  parseTranslationFields,
  prepareTranslationCorrection,
  readTranslation,
  russianAuditPrompt,
  translateProfile,
  translationPassages,
  translationPath,
  translationPrompt,
} from './translation.js';
import { asArray, asRecord } from './values.js';
import { hash } from './verification/policy.js';
import { verifyProfile } from './verification/runner.js';
import { SourceStore } from './verification/sources.js';

const URL = 'https://en.wikipedia.org/wiki/Isaac_Newton';
const raw = () => ({
  subject: 'Isaac Newton',
  type: 'person',
  wikipedia_url: URL,
  overview: 'Newton was an **English** mathematician.',
  key_moments: [
    {
      date: '1661',
      title: 'Cambridge',
      text: 'He began studying at Cambridge in 1661.',
      claims: ['Enrollment.'],
      source: URL,
    },
    {
      date: '1687',
      title: 'The Principia',
      text: 'He published it in 1687.',
      claims: ['Publication.'],
      source: URL,
    },
  ],
  deep_facts: [
    {
      text: 'An attributed legend.',
      type: 'hidden_story',
      is_legend: true,
      confidence: 'medium',
      claims: ['Legend.'],
      source: URL,
    },
  ],
  connections: [
    {
      name: 'Leibniz',
      wikipedia_url: 'https://en.wikipedia.org/wiki/Gottfried_Wilhelm_Leibniz',
      qid: 'Q9047',
      connection: 'They developed calculus independently.',
      importance: 'high',
    },
  ],
  meta: {
    locale: 'en',
    source: { wikidata_qid: 'Q935' },
    review: { status: 'draft', reviewed_at: null },
  },
});
const SUBJECT: ProfileSubject = {
  qid: 'Q935',
  lane: 'people',
  name: 'Isaac Newton',
  dateSpan: { startYear: 1643, endYear: 1727 },
  wikipediaUrl: URL,
  ru: {
    name: 'Исаак Ньютон',
    tagline: 'математик',
    description: `Первое предложение. ${'Продолжение '.repeat(50)}`,
  },
};
const LEIBNIZ: ProfileSubject = {
  ...SUBJECT,
  qid: 'Q9047',
  name: 'Gottfried Wilhelm Leibniz',
  ru: { name: 'Готфрид Вильгельм Лейбниц' },
};
const SUBJECTS = new Map([
  [SUBJECT.qid, SUBJECT],
  [LEIBNIZ.qid, LEIBNIZ],
]);
const fields = {
  overview: 'Ньютон был **английским** математиком.',
  'key_moments.0.date': '1661',
  'key_moments.0.title': 'Кембридж',
  'key_moments.0.text': 'В 1661 году он начал учиться в Кембридже.',
  'key_moments.1.date': '1687',
  'key_moments.1.title': '«Начала»',
  'key_moments.1.text': 'Он опубликовал их в 1687 году.',
  'deep_facts.0.text': 'Легенда, приписываемая автору.',
  'connections.0.connection':
    'Они независимо разработали математический анализ.',
};
const audit = {
  covered: Object.keys(fields),
  uncovered: [],
  issues: [],
  coherent: true,
};
const complete: Complete = async (_prompt, role) => ({
  text: JSON.stringify(role === 'translate' ? { fields } : audit),
  model: role === 'translate' ? 'translator' : 'auditor',
  tokens: null,
});

async function fixture(t: TestContext) {
  const root = await mkdtemp(path.join(tmpdir(), 'profile-translation-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const filePath = path.join(root, 'people', 'Q935-newton.en.json');
  await mkdir(path.dirname(filePath));
  await writeFile(filePath, JSON.stringify(raw()));
  const result = await verifyProfile({
    filePath,
    repair: false,
    adversarialDisabled: true,
    subject: {
      qid: 'Q935',
      name: 'Isaac Newton',
      lane: 'people',
      dateSpan: { startYear: 1643, endYear: 1727 },
      wikipediaUrl: URL,
    },
    research: async (profile, _subject, sources) => {
      const source = await sources.read(URL);
      return {
        model: 'researcher',
        assessment: {
          ...audit,
          covered: passages(profile).map(({ path }) => path),
          subject_dates: [],
          findings: passages(profile).map(({ path, text }) => ({
            path,
            claim: text,
            verdict: 'supported',
            risk: 'ordinary',
            explanation: 'Fixture evidence.',
            correction: '',
            evidence: [
              {
                source: source.id,
                quote: source.text,
                kind: 'primary',
                origin: 'fixture',
              },
            ],
          })),
        },
      };
    },
    complete: async () => ({
      text: JSON.stringify({ uncovered: [], issues: [], coherent: true }),
      model: 'audit',
      tokens: null,
    }),
    resolve: async (urls) =>
      new Map(urls.map((url) => [url, url === URL ? 'Q935' : 'Q9047'])),
    sources: new SourceStore(async () => ({
      id: hash('fixture'),
      url: URL,
      text: 'fixture',
      fetched_at: '2026-11-17T00:00:00Z',
    })),
  });
  assert.equal(result.status, 'approved');
  return { root, filePath, dates: '1643–1727', complete };
}

test('Russian glossary deduplicates Connections and bounds the subject lead', () => {
  const english = raw();
  english.connections.push(...english.connections.map((item) => ({ ...item })));
  const expected = {
    subject: {
      en: SUBJECT.name,
      ru: SUBJECT.ru?.name,
      tagline_ru: 'математик',
      lead_ru: 'Первое предложение.',
    },
    connections: [{ en: LEIBNIZ.name, ru: LEIBNIZ.ru?.name }],
  };
  assert.deepEqual(buildRussianGlossary(english, SUBJECTS), expected);
  assert.deepEqual(
    buildRussianGlossary(english, new Map([[LEIBNIZ.qid, LEIBNIZ]])),
    { connections: expected.connections },
  );
  assert.equal(buildRussianGlossary(english, new Map()), undefined);
  const longer = new Map(SUBJECTS);
  longer.set(SUBJECT.qid, {
    ...SUBJECT,
    ru: { name: 'Исаак Ньютон', description: 'Продолжение '.repeat(50) },
  });
  const lead = buildRussianGlossary(english, longer)?.subject?.lead_ru;
  assert.ok(lead && lead.length <= 500 && lead.endsWith('Продолжение'));
});

test('Russian translation, repair and audit append glossary and feedback after the fixed instructions', () => {
  const english = raw();
  const other = { ...english, overview: 'A different Profile.' };
  const glossary = buildRussianGlossary(english, SUBJECTS);
  assert.ok(glossary);
  const feedback = {
    fields,
    audit: { ...audit, issues: ['overview: check the name'] },
  };
  const variants = [
    [
      'profile-translation.md',
      translationPrompt(english, feedback, glossary),
      translationPrompt(other),
    ],
    [
      'profile-translation-audit.md',
      russianAuditPrompt(english, fields, glossary),
      russianAuditPrompt(other, fields),
    ],
    [
      'profile-translation-repair.md',
      prepareTranslationCorrection(english, feedback, glossary)?.prompt,
      prepareTranslationCorrection(english, feedback)?.prompt,
    ],
  ];
  for (const [filename, withGlossary, withoutGlossary] of variants) {
    assert.ok(filename && withGlossary && withoutGlossary);
    const prefix = readPromptText(filename);
    assert.equal(withGlossary.slice(0, prefix.length), prefix);
    assert.equal(withoutGlossary.slice(0, prefix.length), prefix);
    assert.deepEqual(
      JSON.parse(withGlossary.slice(prefix.length)).glossary,
      glossary,
    );
    assert.equal(
      JSON.parse(withoutGlossary.slice(prefix.length)).glossary,
      undefined,
    );
  }
});

test('translation validates coverage, numeric dates, markup, emphasis and Russian prose', () => {
  assert.deepEqual(parseTranslationFields(fields, raw()), fields);
  for (const invalid of [
    { ...fields, 'key_moments.0.date': '1688' },
    { ...fields, overview: 'Ньютон — математик.' },
    { ...fields, overview: 'An **English** mathematician.' },
    { ...fields, 'key_moments.0.title': '<i>Начала</i>' },
    { ...fields, extra: 'лишнее' },
  ])
    assert.throws(() => parseTranslationFields(invalid, raw()));
  const { overview: _overview, ...missing } = fields;
  assert.throws(
    () => parseTranslationFields(missing, raw()),
    /every visible field/,
  );
});

test('approved translation publishes Russian prose and names while preserving structure and sources', async (t) => {
  const options = await fixture(t);
  const roles: string[] = [];
  assert.equal(
    (
      await translateProfile({
        ...options,
        complete: (prompt, role) => {
          roles.push(role ?? '');
          return complete(prompt, role);
        },
      })
    ).status,
    'approved',
  );
  assert.deepEqual(roles, ['translate', 'translation-audit']);
  const rawProfiles = await readRawProfiles(options.root);
  assert.equal(rawProfiles.length, 1);
  const targets = [
    {
      qid: 'Q935',
      name: 'Isaac Newton',
      nameRu: 'Исаак Ньютон',
      slug: 'newton',
      lane: 'people' as const,
      dates: options.dates,
      fameScore: 99,
    },
    {
      qid: 'Q9047',
      name: 'Leibniz',
      nameRu: 'Готфрид Лейбниц',
      slug: 'leibniz',
      lane: 'people' as const,
      dates: '1646–1716',
      fameScore: 90,
    },
  ];
  const en = shipProfiles(rawProfiles, targets);
  const ru = shipProfiles(rawProfiles, targets, 'ru');
  const translated = ru.get('newton');
  assert.equal(translated?.overview, fields.overview);
  assert.equal(translated?.connections[0]?.name, 'Готфрид Лейбниц');
  assert.equal(translated?.connections[0]?.slug, 'leibniz');
  assert.equal(
    translated?.connections[0]?.reason,
    fields['connections.0.connection'],
  );
  assert.deepEqual(translated?.keyMoments, [
    {
      date: fields['key_moments.0.date'],
      title: fields['key_moments.0.title'],
      text: fields['key_moments.0.text'],
      sourceUrl: URL,
    },
    {
      date: fields['key_moments.1.date'],
      title: fields['key_moments.1.title'],
      text: fields['key_moments.1.text'],
      sourceUrl: URL,
    },
  ]);
  assert.deepEqual(translated?.deepFacts, [
    { text: fields['deep_facts.0.text'], sourceUrl: URL, isLegend: true },
  ]);
  assert.equal(en.get('newton')?.overview, raw().overview);
  await writeProfiles(options.root, en, ru);
  assert.deepEqual(
    JSON.parse(
      await readFile(
        path.join(options.root, 'profiles/ru/newton.json'),
        'utf8',
      ),
    ),
    translated,
  );
});

test('current translations skip model calls; changed English, identity, policy or translated text revokes approval', async (t) => {
  const options = await fixture(t);
  await translateProfile(options);
  assert.equal(
    (
      await translateProfile({
        ...options,
        subjectsByQid: SUBJECTS,
        complete: async () => {
          throw new Error('must skip');
        },
      })
    ).status,
    'skipped',
  );
  const source = JSON.parse(await readFile(options.filePath, 'utf8'));
  const translation = await readTranslation(options.filePath);
  assert.deepEqual(approvedTranslation(translation, source), fields);
  assert.equal(
    approvedTranslation(translation, {
      ...source,
      overview: 'Changed English.',
    }),
    undefined,
  );
  for (const change of [
    { qid: 'Q1' },
    { policy_version: 'old' },
    { fields: { ...fields, overview: 'Другое.' } },
  ]) {
    assert.equal(
      approvedTranslation(
        { ...asRecord(translation, 'translation'), ...change },
        source,
      ),
      undefined,
    );
  }
  source.overview = 'Changed English.';
  await writeFile(options.filePath, JSON.stringify(source));
  await assert.rejects(translateProfile(options), /current approved English/);
});

test('audit failures and incomplete/duplicate coverage cannot publish', async (t) => {
  const options = await fixture(t);
  for (const badAudit of [
    { ...audit, issues: ['overview: meaning changed'] },
    { ...audit, covered: audit.covered.slice(1) },
    { ...audit, covered: [...audit.covered, 'overview'] },
    { ...audit, coherent: false },
  ]) {
    const result = await translateProfile({
      ...options,
      complete: async (prompt, role) =>
        role === 'translate'
          ? complete(prompt, role)
          : { text: JSON.stringify(badAudit), model: 'auditor', tokens: null },
    });
    assert.equal(result.status, 'held');
    assert.ok(result.blockers.length);
    assert.equal(await readTranslation(options.filePath), undefined);
    assert.equal(
      shipProfiles(
        await readRawProfiles(options.root),
        [
          {
            qid: 'Q935',
            name: 'Newton',
            slug: 'newton',
            lane: 'people',
            dates: options.dates,
            fameScore: 99,
          },
        ],
        'ru',
      ).size,
      0,
    );
  }
});

test('translation rejects unapproved English and changed dataset dates before model calls', async (t) => {
  const options = await fixture(t);
  const noCall: Complete = async () => {
    throw new Error('must not call');
  };
  await assert.rejects(
    translateProfile({ ...options, dates: '1643–1726', complete: noCall }),
    /current approved English/,
  );
  const source = raw();
  await writeFile(options.filePath, JSON.stringify(source));
  await assert.rejects(
    translateProfile({ ...options, complete: noCall }),
    /current approved English/,
  );
});

test('a rejected forced retranslation preserves the current approved translation', async (t) => {
  const options = await fixture(t);
  await translateProfile(options);
  const before = await readFile(translationPath(options.filePath), 'utf8');
  const result = await translateProfile({
    ...options,
    force: true,
    complete: async (prompt, role) =>
      role === 'translate'
        ? complete(prompt, role)
        : {
            text: JSON.stringify({ ...audit, issues: ['Bad translation.'] }),
            model: 'auditor',
            tokens: null,
          },
  });
  assert.equal(result.status, 'held');
  assert.equal(
    await readFile(translationPath(options.filePath), 'utf8'),
    before,
  );
  assert.equal(translationPassages(raw()).length, Object.keys(fields).length);
});

test('audit feedback gets one correction attempt followed by a new complete audit', async (t) => {
  const options = await fixture(t);
  const roles: string[] = [];
  let audits = 0;
  const result = await translateProfile({
    ...options,
    subjectsByQid: SUBJECTS,
    complete: async (prompt, role) => {
      roles.push(role ?? '');
      assert.match(prompt, /Исаак Ньютон/);
      if (role === 'translation-audit' && ++audits === 1)
        return {
          text: JSON.stringify({
            ...audit,
            issues: ['overview: qualification strengthened'],
          }),
          model: 'auditor',
          tokens: null,
        };
      if (roles.length === 3)
        assert.match(prompt, /qualification strengthened/);
      return complete(prompt, role);
    },
  });
  assert.equal(result.status, 'approved');
  assert.deepEqual(roles, [
    'translate',
    'translation-audit',
    'translate',
    'translation-audit',
  ]);
  const record = asRecord(
    await readTranslation(options.filePath),
    'translation',
  );
  assert.equal(asArray(record.models, 'models').length, 4);
  assert.equal(asArray(record.attempts, 'attempts').length, 2);
});
