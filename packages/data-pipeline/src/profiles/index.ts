import { parseQidsFlag } from '../fetch/qid-filter.js';
import { finalizeProfiles } from './finalize.js';
import { INCOMING_DIR, RAW_PROFILES_DIR } from './paths.js';
import { formatPlan, planProfiles } from './plan.js';
import { loadPrompt, loadWriterModel } from './prompt.js';
import { readStoredProfiles } from './store.js';
import { loadSubjects } from './subjects.js';
import { resolveArticleQids } from './wikipedia-qids.js';

const USAGE = `Usage: profiles <plan|finalize> [flags]
  plan      --qids=Q1,Q2,... [--regenerate-stale]
  finalize  [--run-id=<id>]`;

function flagValue(argv: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function plan(argv: readonly string[]): Promise<void> {
  const qids = parseQidsFlag(argv);
  if (!qids) {
    throw new Error(
      `plan needs --qids: Profiles are written per chosen batch\n${USAGE}`,
    );
  }
  const subjects = loadSubjects().filter((subject) => qids.has(subject.qid));
  for (const qid of qids) {
    if (!subjects.some((subject) => subject.qid === qid)) {
      console.warn(`${qid}: not an entity in the dataset, ignored`);
    }
  }
  const entries = planProfiles(
    subjects,
    await readStoredProfiles(RAW_PROFILES_DIR),
    {
      currentPromptHash: (await loadPrompt()).hash,
      regenerateStale: argv.includes('--regenerate-stale'),
      incomingDir: INCOMING_DIR,
    },
  );
  console.log(formatPlan(entries));
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
  else if (command === 'finalize') await finalize(argv);
  else throw new Error(USAGE);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
