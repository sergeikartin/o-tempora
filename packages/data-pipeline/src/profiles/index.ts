import path from 'node:path';
import { parseQidsFlag } from '../fetch/qid-filter.js';
import { finalizeProfiles } from './finalize.js';
import { INCOMING_DIR, RAW_PROFILES_DIR } from './paths.js';
import { formatPlan, type PlanEntry, planProfiles } from './plan.js';
import { loadPrompt, loadPromptMarkdown, loadWriterModel } from './prompt.js';
import {
  createCompleter,
  DEFAULT_MODEL,
  isProvider,
  PROVIDERS,
} from './providers.js';
import { SessionBridge } from './session.js';
import { readStoredProfiles } from './store.js';
import { formatDates, loadSubjects } from './subjects.js';
import { translateProfile } from './translation.js';
import { auditSavedProfile } from './verification/audit-saved.js';
import { createResearcher } from './verification/researcher.js';
import { verifyProfile } from './verification/runner.js';
import { resolveArticleQids } from './wikipedia-qids.js';
import { type WriteEntry, writeProfiles } from './writer.js';

const USAGE = `Usage: profiles <plan|write|finalize|verify|audit|translate> [flags]
  plan      --qids=Q1,Q2,... [--regenerate-stale]
  write     --qids=Q1,Q2,... [--regenerate-stale] [--provider=${PROVIDERS.join('|')}] [--model=<id>] [--concurrency=<n>] [--execution=api|session --session-dir=<absolute directory>]
  finalize  [--run-id=<id>]
  verify    --qids=Q1,Q2,... [--repair] [--force] [--model=<OpenAI id>] [--audit-provider=${PROVIDERS.join('|')}] [--audit-model=<id>] [--translation-model=<OpenAI id>] [--execution=api|session --session-dir=<absolute directory>]
  audit     --qids=Q1,Q2,... [--provider=${PROVIDERS.join('|')}] [--model=<id>]
  translate --qids=Q1,Q2,... [--force] [--provider=${PROVIDERS.join('|')}] [--model=<id>] [--audit-model=<id>] [--execution=api|session --session-dir=<absolute directory>]`;

const DEFAULT_CONCURRENCY = 3;

function sessionFromFlags(argv: readonly string[]): SessionBridge | undefined {
  const execution = flagValue(argv, 'execution') ?? 'api';
  if (execution !== 'api' && execution !== 'session') {
    throw new Error('--execution must be api or session');
  }
  const directory = flagValue(argv, 'session-dir');
  if (execution === 'api') {
    if (directory !== undefined)
      throw new Error('--session-dir requires --execution=session');
    return undefined;
  }
  if (!directory || !path.isAbsolute(directory))
    throw new Error(
      '--execution=session requires --session-dir=<absolute directory>',
    );
  if (
    argv.some((arg) =>
      [
        '--model=',
        '--audit-model=',
        '--audit-provider=',
        '--translation-model=',
        '--provider=',
      ].some((prefix) => arg.startsWith(prefix)),
    )
  ) {
    throw new Error(
      'Session agents are selected by the conversation; omit provider/model flags',
    );
  }
  return new SessionBridge({ directory, log: console.log });
}

function flagValue(argv: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function planFromFlags(argv: readonly string[]): Promise<PlanEntry[]> {
  const qids = parseQidsFlag(argv);
  if (!qids) {
    throw new Error(
      `--qids is required: Profiles are written per chosen batch\n${USAGE}`,
    );
  }
  const subjects = loadSubjects().filter((subject) => qids.has(subject.qid));
  for (const qid of qids) {
    if (!subjects.some((subject) => subject.qid === qid)) {
      console.warn(`${qid}: not an entity in the dataset, ignored`);
    }
  }
  return planProfiles(subjects, await readStoredProfiles(RAW_PROFILES_DIR), {
    currentPromptHash: (await loadPrompt()).hash,
    regenerateStale: argv.includes('--regenerate-stale'),
    incomingDir: INCOMING_DIR,
  });
}

async function plan(argv: readonly string[]): Promise<void> {
  console.log(formatPlan(await planFromFlags(argv)));
}

async function write(argv: readonly string[]): Promise<void> {
  const session = sessionFromFlags(argv);
  const provider = flagValue(argv, 'provider') ?? 'openai';
  if (!isProvider(provider)) {
    throw new Error(`--provider must be one of ${PROVIDERS.join(', ')}`);
  }
  const model = flagValue(argv, 'model') ?? DEFAULT_MODEL[provider];
  const concurrency = Number(
    flagValue(argv, 'concurrency') ?? DEFAULT_CONCURRENCY,
  );
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('--concurrency must be a positive integer');
  }

  const entries = await planFromFlags(argv);
  const toWrite = entries.filter(
    (entry): entry is WriteEntry => entry.kind === 'write',
  );
  console.log(
    `${toWrite.length} to write, ${entries.length - toWrite.length} skipped, with ${session ? 'session agents' : `${provider}/${model}`}`,
  );
  if (toWrite.length === 0) return;
  const result = await writeProfiles({
    entries: toWrite,
    promptMarkdown: await loadPromptMarkdown(),
    complete: session?.complete ?? createCompleter(provider, model),
    provider: session ? 'session' : provider,
    concurrency,
  });
  for (const file of result.written) console.log(`staged ${file}`);
  for (const { qid, error } of result.failed) {
    console.error(`failed ${qid}: ${error}`);
  }
  console.log(
    `${result.written.length} staged, ${result.failed.length} failed; run finalize to turn staged files into records`,
  );
  if (result.failed.length > 0) process.exitCode = 1;
}

