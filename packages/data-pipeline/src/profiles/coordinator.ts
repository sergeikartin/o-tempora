import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  finalizedAssessment,
  readPendingAssessment,
} from './assessed-profile.js';
import { parseModelProfile } from './model-profile.js';
import { RAW_PROFILES_DIR } from './paths.js';
import { readPromptText } from './prompt.js';
import type { Completion } from './providers.js';
import { readStoredProfiles, writeJson } from './store.js';
import { formatDates, loadSubjects } from './subjects.js';
import {
  approvedTranslation,
  loadTranslationSource,
  parseTranslationFields,
  prepareTranslationCorrection,
  readTranslation,
  russianAuditPrompt,
  translateProfile,
  translationFeedback,
  translationPrompt,
} from './translation.js';
import { parseTokenUsage } from './usage.js';
import { asRecord, asString } from './values.js';
import {
  findingExcerpts,
  hash,
  isCurrentVerificationPolicy,
  parseAssessment,
  profileHash,
  strings,
} from './verification/policy.js';
import { englishAuditPrompt } from './verification/researcher.js';
import {
  checkpointEnglishRepair,
  completedRepairs,
  reportPathFor,
  verifyProfile,
} from './verification/runner.js';
import {
  fetchSource,
  parseSourceSnapshot,
  SourceStore,
  sourceUrl,
} from './verification/sources.js';
import {
  type ResolveArticleQids,
  resolveArticleQids,
} from './wikipedia-qids.js';

interface CoordinatorOptions {
  profilesDir: string;
  resolve: ResolveArticleQids;
  fetch: typeof fetchSource;
  emit: (result: unknown) => void;
}

const defaultOptions: CoordinatorOptions = {
  profilesDir: RAW_PROFILES_DIR,
  resolve: resolveArticleQids,
  fetch: fetchSource,
  emit(result) {
    console.log(JSON.stringify(result));
    if (
      result &&
      typeof result === 'object' &&
      'status' in result &&
      (result.status === 'held' || result.status === 'retry')
    )
      process.exitCode = 1;
  },
};

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function readOptionalJson(file: string): Promise<unknown> {
  try {
    return await readJson(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

function sourceId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))
    throw new Error('Invalid evidence snapshot ID');
  return value;
}

async function snapshot(directory: string, id: unknown) {
  const validId = sourceId(id);
  return parseSourceSnapshot(
    await readJson(path.join(directory, `${validId}.json`)),
    validId,
  );
}

async function evidence(
  options: CoordinatorOptions,
  url: string,
  query: string | undefined,
  offset: string | undefined,
  refresh: boolean,
) {
  const normalized = sourceUrl(url).href;
  const directory = path.join(options.profilesDir, 'evidence');
  const cachePath = path.join(directory, 'urls', `${hash(normalized)}.json`);
  const sources = new SourceStore(async () => {
    const cached = refresh ? undefined : await readOptionalJson(cachePath);
    if (cached !== undefined) return snapshot(directory, cached);
    const source = await options.fetch(normalized);
    await writeJson(path.join(directory, `${source.id}.json`), source);
    await writeJson(cachePath, source.id);
    if (source.url !== normalized)
      await writeJson(
        path.join(directory, 'urls', `${hash(source.url)}.json`),
        source.id,
      );
    return source;
  });
  const input = {
    url: normalized,
    query,
    offset: offset === undefined ? undefined : Number(offset),
  };
  options.emit(await sources.readExcerpt(input));
}

async function loadSubject(options: CoordinatorOptions, qid: string) {
  const subject = loadSubjects().find((entry) => entry.qid === qid);
  const entry = (await readStoredProfiles(options.profilesDir)).get(qid);
  if (!subject || !entry)
    throw new Error(`${qid}: no raw Profile or dataset entity`);
  const { filePath } = entry;
  const record = asRecord(await readJson(filePath), 'English Profile');
  return { filePath, subject, record, dates: formatDates(subject.dateSpan) };
}

function task(prompt: string, binding: unknown) {
  return { prompt, input_hash: hash({ prompt, binding }) };
}

function output(
  value: Record<string, unknown>,
  inputHash: string,
): Record<string, unknown> {
  if (value.input_hash !== inputHash)
    throw new Error('Result belongs to different inputs; prepare a fresh task');
  return asRecord(value.result, 'agent result');
}

