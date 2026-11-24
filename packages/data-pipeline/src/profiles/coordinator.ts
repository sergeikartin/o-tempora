import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseQidsFlag } from '../fetch/qid-filter.js';
import {
  finalizedAssessment,
  readPendingAssessment,
} from './assessed-profile.js';
import { evidenceStore, readSnapshot } from './evidence-cache.js';
import { parseModelProfile } from './model-profile.js';
import { RAW_PROFILES_DIR } from './paths.js';
import { prefetchSubject } from './prefetch.js';
import { preflightProfile } from './preflight.js';
import { readPromptText } from './prompt.js';
import type { Completion } from './providers.js';
import { readStoredProfiles, writeJson } from './store.js';
import { formatDates, loadSubjects } from './subjects.js';
import {
  approvedTranslation,
  buildRussianGlossary,
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
  type AdversarialResult,
  adversarialPrompt,
  mergeAdversarialResult,
  parseAdversarialResult,
  selectAdversarialTargets,
} from './verification/adversarial.js';
import {
  type Assessment,
  checkEvidence,
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
import { fetchSource, SourceStore } from './verification/sources.js';
import {
  type ResolveArticleQids,
  resolveArticleQids,
} from './wikipedia-qids.js';

interface CoordinatorOptions {
  profilesDir: string;
  resolve: ResolveArticleQids;
  fetch: typeof fetchSource;
  emit: (result: unknown) => void;
  subjects?: typeof loadSubjects;
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
      (('status' in result &&
        (result.status === 'held' || result.status === 'retry')) ||
        ('ok' in result && result.ok === false))
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

async function loadSubject(options: CoordinatorOptions, qid: string) {
  const subjects = new Map(
    (options.subjects ?? loadSubjects)().map((entry) => [entry.qid, entry]),
  );
  const subject = subjects.get(qid);
  const entry = (await readStoredProfiles(options.profilesDir)).get(qid);
  if (!subject || !entry)
    throw new Error(`${qid}: no raw Profile or dataset entity`);
  const { filePath } = entry;
  const record = asRecord(await readJson(filePath), 'English Profile');
  return {
    filePath,
    subject,
    subjects,
    record,
    dates: formatDates(subject.dateSpan),
  };
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

async function loadEnglishAssessment(
  options: CoordinatorOptions,
  qid: string,
  researchFile?: string,
) {
  const { filePath, subject, record } = await loadSubject(options, qid);
  const profile = parseModelProfile(record, filePath);
  const pending = readPendingAssessment(record);
  const binding = profileHash(record);
  let input = pending;
  let savedAdversarial: unknown;
  if (researchFile) {
    if (pending)
      throw new Error(
        'Use the assessment saved with this draft without --research',
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
      if (report.profile_hash === binding) {
        savedAdversarial = report.adversarial;
        input = {
          assessment: parseAssessment(report.assessment),
          model: strings(report.models, 'report models')[0] ?? 'unreported',
        };
      }
    }
  }
  if (!input)
    throw new Error(
      'No saved assessment for this draft. Use --research to supply an assessment file.',
    );
  return { filePath, subject, profile, record, ...input, savedAdversarial };
}

function assessmentSnapshots(
  options: CoordinatorOptions,
  assessment: Assessment,
) {
  const ids = new Set(
    assessment.findings.flatMap((finding) =>
      findingExcerpts(finding).map(({ source }) => source),
    ),
  );
  const directory = path.join(options.profilesDir, 'evidence');
  return Promise.all([...ids].map((id) => readSnapshot(directory, id)));
}

async function englishAdversarial(
  options: CoordinatorOptions,
  qid: string,
  researchFile?: string,
  resultFile?: string,
) {
  const { filePath, subject, profile, record, assessment } =
    await loadEnglishAssessment(options, qid, researchFile);
  const targets = selectAdversarialTargets(profile, assessment);
  if (!targets.length) {
    if (resultFile)
      throw new Error(
        'Result belongs to different inputs; prepare a fresh task',
      );
    options.emit({ status: 'skipped', targets: 0 });
    return;
  }
  const binding = {
    profile_hash: profileHash(record),
    assessment_hash: hash(assessment),
  };
  const prepared = task(
    adversarialPrompt(
      profile,
      subject,
      assessment,
      targets,
      await assessmentSnapshots(options, assessment),
    ),
    binding,
  );
  if (!resultFile) {
    options.emit({ ...prepared, targets });
    return;
  }

  const reply = asRecord(
    await readJson(resultFile),
    'English adversarial result',
  );
  const checks = parseAdversarialResult(
    output(reply, prepared.input_hash),
    targets,
  );
  const directory = path.join(options.profilesDir, 'evidence');
  const ids = new Set(
    checks.flatMap((check) =>
      check.counterevidence.map(({ source }) => source),
    ),
  );
  const snapshots = await Promise.all(
    [...ids].map((id) => readSnapshot(directory, id)),
  );
  const errors = checkEvidence(
    {
      findings: checks.map(({ path, counterevidence }) => ({
        path,
        evidence: [],
        counterevidence,
      })),
    },
    snapshots,
  );
  if (errors.length) throw new Error(errors.join('\n'));

  if (hash(await readJson(filePath)) !== hash(record))
    throw new Error(
      'Profile changed during adversarial apply; prepare a fresh task',
    );
  await writeJson(filePath, {
    ...record,
    meta: {
      ...asRecord(record.meta, 'meta'),
      pending_adversarial: {
        ...binding,
        model: completion(reply, null).model,
        checks,
      },
    },
  });
  options.emit({
    status: 'saved',
    checks: checks.length,
    conflicts: checks.filter(({ outcome }) => outcome === 'conflict_found')
      .length,
  });
}

async function englishAudit(
  options: CoordinatorOptions,
  qid: string,
  researchFile?: string,
  resultFile?: string,
) {
  const {
    filePath,
    subject,
    profile,
    record,
    assessment,
    model,
    savedAdversarial,
  } = await loadEnglishAssessment(options, qid, researchFile);
  const profile_hash = profileHash(record);
  const assessment_hash = hash(assessment);
  const pending = asRecord(record.meta, 'meta').pending_adversarial;
  let checkpoint = savedAdversarial;
  let applyingCheckpoint = false;
  if (pending !== undefined) {
    const bound = asRecord(pending, 'pending adversarial checks');
    if (
      bound.profile_hash === profile_hash &&
      bound.assessment_hash === assessment_hash
    ) {
      checkpoint = bound;
      applyingCheckpoint = true;
    }
  }
  const targets = selectAdversarialTargets(profile, assessment);
  let adversarial: AdversarialResult | undefined;
  if (targets.length) {
    if (checkpoint === undefined)
      throw new Error(
        'Run english-adversarial for the current draft and assessment before english-audit',
      );
    const result = asRecord(checkpoint, 'adversarial checks');
    adversarial = {
      model: asString(result.model, 'adversarial model'),
      checks: parseAdversarialResult(result, targets),
    };
  }
  const merged = adversarial
    ? mergeAdversarialResult(assessment, adversarial)
    : assessment;
  const snapshots = await assessmentSnapshots(options, merged);
  const binding = { profile_hash, assessment_hash, adversarial };
  const prepared = task(
    englishAuditPrompt(
      profile,
      subject,
      merged,
      snapshots,
      adversarial?.checks,
    ),
    binding,
  );
  if (!resultFile) {
    options.emit(prepared);
    return;
  }
  const audit = asRecord(await readJson(resultFile), 'English audit');
  output(audit, prepared.input_hash);
  options.emit(
    await verifyProfile({
      filePath,
      subject,
      sources: new SourceStore(undefined, snapshots),
      resolve: options.resolve,
      expectedRecordHash: hash(record),
      force: applyingCheckpoint || readPendingAssessment(record) !== undefined,
      research: async () => ({ assessment, model }),
      adversarial: adversarial ? async () => adversarial : undefined,
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
  const { filePath, dates, subjects } = await loadSubject(options, qid);
  const raw = await loadTranslationSource(filePath, dates);
  if (approvedTranslation(await readTranslation(filePath), raw)) {
    options.emit({ status: 'skipped' });
    return;
  }
  const glossary = buildRussianGlossary(raw, subjects);
  const feedback = await translationFeedback(filePath, raw);
  const correction = prepareTranslationCorrection(raw, feedback, glossary);
  options.emit(
    task(
      correction?.prompt ?? translationPrompt(raw, feedback, glossary),
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
  const { filePath, dates, subjects } = await loadSubject(options, qid);
  const raw = await loadTranslationSource(filePath, dates);
  const binding = profileHash(raw);
  const candidate = asRecord(
    await readJson(candidateFile),
    'Russian candidate',
  );
  const glossary = buildRussianGlossary(raw, subjects);
  const feedback = await translationFeedback(filePath, raw);
  const translationTask = task(
    translationPrompt(raw, feedback, glossary),
    binding,
  );
  const correction = prepareTranslationCorrection(raw, feedback, glossary);
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
  const prepared = task(russianAuditPrompt(raw, fields, glossary), binding);
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
      glossary,
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
    evidence: ['url', 'query', 'offset', 'length', 'outline', 'refresh'],
    preflight: ['qid', 'file'],
    prefetch: ['qids', 'max-sources', 'refresh'],
    'english-adversarial': ['qid', 'research', 'result'],
    'english-audit': ['qid', 'research', 'result'],
    'english-repair': ['qid', 'result'],
    'russian-translation': ['qid'],
    'russian-audit': ['qid', 'candidate', 'result'],
  };
  if (!command || !Object.hasOwn(allowed, command)) return false;
  const flags = new Map<string, string>();
  for (const arg of argv) {
    const match = /^--([a-z]+(?:-[a-z]+)*)(?:=(.+))?$/.exec(arg);
    const name = match?.[1];
    const value = match?.[2];
    if (
      !name ||
      !allowed[command]?.includes(name) ||
      flags.has(name) ||
      (['refresh', 'outline'].includes(name)
        ? value !== undefined
        : value === undefined)
    )
      throw new Error(`Invalid ${command} argument: ${arg}`);
    flags.set(name, value ?? '');
  }
  const required = (name: string) => asString(flags.get(name), `--${name}`);
  if (command === 'evidence') {
    const url = required('url');
    const outline = flags.has('outline');
    if (
      outline &&
      ['query', 'offset', 'length'].some((name) => flags.has(name))
    )
      throw new Error(
        '--outline cannot be combined with --query, --offset, or --length',
      );
    const sources = evidenceStore(
      options.profilesDir,
      options.fetch,
      flags.has('refresh'),
    );
    options.emit(
      outline
        ? await sources.readOutline(url)
        : await sources.readExcerpt({
            url,
            query: flags.get('query'),
            offset: flags.has('offset')
              ? Number(flags.get('offset'))
              : undefined,
            length: flags.has('length')
              ? Number(flags.get('length'))
              : undefined,
          }),
    );
  } else if (command === 'prefetch') {
    const qids = parseQidsFlag(argv);
    if (!qids) throw new Error('--qids is required for prefetch');
    const subjects = new Map(
      (options.subjects ?? loadSubjects)().map((subject) => [
        subject.qid,
        subject,
      ]),
    );
    for (const qid of qids) {
      const subject = subjects.get(qid);
      if (!subject) throw new Error(`${qid}: no dataset entity`);
      options.emit(
        await prefetchSubject({
          subject,
          profilesDir: options.profilesDir,
          maxSources: flags.has('max-sources')
            ? Number(flags.get('max-sources'))
            : undefined,
          refresh: flags.has('refresh'),
          fetch: options.fetch,
        }),
      );
    }
  } else {
    const qid = required('qid');
    const result = flags.get('result');
    if (command === 'preflight') {
      if (!/^Q\d+$/.test(qid)) throw new Error('--qid must be a Wikidata QID');
      const subject = (options.subjects ?? loadSubjects)().find(
        (entry) => entry.qid === qid,
      );
      options.emit(
        await preflightProfile({
          qid,
          subject,
          profilesDir: options.profilesDir,
          filePath:
            flags.get('file') ??
            path.join(options.profilesDir, 'incoming', `${qid}.json`),
        }),
      );
    } else if (command === 'english-adversarial')
      await englishAdversarial(options, qid, flags.get('research'), result);
    else if (command === 'english-audit')
      await englishAudit(options, qid, flags.get('research'), result);
    else if (command === 'english-repair')
      await englishRepair(options, qid, result);
    else if (command === 'russian-translation')
      await russianTranslation(options, qid);
    else await russianAudit(options, qid, required('candidate'), result);
  }
  return true;
}