async function finalize(argv: readonly string[]): Promise<void> {
  const now = new Date();
  const result = await finalizeProfiles({
    incomingDir: INCOMING_DIR,
    profilesDir: RAW_PROFILES_DIR,
    subjects: loadSubjects(),
    model: await loadWriterModel(),
    runId: flagValue(argv, 'run-id') ?? now.toISOString().slice(0, 10),
    resolveArticleQids,
  });
  for (const file of result.written) console.log(`wrote ${file}`);
  for (const file of result.skippedEdited) {
    console.log(`kept ${file}: edited records are never overwritten`);
  }
  for (const { file, error } of result.failed) {
    console.error(`failed ${file}: ${error}`);
  }
  console.log(
    `${result.written.length} written, ${result.skippedEdited.length} kept, ${result.failed.length} failed`,
  );
  if (result.failed.length > 0) process.exitCode = 1;
}

async function main(): Promise<void> {
  const [command, ...argv] = process.argv.slice(2);
  if (command === 'plan') await plan(argv);
  else if (command === 'write') await write(argv);
  else if (command === 'finalize') await finalize(argv);
  else if (command === 'verify') await verify(argv);
  else if (command === 'audit') await audit(argv);
  else if (command === 'translate') await translate(argv);
  else throw new Error(USAGE);
}

