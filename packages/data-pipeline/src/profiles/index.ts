import { parseQidsFlag } from '../fetch/qid-filter.js';
import { runCoordinatorCommand } from './coordinator.js';
import { finalizeProfiles } from './finalize.js';
import { INCOMING_DIR, RAW_PROFILES_DIR } from './paths.js';
import { loadWriterModel } from './prompt.js';
import { loadSubjects } from './subjects.js';
import { resolveArticleQids } from './wikipedia-qids.js';

const USAGE = `Usage: profiles <finalize|status|preflight|prefetch|evidence|english-adversarial|english-audit|english-repair|russian-translation|russian-audit> [flags]
  finalize  [--qids=Q1,Q2,...] [--run-id=<id>]
  status [--qids=Q1,Q2,... | --scope=legendary|mainstream|all]
  preflight --qid=Q1 [--file=<path>]
  prefetch --qids=Q1,Q2,... [--max-sources=5] [--concurrency=<1..3>] [--refresh]
  evidence --url=<https URL> [--outline | [--query=<text>] [--offset=<number>] [--length=<chars>]] [--refresh]
  english-adversarial --qid=Q1 [--research=<file>] [--result=<file>]
  english-audit --qid=Q1 [--research=<file>] [--result=<file>]
  english-repair --qid=Q1 [--result=<file>]
  russian-translation --qid=Q1
  russian-audit --qid=Q1 --candidate=<file> [--result=<file>]`;

async function finalize(argv: readonly string[]): Promise<void> {
  const unknown = argv.find(
    (arg) => !arg.startsWith('--qids=') && !arg.startsWith('--run-id='),
  );
  if (unknown) throw new Error(`Unknown finalize flag: ${unknown}\n${USAGE}`);
  const now = new Date();
  const result = await finalizeProfiles({
    incomingDir: INCOMING_DIR,
    profilesDir: RAW_PROFILES_DIR,
    subjects: loadSubjects(),
    model: await loadWriterModel(),
    qids: parseQidsFlag(argv) ?? undefined,
    runId:
      argv
        .find((arg) => arg.startsWith('--run-id='))
        ?.slice('--run-id='.length) ?? now.toISOString().slice(0, 10),
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
  if (command === 'finalize') await finalize(argv);
  else if (!(await runCoordinatorCommand(command, argv)))
    throw new Error(USAGE);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