function completion(
  value: Record<string, unknown>,
  result: unknown,
): Completion {
  return {
    text: JSON.stringify(result),
    model:
      value.model == null
        ? 'agent (model unreported)'
        : asString(value.model, 'model'),
    reasoningEffort:
      value.reasoning_effort == null
        ? null
        : asString(value.reasoning_effort, 'reasoning_effort'),
    tokens: parseTokenUsage(value.tokens),
  };
}

async function englishAudit(
  options: CoordinatorOptions,
  qid: string,
  researchFile?: string,
  resultFile?: string,
) {
  const { filePath, subject, record } = await loadSubject(options, qid);
  const profile = parseModelProfile(record, filePath);
  const pending = readPendingAssessment(record);
  const binding = profileHash(record);
  let input = pending;
  if (researchFile) {
    if (pending)
      throw new Error(
        'Audit the assessment saved with this draft without --research',
      );
    const research = asRecord(await readJson(researchFile), 'research result');
    input = {
      assessment: finalizedAssessment(
        parseAssessment(research.assessment),
        profile,
        research.connection_urls,
      ),
      model: completion(research, null).model,
    };
  } else if (!input) {
    const saved = await readOptionalJson(reportPathFor(filePath));
    if (saved) {
      const report = asRecord(saved, 'verification report');
      if (report.profile_hash === binding)
        input = {
          assessment: parseAssessment(report.assessment),
          model: strings(report.models, 'report models')[0] ?? 'unreported',
        };
    }
  }
  if (!input)
    throw new Error(
      'No saved assessment for this draft. Use --research to supply an assessment file.',
    );
  const { assessment, model } = input;
  const ids = new Set(
    assessment.findings.flatMap((finding) =>
      findingExcerpts(finding).map(({ source }) => source),
    ),
  );
  const directory = path.join(options.profilesDir, 'evidence');
  const snapshots = await Promise.all(
    [...ids].map((id) => snapshot(directory, id)),
  );
  if (!resultFile) {
    options.emit(
      task(
        englishAuditPrompt(profile, subject, assessment, snapshots),
        binding,
      ),
    );
    return;
  }
  const audit = asRecord(await readJson(resultFile), 'English audit');
  output(
    audit,
    task(englishAuditPrompt(profile, subject, assessment, snapshots), binding)
      .input_hash,
  );
  options.emit(
    await verifyProfile({
      filePath,
      subject,
      sources: new SourceStore(undefined, snapshots),
      resolve: options.resolve,
      expectedRecordHash: hash(record),
      research: async () => ({ assessment, model }),
      complete: async (prompt) =>
        completion(audit, output(audit, task(prompt, binding).input_hash)),
      repairs: completedRepairs(record),
      repair: false,
    }),
  );
}

async function englishRepair(
  options: CoordinatorOptions,
  qid: string,
  resultFile?: string,
) {
  const { filePath, subject, record, dates } = await loadSubject(options, qid);
  if (readPendingAssessment(record))
    throw new Error(
      'Audit the pending assessment before preparing another repair',
    );
  const report = asRecord(
    await readJson(reportPathFor(filePath)),
    'verification report',
  );
  const subjectInfo = asRecord(report.subject, 'report subject');
  if (
    !isCurrentVerificationPolicy(report.policy_version, dates) ||
    report.profile_hash !== profileHash(record) ||
    subjectInfo.qid !== qid ||
    subjectInfo.dates !== dates ||
    !strings(report.blockers, 'blockers').length
  )
    throw new Error(
      'English repair requires a current held verification report',
    );
  const prepared = task(
    readPromptText('profile-assessment.md') +
      readPromptText('profile-assessment-repair.md') +
      JSON.stringify({
        profile: parseModelProfile(record, filePath),
        report,
        remaining_draft_repairs: 2 - completedRepairs(record),
      }),
    hash(record),
  );
  if (!resultFile) {
    options.emit(prepared);
    return;
  }
  const reply = asRecord(await readJson(resultFile), 'English repair');
  const result = output(reply, prepared.input_hash);
  options.emit(
    await checkpointEnglishRepair({
      filePath,
      subject,
      record,
      report,
      result,
      model: completion(reply, result).model,
      resolve: options.resolve,
    }),
  );
}