async function verify(argv: readonly string[]): Promise<void> {
  const unknown = argv.find(
    (arg) =>
      !['--repair', '--force'].includes(arg) &&
      ![
        '--qids=',
        '--model=',
        '--audit-model=',
        '--audit-provider=',
        '--translation-model=',
        '--execution=',
        '--session-dir=',
      ].some((prefix) => arg.startsWith(prefix)),
  );
  if (unknown)
    throw new Error(`Unknown verification flag: ${unknown}\n${USAGE}`);
  const qids = parseQidsFlag(argv);
  if (!qids)
    throw new Error(
      `--qids is required: verification runs per chosen batch\n${USAGE}`,
    );
  const session = sessionFromFlags(argv);
  const model = flagValue(argv, 'model') ?? DEFAULT_MODEL.openai;
  const auditProvider = flagValue(argv, 'audit-provider') ?? 'openai';
  if (!isProvider(auditProvider))
    throw new Error(`--audit-provider must be one of ${PROVIDERS.join(', ')}`);
  const auditModel =
    flagValue(argv, 'audit-model') ??
    (auditProvider === 'openai' ? model : DEFAULT_MODEL[auditProvider]);
  const openAiCompletionModel = auditProvider === 'openai' ? auditModel : model;
  const translationModel =
    flagValue(argv, 'translation-model') ?? openAiCompletionModel;
  let translator: ReturnType<typeof createCompleter> | undefined;
  const stored = await readStoredProfiles(RAW_PROFILES_DIR);
  const subjects = new Map(
    loadSubjects().map((subject) => [subject.qid, subject]),
  );
  let research: ReturnType<typeof createResearcher> | undefined;
  let complete: ReturnType<typeof createCompleter> | undefined;
  let externalAudit: ReturnType<typeof createCompleter> | undefined;
  const counts = { approved: 0, held: 0, skipped: 0, retry: 0, failed: 0 };
  for (const qid of qids) {
    try {
      const entry = stored.get(qid);
      const subject = subjects.get(qid);
      if (!entry || !subject)
        throw new Error('No raw Profile or dataset entity for this QID');
      const result = await verifyProfile({
        filePath: entry.filePath,
        subject,
        research: (...args) => {
          research ??= session?.research ?? createResearcher(model);
          return research(...args);
        },
        complete: (prompt, role) => {
          if (role === 'audit' && auditProvider !== 'openai') {
            externalAudit ??= createCompleter(auditProvider, auditModel);
            return externalAudit(prompt, role);
          }
          complete ??=
            session?.complete ??
            createCompleter('openai', openAiCompletionModel);
          return complete(prompt, role);
        },
        resolve: resolveArticleQids,
        repair: argv.includes('--repair'),
        force: argv.includes('--force'),
        log: console.log,
      });
      counts[result.status]++;
      console.log(`${qid}: ${result.status}; ${result.reportPath}`);
      for (const blocker of result.blockers) console.log(`  ${blocker}`);
      if (result.proposalPath)
        console.log(`  proposed edit: ${result.proposalPath}`);
      if (result.status === 'approved' || result.status === 'skipped') {
        const translation = await translateProfile({
          filePath: entry.filePath,
          dates: formatDates(subject.dateSpan),
          complete: (prompt, role) => {
            if (!session && role === 'translate') {
              translator ??= createCompleter('openai', translationModel);
              return translator(prompt, role);
            }
            complete ??=
              session?.complete ??
              createCompleter('openai', openAiCompletionModel);
            return complete(prompt, role);
          },
        });
        console.log(
          `${qid}: Russian translation ${translation.status}; ${translation.filePath}`,
        );
        for (const blocker of translation.blockers) console.log(`  ${blocker}`);
        if (translation.status === 'held') counts.held++;
      }
    } catch (error) {
      counts.failed++;
      console.error(
        `${qid}: failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  console.log(JSON.stringify(counts));
  if (counts.held || counts.retry || counts.failed) process.exitCode = 1;
}

async function audit(argv: readonly string[]): Promise<void> {
  const unknown = argv.find(
    (arg) =>
      !['--qids=', '--provider=', '--model='].some((prefix) =>
        arg.startsWith(prefix),
      ),
  );
  if (unknown) throw new Error(`Unknown audit flag: ${unknown}\n${USAGE}`);
  const qids = parseQidsFlag(argv);
  if (!qids) throw new Error('--qids is required for a saved-evidence audit');
  const provider = flagValue(argv, 'provider') ?? 'openai';
  if (!isProvider(provider))
    throw new Error(`--provider must be one of ${PROVIDERS.join(', ')}`);
  const model = flagValue(argv, 'model') ?? DEFAULT_MODEL[provider];
  const stored = await readStoredProfiles(RAW_PROFILES_DIR);
  const subjects = new Map(
    loadSubjects().map((subject) => [subject.qid, subject]),
  );
  let complete: ReturnType<typeof createCompleter> | undefined;
  for (const qid of qids) {
    try {
      const entry = stored.get(qid);
      const subject = subjects.get(qid);
      if (!entry || !subject)
        throw new Error('No raw Profile or dataset entity for this QID');
      const result = await auditSavedProfile(
        entry.filePath,
        subject,
        (prompt, role) => {
          complete ??= createCompleter(provider, model);
          return complete(prompt, role);
        },
      );
      console.log(JSON.stringify({ qid, provider, ...result }));
    } catch (error) {
      console.error(
        `${qid}: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 1;
    }
  }
}

async function translate(argv: readonly string[]): Promise<void> {
  const unknown = argv.find(
    (arg) =>
      arg !== '--force' &&
      ![
        '--qids=',
        '--provider=',
        '--model=',
        '--audit-model=',
        '--execution=',
        '--session-dir=',
      ].some((prefix) => arg.startsWith(prefix)),
  );
  if (unknown)
    throw new Error(`Unknown translation flag: ${unknown}\n${USAGE}`);
  const qids = parseQidsFlag(argv);
  if (!qids) throw new Error(`--qids is required\n${USAGE}`);
  const session = sessionFromFlags(argv);
  const provider = flagValue(argv, 'provider') ?? 'openai';
  if (!isProvider(provider)) throw new Error(`Unknown provider: ${provider}`);
  const model = flagValue(argv, 'model') ?? DEFAULT_MODEL[provider];
  const auditModel = flagValue(argv, 'audit-model') ?? model;
  let writer: ReturnType<typeof createCompleter> | undefined;
  let auditor: ReturnType<typeof createCompleter> | undefined;
  const complete: ReturnType<typeof createCompleter> = (prompt, role) => {
    if (session) return session.complete(prompt, role);
    if (role === 'translation-audit') {
      auditor ??= createCompleter(provider, auditModel);
      return auditor(prompt, role);
    }
    writer ??= createCompleter(provider, model);
    return writer(prompt, role);
  };
  const stored = await readStoredProfiles(RAW_PROFILES_DIR);
  const subjects = new Map(
    loadSubjects().map((subject) => [subject.qid, subject]),
  );
  const counts = { approved: 0, skipped: 0, held: 0, failed: 0 };
  for (const qid of qids) {
    try {
      const entry = stored.get(qid);
      const subject = subjects.get(qid);
      if (!entry || !subject)
        throw new Error('No raw Profile or dataset entity for this QID');
      const result = await translateProfile({
        filePath: entry.filePath,
        dates: formatDates(subject.dateSpan),
        complete,
        force: argv.includes('--force'),
      });
      counts[result.status]++;
      console.log(`${qid}: translation ${result.status}; ${result.filePath}`);
      for (const blocker of result.blockers) console.log(`  ${blocker}`);
    } catch (error) {
      counts.failed++;
      console.error(
        `${qid}: translation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  console.log(JSON.stringify(counts));
  if (counts.held || counts.failed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
