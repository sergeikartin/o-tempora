import { readFile, rename, writeFile } from 'node:fs/promises';
import { assertBoldOnlyMarkup } from './markup.js';
import { parseModelProfile } from './model-profile.js';
import { passages } from './passages.js';
import { readPromptText } from './prompt.js';
import type { Complete, Completion } from './providers.js';
import { asRecord, asString } from './values.js';
import {
  hash,
  parseAudit,
  profileHash,
  readProfileApproval,
  strings,
} from './verification/policy.js';

export const TRANSLATION_POLICY_VERSION = '1';
export type TranslationFields = Record<string, string>;

export interface Translation {
  policy_version: string;
  qid: string;
  source_hash: string;
  locale: 'ru';
  fields: TranslationFields;
  audit: ReturnType<typeof parseAudit> & { covered: string[] };
  generated_at: string;
  models: Omit<Completion, 'text'>[];
  approval_hash: string;
}

export function translationPath(file: string): string {
  if (!file.endsWith('.en.json'))
    throw new Error('Translation requires an English raw Profile');
  return file.replace(/\.en\.json$/, '.ru.translation.json');
}

// Translate only reader-facing prose. Structure, evidence URLs, QIDs and
// historical-review metadata remain owned by the approved English Profile.
export function translationPassages(raw: unknown) {
  return passages(parseModelProfile(raw, 'translation source'));
}

export function parseTranslationFields(
  value: unknown,
  source: unknown,
): TranslationFields {
  const fields = asRecord(value, 'translation fields');
  const expected = translationPassages(source);
  if (
    Object.keys(fields).length !== expected.length ||
    expected.some(({ path }) => !(path in fields))
  )
    throw new Error(
      'Translation must include every visible field exactly once',
    );
  return Object.fromEntries(
    expected.map(({ path, text }) => {
      const translated = asString(fields[path], path);
      assertBoldOnlyMarkup(translated, path);
      if (
        hash(text.match(/\d+/g) ?? []) !== hash(translated.match(/\d+/g) ?? [])
      )
        throw new Error(`${path}: translation changed numeric values`);
      if (text.split('**').length !== translated.split('**').length)
        throw new Error(`${path}: translation changed bold emphasis`);
      if (
        (path === 'overview' ||
          path.endsWith('.text') ||
          path.endsWith('.connection')) &&
        !/\p{Script=Cyrillic}/u.test(translated)
      )
        throw new Error(`${path}: expected Russian prose`);
      return [path, translated];
    }),
  );
}

function translationBlockers(
  translation: Pick<Translation, 'audit' | 'fields'>,
): string[] {
  const { audit, fields } = translation;
  return [
    ...audit.uncovered,
    ...audit.issues,
    ...(!audit.coherent ? ['Translation is not coherent'] : []),
    ...(hash([...audit.covered].sort()) !== hash(Object.keys(fields).sort())
      ? ['Translation audit must cover every field exactly once']
      : []),
  ];
}

export function approvedTranslation(
  value: unknown,
  source: unknown,
): TranslationFields | undefined {
  try {
    const { approval_hash, ...record } = asRecord(value, 'translation');
    const meta = asRecord(asRecord(source, 'source').meta, 'meta');
    if (
      record.policy_version !== TRANSLATION_POLICY_VERSION ||
      record.locale !== 'ru' ||
      record.qid !== asRecord(meta.source, 'source').wikidata_qid ||
      record.source_hash !== profileHash(source) ||
      approval_hash !== hash(record)
    )
      return undefined;
    const fields = parseTranslationFields(record.fields, source);
    const auditRoot = asRecord(record.audit, 'translation audit');
    const audit = {
      ...parseAudit(auditRoot),
      covered: strings(auditRoot.covered, 'covered'),
    };
    return translationBlockers({ fields, audit }).length === 0
      ? fields
      : undefined;
  } catch {
    return undefined;
  }
}

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code === 'ENOENT' ||
      error instanceof SyntaxError
    )
      return undefined;
    throw error;
  }
}

export async function readTranslation(file: string): Promise<unknown> {
  return readJson(translationPath(file));
}

export function translationPrompt(raw: unknown, feedback?: unknown): string {
  return readPromptText('profile-translation.md')
    .slice(0, -1)
    .replace(/\{passages\}|^.+\{feedback\}$/gm, (match) => {
      if (match === '{passages}')
        return JSON.stringify(translationPassages(raw));
      return feedback
        ? match.replace('{feedback}', () => JSON.stringify(feedback))
        : '';
    });
}

export function russianAuditPrompt(
  raw: unknown,
  fields: TranslationFields,
): string {
  return readPromptText('profile-translation-audit.md')
    .slice(0, -1)
    .replace(/\{english\}|\{russian\}/g, (placeholder) =>
      JSON.stringify(
        placeholder === '{english}' ? translationPassages(raw) : fields,
      ),
    );
}

function parseRussianAudit(value: unknown): Translation['audit'] {
  const audit = asRecord(value, 'translation audit');
  return { ...parseAudit(audit), covered: strings(audit.covered, 'covered') };
}