async function russianTranslation(options: CoordinatorOptions, qid: string) {
  const { filePath, dates } = await loadSubject(options, qid);
  const raw = await loadTranslationSource(filePath, dates);
  if (approvedTranslation(await readTranslation(filePath), raw)) {
    options.emit({ status: 'skipped' });
    return;
  }
  const feedback = await translationFeedback(filePath, raw);
  const correction = prepareTranslationCorrection(raw, feedback);
  options.emit(
    task(
      correction?.prompt ?? translationPrompt(raw, feedback),
      profileHash(raw),
    ),
  );
}

async function russianAudit(
  options: CoordinatorOptions,
  qid: string,
  candidateFile: string,
  resultFile?: string,
) {
  const { filePath, dates } = await loadSubject(options, qid);
  const raw = await loadTranslationSource(filePath, dates);
  const binding = profileHash(raw);
  const candidate = asRecord(
    await readJson(candidateFile),
    'Russian candidate',
  );
  const feedback = await translationFeedback(filePath, raw);
  const translationTask = task(translationPrompt(raw, feedback), binding);
  const correction = prepareTranslationCorrection(raw, feedback);
  let proposedFields: unknown;
  if (correction && candidate.input_hash !== translationTask.input_hash) {
    const reply = output(
      candidate,
      task(correction.prompt, binding).input_hash,
    );
    const replacements = asRecord(reply.fields, 'replacement fields');
    const paths = Object.keys(replacements);
    if (
      paths.length !== correction.paths.size ||
      paths.some((path) => !correction.paths.has(path))
    )
      throw new Error('Supply replacements for exactly the flagged fields');
    proposedFields = { ...correction.fields, ...replacements };
  } else {
    proposedFields = output(candidate, translationTask.input_hash).fields;
  }
  const fields = parseTranslationFields(proposedFields, raw);
  const prepared = task(russianAuditPrompt(raw, fields), binding);
  if (!resultFile) {
    options.emit(prepared);
    return;
  }
  const audit = asRecord(await readJson(resultFile), 'Russian audit');
  output(audit, prepared.input_hash);
  options.emit(
    await translateProfile({
      filePath,
      dates,
      retry: false,
      complete: async (prompt, role) => {
        const inputHash = task(prompt, binding).input_hash;
        if (role === 'translate') {
          if (inputHash !== translationTask.input_hash)
            throw new Error('Translation inputs changed; prepare a fresh task');
          return completion(candidate, { fields });
        }
        return completion(audit, output(audit, inputHash));
      },
    }),
  );
}

export async function runCoordinatorCommand(
  command: string | undefined,
  argv: readonly string[],
  options: CoordinatorOptions = defaultOptions,
): Promise<boolean> {
  const allowed: Record<string, string[]> = {
    evidence: ['url', 'query', 'offset', 'refresh'],
    'english-audit': ['qid', 'research', 'result'],
    'english-repair': ['qid', 'result'],
    'russian-translation': ['qid'],
    'russian-audit': ['qid', 'candidate', 'result'],
  };
  if (!command || !Object.hasOwn(allowed, command)) return false;
  const flags = new Map<string, string>();
  for (const arg of argv) {
    const match = /^--([a-z]+)(?:=(.+))?$/.exec(arg);
    const name = match?.[1];
    const value = match?.[2];
    if (
      !name ||
      !allowed[command]?.includes(name) ||
      flags.has(name) ||
      (name === 'refresh' ? value !== undefined : value === undefined)
    )
      throw new Error(`Invalid ${command} argument: ${arg}`);
    flags.set(name, value ?? '');
  }
  const required = (name: string) => asString(flags.get(name), `--${name}`);
  if (command === 'evidence') {
    await evidence(
      options,
      required('url'),
      flags.get('query'),
      flags.get('offset'),
      flags.has('refresh'),
    );
  } else {
    const qid = required('qid');
    const result = flags.get('result');
    if (command === 'english-audit')
      await englishAudit(options, qid, flags.get('research'), result);
    else if (command === 'english-repair')
      await englishRepair(options, qid, result);
    else if (command === 'russian-translation')
      await russianTranslation(options, qid);
    else await russianAudit(options, qid, required('candidate'), result);
  }
  return true;
}
