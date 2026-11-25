import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseQidsFlag } from '../fetch/qid-filter.js';
import {
  adversarialBinding,
  currentAdversarialCheckpoint,
  reusableAdversarialChecks,
  validateAdversarialEvidence,
} from './adversarial-checkpoint.js';
import {
  finalizedAssessment,
  readPendingAssessment,
} from './assessed-profile.js';
import { evidenceStore, readSnapshot } from './evidence-cache.js';
import { parseModelProfile } from './model-profile.js';
import { RAW_PROFILES_DIR } from './paths.js';
import {
  parsePrefetchManifest,
  prefetchBatch,
  validatePrefetchConcurrency,
} from './prefetch.js';
import { preflightProfile } from './preflight.js';
import { readPromptText } from './prompt.js';
import {
  inspectProfileStatus,
  parseProfileScope,
  parseProfileStages,
} from './status.js';
import { readStoredProfiles, writeJson } from './store.js';
import { formatDates, loadSubjects } from './subjects.js';
import {
  applyRussianAudit,
  approvedTranslation,
  buildRussianGlossary,
  loadTranslationSource,
  parseTranslationFields,
  prepareTranslationCorrection,
  readTranslation,
  russianAuditPrompt,
  translationFeedback,
  translationPrompt,
} from './translation.js';
import { type AgentRunMeta, parseTokenUsage } from './usage.js';
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
  findingExcerpts,
  hash,
  isCurrentVerificationPolicy,
  parseAssessment,
  profileHash,
  strings,
} from './verification/policy.js';
import { englishAuditPrompt } from './verification/researcher.js';
import {
  applyEnglishAudit,
  checkpointEnglishRepair,
  completedRepairs,
  reportPathFor,
} from './verification/runner.js';
import { fetchSource } from './verification/sources.js';
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
      (('status' in result && result.status === 'held') ||
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

type TaskOptions = CoordinatorOptions & { outFile?: string };

async function emitTask(
  options: TaskOptions,
  prepared: ReturnType<typeof task> & { targets?: readonly unknown[] },
) {
  const { outFile } = options;
  if (!outFile) {
    options.emit(prepared);
    return;
  }
  await writeJson(outFile, prepared);
  options.emit({
    status: 'prepared',
    file: outFile,
    input_hash: prepared.input_hash,
    ...(prepared.targets ? { targets: prepared.targets.length } : {}),
  });
}

function output(
  value: Record<string, unknown>,
  inputHash: string,
): Record<string, unknown> {
  if (value.input_hash !== inputHash)
    throw new Error('Result belongs to different inputs; prepare a fresh task');
  return asRecord(value.result, 'agent result');
}

function agentRunMeta(value: Record<string, unknown>): AgentRunMeta {
  return {
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
      model: agentRunMeta(research).model,
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
  options: TaskOptions,
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
  const binding = adversarialBinding(record, assessment);
  const reused = await reusableAdversarialChecks({
    filePath,
    profilesDir: options.profilesDir,
    qid,
    targets,
  });
  const reusedIndices = new Set(reused.map(({ check }) => check.finding_index));
  const uncached = targets.filter(
    ({ finding_index }) => !reusedIndices.has(finding_index),
  );
  const checks = reused.map(({ check }) => check);
  const models = new Set(reused.map(({ model }) => model));
  if (uncached.length) {
    const prepared = task(
      adversarialPrompt(
        profile,
        subject,
        assessment,
        uncached,
        await assessmentSnapshots(options, assessment),
      ),
      { ...binding, targets, reused },
    );
    if (!resultFile) {
      await emitTask(options, { ...prepared, targets: uncached });
      return;
    }
    const reply = asRecord(
      await readJson(resultFile),
      'English adversarial result',
    );
    const fresh = parseAdversarialResult(
      output(reply, prepared.input_hash),
      uncached,
    );
    await validateAdversarialEvidence(
      path.join(options.profilesDir, 'evidence'),
      fresh,
    );
    checks.push(...fresh);
    models.add(agentRunMeta(reply).model);
  } else if (resultFile) {
    throw new Error('Result belongs to different inputs; prepare a fresh task');
  }
  checks.sort((a, b) => a.finding_index - b.finding_index);

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
        model: [...models].join(', '),
        checks,
      },
    },
  });
  options.emit({
    status: uncached.length ? 'saved' : 'reused',
    checks: checks.length,
    conflicts: checks.filter(({ outcome }) => outcome === 'conflict_found')
      .length,
  });
}

async function englishAudit(
  options: TaskOptions,
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
  const binding = adversarialBinding(record, assessment);
  const pending = currentAdversarialCheckpoint(record, assessment);
  const checkpoint = pending ?? savedAdversarial;
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
  const prepared = task(
    englishAuditPrompt(
      profile,
      subject,
      merged,
      snapshots,
      adversarial?.checks,
    ),
    { ...binding, adversarial },
  );
  if (!resultFile) {
    await emitTask(options, prepared);
    return;
  }
  const audit = asRecord(await readJson(resultFile), 'English audit');
  options.emit(
    await applyEnglishAudit({
      filePath,
      subject,
      snapshots,
      assessment,
      researcherModel: model,
      adversarial,
      audit: output(audit, prepared.input_hash),
      auditModel: agentRunMeta(audit).model,
      resolve: options.resolve,
      expectedRecordHash: hash(record),
      force:
        pending !== undefined || readPendingAssessment(record) !== undefined,
      repairs: completedRepairs(record),
    }),
  );
}

async function englishRepair(
  options: TaskOptions,
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
    await emitTask(options, prepared);
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
      model: agentRunMeta(reply).model,
      resolve: options.resolve,
    }),
  );
}

