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
import { readStoredProfiles } from './store.js';
import { loadSubjects } from './subjects.js';
import { resolveArticleQids } from './wikipedia-qids.js';
import { type WriteEntry, writeProfiles } from './writer.js';

const USAGE = `Usage: profiles <plan|write|finalize> [flags]
  plan      --qids=Q1,Q2,... [--regenerate-stale]
  write     --qids=Q1,Q2,... [--regenerate-stale] [--provider=${PROVIDERS.join('|')}] [--model=<id>] [--concurrency=<n>]
  finalize  [--run-id=<id>]`;

const DEFAULT_CONCURRENCY = 3;

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
    `${toWrite.length} to write, ${entries.length - toWrite.length} skipped, with ${provider}/${model}`,
  );
  if (toWrite.length === 0) return;
  const result = await writeProfiles({
    entries: toWrite,
    promptMarkdown: await loadPromptMarkdown(),
    complete: createCompleter(provider, model),
    provider,
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
    prompt: await loadPrompt(),
    model: await loadWriterModel(),
    runId: flagValue(argv, 'run-id') ?? now.toISOString().slice(0, 10),
    now,
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
  else throw new Error(USAGE);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