async function translationAttempt(
  raw: unknown,
  complete: Complete,
  feedback?: unknown,
) {
  const completion = await complete(
    translationPrompt(raw, feedback),
    'translate',
  );
  const fields = parseTranslationFields(
    asRecord(JSON.parse(completion.text), 'translation').fields,
    raw,
  );
  const auditCompletion = await complete(
    russianAuditPrompt(raw, fields),
    'translation-audit',
  );
  const audit = parseRussianAudit(JSON.parse(auditCompletion.text));
  return {
    fields,
    audit,
    models: [completion, auditCompletion].map(
      ({ text: _text, ...metadata }) => metadata,
    ),
  };
}

export async function loadTranslationSource(
  filePath: string,
  dates: string,
): Promise<unknown> {
  const raw: unknown = JSON.parse(await readFile(filePath, 'utf8'));
  const report = JSON.parse(
    await readFile(filePath.replace(/\.json$/, '.verification.json'), 'utf8'),
  );
  const profile = parseModelProfile(raw, 'translation source');
  if (!readProfileApproval(raw, report, profile)?.isCurrentFor(dates))
    throw new Error(
      'Translation requires a current approved English Profile and dataset dates',
    );
  return raw;
}

export async function translationFeedback(
  filePath: string,
  raw: unknown,
): Promise<{ fields: unknown; audit: unknown } | undefined> {
  const prior = await readJson(
    translationPath(filePath).replace(/\.json$/, '.held.json'),
  );
  if (prior && typeof prior === 'object' && !Array.isArray(prior)) {
    const previous = asRecord(prior, 'previous translation');
    if (
      previous.source_hash === profileHash(raw) &&
      previous.policy_version === TRANSLATION_POLICY_VERSION
    )
      return { fields: previous.fields, audit: previous.audit };
  }
}

export function prepareTranslationCorrection(
  raw: unknown,
  feedback: Awaited<ReturnType<typeof translationFeedback>>,
) {
  if (!feedback) return;
  const fields = parseTranslationFields(feedback.fields, raw);
  const audit = parseRussianAudit(feedback.audit);
  if (!audit.coherent) return;

  const paths = new Set<string>();
  for (const finding of [...audit.uncovered, ...audit.issues]) {
    const path = finding.split(':', 1)[0]?.trim();
    if (!path || !Object.hasOwn(fields, path)) return;
    paths.add(path);
  }
  if (!paths.size) return;
  const prompt =
    readPromptText('profile-translation-repair.md') +
    JSON.stringify({
      english: translationPassages(raw),
      fields,
      audit,
      paths: [...paths],
    });
  return { prompt, fields, paths };
}

export async function translateProfile(options: {
  filePath: string;
  dates: string;
  complete: Complete;
  force?: boolean;
  retry?: boolean;
}): Promise<{
  status: 'approved' | 'skipped' | 'held';
  filePath: string;
  blockers: string[];
}> {
  const raw = await loadTranslationSource(options.filePath, options.dates);
  const filePath = translationPath(options.filePath);
  if (
    !options.force &&
    approvedTranslation(await readTranslation(options.filePath), raw)
  )
    return { status: 'skipped', filePath, blockers: [] };

  const feedback = await translationFeedback(options.filePath, raw);
  const models: Omit<Completion, 'text'>[] = [];
  const attempts: { fields_hash: string; audit: Translation['audit'] }[] = [];
  let candidate = await translationAttempt(raw, options.complete, feedback);
  models.push(...candidate.models);
  attempts.push({
    fields_hash: hash(candidate.fields),
    audit: candidate.audit,
  });
  if (options.retry !== false && translationBlockers(candidate).length) {
    candidate = await translationAttempt(raw, options.complete, {
      fields: candidate.fields,
      audit: candidate.audit,
    });
    models.push(...candidate.models);
    attempts.push({
      fields_hash: hash(candidate.fields),
      audit: candidate.audit,
    });
  }
  if (
    profileHash(
      await loadTranslationSource(options.filePath, options.dates),
    ) !== profileHash(raw)
  )
    throw new Error(
      'English Profile changed during translation; prepare a new candidate',
    );
  const { fields, audit } = candidate;
  const blockers = translationBlockers(candidate);
  const record = {
    policy_version: TRANSLATION_POLICY_VERSION,
    qid: asString(
      asRecord(asRecord(asRecord(raw, 'Profile').meta, 'meta').source, 'source')
        .wikidata_qid,
      'qid',
    ),
    source_hash: profileHash(raw),
    locale: 'ru' as const,
    fields,
    audit,
    generated_at: new Date().toISOString(),
    models,
    attempts,
  };
  // A pending/held candidate is retained for diagnosis without replacing a
  // previously approved translation of the same source.
  const destination = blockers.length
    ? filePath.replace(/\.json$/, '.held.json')
    : filePath;
  const temporary = `${destination}.tmp`;
  await writeFile(
    temporary,
    `${JSON.stringify({ ...record, approval_hash: blockers.length ? null : hash(record) }, null, 2)}\n`,
  );
  await rename(temporary, destination);
  return {
    status: blockers.length ? 'held' : 'approved',
    filePath: destination,
    blockers,
  };
}