async function russianTranslation(options: TaskOptions, qid: string) {
  const { filePath, dates, subjects } = await loadSubject(options, qid);
  const raw = await loadTranslationSource(filePath, dates);
  if (approvedTranslation(await readTranslation(filePath), raw)) {
    options.emit({ status: 'skipped' });
    return;
  }
  const glossary = buildRussianGlossary(raw, subjects);
  const feedback = await translationFeedback(filePath, raw);
  const correction = prepareTranslationCorrection(raw, feedback, glossary);
  await emitTask(
    options,
    task(
      correction?.prompt ?? translationPrompt(raw, feedback, glossary),
      profileHash(raw),
    ),
  );
}

async function russianAudit(
  options: TaskOptions,
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
    await emitTask(options, prepared);
    return;
  }
  const audit = asRecord(await readJson(resultFile), 'Russian audit');
  options.emit(
    await applyRussianAudit({
      filePath,
      dates,
      fields,
      audit: output(audit, prepared.input_hash),
      models: [agentRunMeta(candidate), agentRunMeta(audit)],
      expectedSourceHash: binding,
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
    prefetch: [
      'qids',
      'max-sources',
      'refresh',
      'concurrency',
      'manifest',
      'urls',
    ],
    status: ['qids', 'scope', 'stage', 'limit'],
    'english-adversarial': ['qid', 'research', 'result', 'out'],
    'english-audit': ['qid', 'research', 'result', 'out'],
    'english-repair': ['qid', 'result', 'out'],
    'russian-translation': ['qid', 'out'],
    'russian-audit': ['qid', 'candidate', 'result', 'out'],
  };
  if (!command || !Object.hasOwn(allowed, command)) return false;
  const flags = new Map<string, string>();
  for (const arg of argv) {
    const match = /^--([a-z]+(?:-[a-z]+)*)(?:=(.*))?$/.exec(arg);
    const name = match?.[1];
    const value = match?.[2];
    if (
      !name ||
      !allowed[command]?.includes(name) ||
      flags.has(name) ||
      (['refresh', 'outline'].includes(name)
        ? value !== undefined
        : value === undefined ||
          (value === '' && name !== 'stage' && name !== 'limit'))
    )
      throw new Error(`Invalid ${command} argument: ${arg}`);
    flags.set(name, value ?? '');
  }
  if (flags.has('out') && flags.has('result'))
    throw new Error('--out cannot be combined with --result');
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
    const manifestFile = flags.get('manifest');
    const urlsFlag = flags.get('urls');
    if (manifestFile && urlsFlag)
      throw new Error('--manifest cannot be combined with --urls');
    if ((manifestFile || urlsFlag) && qids.size !== 1)
      throw new Error('--manifest and --urls require a single QID in --qids');
    if ((manifestFile || urlsFlag) && flags.has('max-sources'))
      throw new Error(
        '--max-sources cannot be combined with --manifest or --urls',
      );
    const concurrency = Number(flags.get('concurrency') ?? 1);
    validatePrefetchConcurrency(concurrency);
    const byQid = new Map(
      (options.subjects ?? loadSubjects)().map((subject) => [
        subject.qid,
        subject,
      ]),
    );
    const subjects = [...qids].map((qid) => {
      const subject = byQid.get(qid);
      if (!subject) throw new Error(`${qid}: no dataset entity`);
      return subject;
    });
    const manifest = manifestFile
      ? parsePrefetchManifest(await readJson(manifestFile), subjects[0]?.qid)
      : undefined;
    const urls = urlsFlag
      ? urlsFlag
          .split(/,(?=\s*[a-z][a-z0-9+.-]*:\/\/)/i)
          .map((value) => value.trim())
          .filter(Boolean)
      : undefined;
    if (urlsFlag && (!urls || urls.length === 0))
      throw new Error('--urls must contain at least one URL');
    const results = await prefetchBatch({
      subjects,
      profilesDir: options.profilesDir,
      maxSources: flags.has('max-sources')
        ? Number(flags.get('max-sources'))
        : undefined,
      refresh: flags.has('refresh'),
      manifest,
      urls,
      fetch: options.fetch,
      concurrency,
    });
    for (const result of results) options.emit(result);
  } else if (command === 'status') {
    const qids = parseQidsFlag(argv);
    const scope = parseProfileScope(flags.get('scope'));
    const stages = parseProfileStages(flags.get('stage'));
    const limit = flags.get('limit');
    if (limit !== undefined && !/^\d+$/.test(limit))
      throw new Error('--limit must be a positive integer');
    if (qids && scope)
      throw new Error('--qids and --scope are mutually exclusive');
    options.emit(
      await inspectProfileStatus({
        qids,
        scope,
        stages,
        limit: limit === undefined ? undefined : Number(limit),
        profilesDir: options.profilesDir,
        incomingDir: path.join(options.profilesDir, 'incoming'),
        subjects: (options.subjects ?? loadSubjects)({ readOnly: true }),
      }),
    );
  } else {
    const qid = required('qid');
    const result = flags.get('result');
    const taskOptions = { ...options, outFile: flags.get('out') };
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
      await englishAdversarial(taskOptions, qid, flags.get('research'), result);
    else if (command === 'english-audit')
      await englishAudit(taskOptions, qid, flags.get('research'), result);
    else if (command === 'english-repair')
      await englishRepair(taskOptions, qid, result);
    else if (command === 'russian-translation')
      await russianTranslation(taskOptions, qid);
    else await russianAudit(taskOptions, qid, required('candidate'), result);
  }
  return true;
}
