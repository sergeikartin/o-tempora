import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { RAW_PROFILES_DIR } from './paths.ts';
import type { loadSubjects } from './subjects.ts';
import { type AgentRunMeta, parseTokenUsage } from './usage.ts';
import { asArray, asRecord, asString } from './values.ts';
import type { Assessment } from './verification/assessment.ts';
import type { fetchSource } from './verification/sources.ts';
import type { ResolveArticleQids } from './wikipedia-qids.ts';

interface CoordinatorOptions {
  profilesDir: string;
  resolve?: ResolveArticleQids;
  fetch?: typeof fetchSource;
  emit: (result: unknown) => void;
  subjects?: typeof loadSubjects;
}

const defaultOptions: CoordinatorOptions = {
  profilesDir: RAW_PROFILES_DIR,
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

async function getFetch(options: CoordinatorOptions) {
  return (
    options.fetch ?? (await import('./verification/sources.ts')).fetchSource
  );
}

async function getResolve(options: CoordinatorOptions) {
  return (
    options.resolve ??
    (await import('./wikipedia-qids.ts')).cachedArticleQidResolver(
      options.profilesDir,
    )
  );
}

async function getSubjectsLoader(options: CoordinatorOptions) {
  return options.subjects ?? (await import('./subjects.ts')).loadSubjects;
}

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
  const [
    { formatDates, loadSubjects: defaultLoadSubjects },
    { readStoredProfiles },
  ] = await Promise.all([import('./subjects.ts'), import('./store.ts')]);
  const subjects = new Map(
    (options.subjects ?? defaultLoadSubjects)().map((entry) => [
      entry.qid,
      entry,
    ]),
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

function makeTask(
  hashFn: (value: unknown) => string,
  prompt: string,
  binding: unknown,
) {
  return { prompt, input_hash: hashFn({ prompt, binding }) };
}

type TaskOptions = CoordinatorOptions & { outFile?: string };

async function emitTask(
  options: TaskOptions,
  prepared: {
    prompt: string;
    input_hash: string;
    targets?: readonly unknown[];
  },
) {
  const { outFile } = options;
  if (!outFile) {
    options.emit(prepared);
    return;
  }
  const { writeJson } = await import('./store.ts');
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

async function loadEnglishAssessment(options: CoordinatorOptions, qid: string) {
  const [
    { filePath, subject, record },
    { parseModelProfile },
    { readPendingAssessmentState },
    { profileHash },
    { parseAssessment, strings },
    { reportPathFor },
  ] = await Promise.all([
    loadSubject(options, qid),
    import('./model-profile.ts'),
    import('./pending-state.ts'),
    import('./verification/approval.ts'),
    import('./verification/assessment.ts'),
    import('./verification/runner.ts'),
  ]);
  const profile = parseModelProfile(record, filePath);
  const pending = await readPendingAssessmentState(
    options.profilesDir,
    qid,
    record,
  );
  const binding = profileHash(record);
  let input = pending;
  if (!input) {
    const saved = await readOptionalJson(reportPathFor(filePath));
    if (saved) {
      const report = asRecord(saved, 'verification report');
      if (report.profile_hash === binding) {
        input = {
          assessment: parseAssessment(report.assessment),
          model: strings(report.models, 'report models')[0] ?? 'unreported',
        };
      }
    }
  }
  if (!input)
    throw new Error(
      'No saved assessment for this draft; re-stage and finalize an assessed Profile.',
    );
  return { filePath, subject, profile, record, pending, ...input };
}

async function assessmentSnapshots(
  options: CoordinatorOptions,
  assessment: Assessment,
) {
  const [{ readSnapshot }, { findingExcerpts }] = await Promise.all([
    import('./evidence-cache.ts'),
    import('./verification/assessment.ts'),
  ]);
  const ids = new Set(
    assessment.findings.flatMap((finding) =>
      findingExcerpts(finding).map(({ source }) => source),
    ),
  );
  const directory = path.join(options.profilesDir, 'evidence');
  return Promise.all([...ids].map((id) => readSnapshot(directory, id)));
}

async function englishAudit(
  options: TaskOptions,
  qid: string,
  resultFile?: string,
) {
  const [
    loaded,
    { profileHash },
    { hash },
    { englishAuditPrompt },
    { readCompletedRepairs },
    { applyEnglishAudit },
  ] = await Promise.all([
    loadEnglishAssessment(options, qid),
    import('./verification/approval.ts'),
    import('./verification/assessment.ts'),
    import('./verification/researcher.ts'),
    import('./pending-state.ts'),
    import('./verification/runner.ts'),
  ]);
  const { filePath, subject, profile, record, pending, assessment, model } =
    loaded;
  const reAudit =
    pending?.repairedPaths !== undefined && pending.priorBlockers !== undefined
      ? {
          repaired_paths: pending.repairedPaths,
          prior_blockers: pending.priorBlockers,
        }
      : undefined;
  const snapshots = await assessmentSnapshots(options, assessment);
  const prepared = makeTask(
    hash,
    englishAuditPrompt(profile, subject, assessment, snapshots, reAudit),
    {
      profile_hash: profileHash(record),
      assessment_hash: hash(assessment),
      ...(reAudit ? { reAudit } : {}),
    },
  );
  if (!resultFile) {
    await emitTask(options, prepared);
    return;
  }
  const [audit, repairs, resolve] = await Promise.all([
    readJson(resultFile).then((value) => asRecord(value, 'English audit')),
    readCompletedRepairs(options.profilesDir, qid, record),
    getResolve(options),
  ]);
  options.emit(
    await applyEnglishAudit({
      filePath,
      subject,
      snapshots,
      assessment,
      researcherModel: model,
      audit: output(audit, prepared.input_hash),
      auditModel: agentRunMeta(audit).model,
      resolve,
      expectedRecordHash: hash(record),
      force: pending !== undefined,
      repairs,
    }),
  );
}

async function englishRepair(
  options: TaskOptions,
  qid: string,
  resultFile?: string,
) {
  const [
    { filePath, subject, record, dates },
    { flaggedRepairPaths },
    { parseModelProfile },
    { readCompletedRepairs, readPendingAssessmentState },
    { readPromptText },
    { profileHash },
    { hash, parseAssessment, strings },
    { checkpointEnglishRepair, reportPathFor },
  ] = await Promise.all([
    loadSubject(options, qid),
    import('./assessed-profile.ts'),
    import('./model-profile.ts'),
    import('./pending-state.ts'),
    import('./prompt.ts'),
    import('./verification/approval.ts'),
    import('./verification/assessment.ts'),
    import('./verification/runner.ts'),
  ]);
  if (await readPendingAssessmentState(options.profilesDir, qid, record))
    throw new Error(
      'Audit the pending assessment before preparing another repair',
    );
  const report = asRecord(
    await readJson(reportPathFor(filePath)),
    'verification report',
  );
  const subjectInfo = asRecord(report.subject, 'report subject');
  if (
    typeof report.policy_version !== 'string' ||
    !report.policy_version.length ||
    report.profile_hash !== profileHash(record) ||
    subjectInfo.qid !== qid ||
    subjectInfo.dates !== dates ||
    !strings(report.blockers, 'blockers').length
  )
    throw new Error(
      'English repair requires a current held verification report',
    );
  const profile = parseModelProfile(record, filePath);
  const reportAssessment = parseAssessment(report.assessment);
  const reportBlockers = strings(report.blockers, 'blockers');
  const flagged = flaggedRepairPaths(profile, reportAssessment, reportBlockers);
  const flaggedSet = new Set(flagged.paths);
  const flaggedFindings = flagged.global
    ? reportAssessment.findings
    : reportAssessment.findings.filter((finding) =>
        flaggedSet.has(finding.path),
      );
  const repairs = await readCompletedRepairs(options.profilesDir, qid, record);
  const prepared = makeTask(
    hash,
    readPromptText('profile-assessment-repair.md') +
      JSON.stringify({
        profile,
        flagged_paths: flagged.paths,
        blockers: reportBlockers,
        flagged_findings: flaggedFindings,
        subject_dates: reportAssessment.subject_dates,
        remaining_draft_repairs: 2 - repairs,
      }),
    hash(record),
  );
  if (!resultFile) {
    await emitTask(options, prepared);
    return;
  }
  const [reply, resolve] = await Promise.all([
    readJson(resultFile).then((value) => asRecord(value, 'English repair')),
    getResolve(options),
  ]);
  const result = output(reply, prepared.input_hash);
  options.emit(
    await checkpointEnglishRepair({
      filePath,
      subject,
      record,
      report,
      result,
      model: agentRunMeta(reply).model,
      resolve,
    }),
  );
}

async function russianTranslation(options: TaskOptions, qid: string) {
  const [
    { filePath, dates, subjects },
    {
      approvedTranslation,
      buildRussianGlossary,
      loadTranslationSource,
      prepareTranslationCorrection,
      readTranslation,
      translationFeedback,
      translationPrompt,
    },
    { profileHash },
    { hash },
  ] = await Promise.all([
    loadSubject(options, qid),
    import('./translation.ts'),
    import('./verification/approval.ts'),
    import('./verification/assessment.ts'),
  ]);
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
    makeTask(
      hash,
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
  const [
    { filePath, dates, subjects },
    {
      applyRussianAudit,
      buildRussianGlossary,
      loadTranslationSource,
      parseTranslationFields,
      prepareTranslationCorrection,
      russianAuditPrompt,
      translationFeedback,
      translationPrompt,
    },
    { profileHash },
    { hash },
  ] = await Promise.all([
    loadSubject(options, qid),
    import('./translation.ts'),
    import('./verification/approval.ts'),
    import('./verification/assessment.ts'),
  ]);
  const raw = await loadTranslationSource(filePath, dates);
  const binding = profileHash(raw);
  const candidate = asRecord(
    await readJson(candidateFile),
    'Russian candidate',
  );
  const glossary = buildRussianGlossary(raw, subjects);
  const feedback = await translationFeedback(filePath, raw);
  const translationTask = makeTask(
    hash,
    translationPrompt(raw, feedback, glossary),
    binding,
  );
  const correction = prepareTranslationCorrection(raw, feedback, glossary);
  let proposedFields: unknown;
  if (correction && candidate.input_hash !== translationTask.input_hash) {
    const reply = output(
      candidate,
      makeTask(hash, correction.prompt, binding).input_hash,
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
  const prepared = makeTask(
    hash,
    russianAuditPrompt(raw, fields, glossary),
    binding,
  );
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
    evidence: [
      'url',
      'query',
      'offset',
      'length',
      'outline',
      'batch',
      'refresh',
    ],
    validate: ['qid', 'file'],
    prefetch: [
      'qids',
      'max-sources',
      'refresh',
      'concurrency',
      'manifest',
      'urls',
    ],
    status: ['qids', 'scope', 'stage', 'limit'],
    'translation-status': ['qids', 'scope', 'stage', 'limit'],
    'english-audit': ['qid', 'result', 'out'],
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
    const batchArg = flags.get('batch');
    const [{ getDomain }, { evidenceStore }, { sourceUrl }, fetch] =
      await Promise.all([
        import('tldts'),
        import('./evidence-cache.ts'),
        import('./verification/sources.ts'),
        getFetch(options),
      ]);
    const sources = evidenceStore(
      options.profilesDir,
      (url) =>
        getDomain(sourceUrl(url).hostname) === 'wikipedia.org'
          ? fetch(url)
          : fetch(url, { maxAttempts: 1, rejectBotWalls: true }),
      flags.has('refresh'),
    );
    if (batchArg !== undefined) {
      if (
        ['url', 'query', 'offset', 'length', 'outline'].some((name) =>
          flags.has(name),
        )
      )
        throw new Error(
          '--batch cannot be combined with --url, --outline, --query, --offset, or --length',
        );
      const rawBatch: unknown = batchArg.startsWith('@')
        ? await readJson(batchArg.slice(1))
        : JSON.parse(batchArg);
      const requests = asArray(rawBatch, '--batch');
      if (!requests.length || requests.length > 12)
        throw new Error('--batch must contain between 1 and 12 requests');
      const results: unknown[] = new Array(requests.length);
      const queue = requests.entries();
      const workers = Math.min(3, requests.length);
      await Promise.all(
        Array.from({ length: workers }, async () => {
          for (const [index, entry] of queue) {
            let itemUrl = '';
            try {
              const item = asRecord(entry, `--batch[${index}]`);
              itemUrl = asString(item.url, `--batch[${index}].url`);
              const itemOutline = item.outline === true;
              if (
                itemOutline &&
                (item.query !== undefined ||
                  item.offset !== undefined ||
                  item.length !== undefined)
              )
                throw new Error(
                  'outline cannot be combined with query, offset, or length',
                );
              results[index] = itemOutline
                ? await sources.readOutline(itemUrl)
                : await sources.readExcerpt({
                    url: itemUrl,
                    query: item.query,
                    offset: item.offset,
                    length: item.length,
                  });
            } catch (error) {
              results[index] = {
                ...(itemUrl ? { url: itemUrl } : {}),
                error: error instanceof Error ? error.message : String(error),
              };
            }
          }
        }),
      );
      options.emit({ results });
      return true;
    }
    const url = required('url');
    const outline = flags.has('outline');
    if (
      outline &&
      ['query', 'offset', 'length'].some((name) => flags.has(name))
    )
      throw new Error(
        '--outline cannot be combined with --query, --offset, or --length',
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
    const [
      { parseQidsFlag },
      { parsePrefetchManifest, prefetchBatch, validatePrefetchConcurrency },
      loadSubjectsFn,
      fetch,
    ] = await Promise.all([
      import('../fetch/qid-filter.ts'),
      import('./prefetch.ts'),
      getSubjectsLoader(options),
      getFetch(options),
    ]);
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
      loadSubjectsFn().map((subject) => [subject.qid, subject]),
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
      fetch,
      concurrency,
    });
    for (const result of results) options.emit(result);
  } else if (command === 'status' || command === 'translation-status') {
    const [
      { parseQidsFlag },
      { inspectProfileStatus, parseProfileScope, parseProfileStages },
      loadSubjectsFn,
    ] = await Promise.all([
      import('../fetch/qid-filter.ts'),
      import('./status.ts'),
      getSubjectsLoader(options),
    ]);
    const qids = parseQidsFlag(argv);
    const scope = parseProfileScope(flags.get('scope'));
    const limit = flags.get('limit');
    if (limit !== undefined && !/^\d+$/.test(limit))
      throw new Error('--limit must be a positive integer');
    if (qids && scope)
      throw new Error('--qids and --scope are mutually exclusive');
    if (command === 'status') {
      const stages = parseProfileStages(flags.get('stage'));
      options.emit(
        await inspectProfileStatus({
          qids,
          scope,
          stages,
          limit: limit === undefined ? undefined : Number(limit),
          profilesDir: options.profilesDir,
          incomingDir: path.join(options.profilesDir, 'incoming'),
          subjects: loadSubjectsFn({ readOnly: true }),
        }),
      );
    } else {
      const { inspectTranslationStatus, parseTranslationStages } = await import(
        './translation-status.ts'
      );
      const stages = parseTranslationStages(flags.get('stage'));
      options.emit(
        await inspectTranslationStatus({
          qids,
          scope,
          stages,
          limit: limit === undefined ? undefined : Number(limit),
          profilesDir: options.profilesDir,
          subjects: loadSubjectsFn({ readOnly: true }),
        }),
      );
    }
  } else {
    const qid = required('qid');
    const result = flags.get('result');
    const taskOptions = { ...options, outFile: flags.get('out') };
    if (command === 'validate') {
      if (!/^Q\d+$/.test(qid)) throw new Error('--qid must be a Wikidata QID');
      const [{ validateProfile }, loadSubjectsFn] = await Promise.all([
        import('./validate.ts'),
        getSubjectsLoader(options),
      ]);
      const subjects = loadSubjectsFn();
      const subject = subjects.find((entry) => entry.qid === qid);
      options.emit(
        await validateProfile({
          qid,
          subject,
          subjects,
          profilesDir: options.profilesDir,
          filePath:
            flags.get('file') ??
            path.join(options.profilesDir, 'incoming', `${qid}.json`),
        }),
      );
    } else if (command === 'english-audit')
      await englishAudit(taskOptions, qid, result);
    else if (command === 'english-repair')
      await englishRepair(taskOptions, qid, result);
    else if (command === 'russian-translation')
      await russianTranslation(taskOptions, qid);
    else await russianAudit(taskOptions, qid, required('candidate'), result);
  }
  return true;
}
