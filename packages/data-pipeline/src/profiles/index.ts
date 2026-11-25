import { parseQidsFlag } from '../fetch/qid-filter.js';
import { runCoordinatorCommand } from './coordinator.js';
import { type FinalizeOptions, finalizeProfiles } from './finalize.js';
import { INCOMING_DIR, RAW_PROFILES_DIR } from './paths.js';
import { loadWriterModel } from './prompt.js';
import { loadSubjects } from './subjects.js';
import { cachedArticleQidResolver } from './wikipedia-qids.js';

const USAGE = `Usage: profiles <finalize|status|preflight|prefetch|evidence|english-adversarial|english-audit|english-repair|russian-translation|russian-audit> [flags]
  finalize  [--qids=Q1,Q2,...] [--run-id=<id>] [--model=<id>]
  status [--qids=Q1,Q2,... | --scope=legendary|mainstream|all] [--stage=<stage1,stage2,...>] [--limit=<n>]
  preflight --qid=Q1 [--file=<path>]
  prefetch --qids=Q1,Q2,... [--max-sources=5 | --manifest=<file> | --urls=<url1,url2,...>] [--concurrency=<1..3>] [--refresh]
  evidence --url=<https URL> [--outline | [--query=<text>] [--offset=<number>] [--length=<chars>]] [--refresh]
  english-adversarial --qid=Q1 [--research=<file>] [--out=<file> | --result=<file>]
  english-audit --qid=Q1 [--research=<file>] [--out=<file> | --result=<file>]
  english-repair --qid=Q1 [--out=<file> | --result=<file>]
  russian-translation --qid=Q1 [--out=<file>]
  russian-audit --qid=Q1 --candidate=<file> [--out=<file> | --result=<file>]`;

export async function runFinalizeCommand(
  argv: readonly string[],
  loadOptions: () => Omit<
    FinalizeOptions,
    'model' | 'qids' | 'runId'
  > = () => ({
    incomingDir: INCOMING_DIR,
    profilesDir: RAW_PROFILES_DIR,
    subjects: loadSubjects(),
    resolveArticleQids: cachedArticleQidResolver(RAW_PROFILES_DIR),
  }),
) {
  const unknown = argv.find(
    (arg) =>
      !arg.startsWith('--qids=') &&
      !arg.startsWith('--run-id=') &&
      !arg.startsWith('--model='),
  );
  if (unknown) throw new Error(`Unknown finalize flag: ${unknown}\n${USAGE}`);
  const models = argv.filter((arg) => arg.startsWith('--model='));
  const model = models[0]?.slice('--model='.length).trim();
  if (models.length > 1 || model === '')
    throw new Error('--model takes one non-empty model ID');
  const now = new Date();
  return finalizeProfiles({
    ...loadOptions(),
    model: model ?? (await loadWriterModel()),
    qids: parseQidsFlag(argv) ?? undefined,
    runId:
      argv
        .find((arg) => arg.startsWith('--run-id='))
        ?.slice('--run-id='.length) ?? now.toISOString().slice(0, 10),
  });
}

async function finalize(argv: readonly string[]): Promise<void> {
  const result = await runFinalizeCommand(argv);
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
  if (command === 'finalize') await finalize(argv);
  else if (!(await runCoordinatorCommand(command, argv)))
    throw new Error(USAGE);
}

if (import.meta.main)
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
