import { parseQidsFlag } from '../fetch/qid-filter.js';
import { runCoordinatorCommand } from './coordinator.js';
import { finalizeProfiles } from './finalize.js';
import {
  flagValue,
  routeProfileModels,
  routeVerificationModels,
} from './model-routing.js';
import { INCOMING_DIR, RAW_PROFILES_DIR } from './paths.js';
import { loadWriterModel } from './prompt.js';
import { PROVIDERS } from './providers.js';
import { readStoredProfiles } from './store.js';
import { formatDates, loadSubjects } from './subjects.js';
import { translateProfile } from './translation.js';
import { auditSavedProfile } from './verification/audit-saved.js';
import { verifyProfile } from './verification/runner.js';
import { resolveArticleQids } from './wikipedia-qids.js';

const USAGE = `Usage: profiles <finalize|verify|audit|translate|evidence|english-adversarial|english-audit|english-repair|russian-translation|russian-audit> [flags]
  finalize  [--qids=Q1,Q2,...] [--run-id=<id>]
  verify    --qids=Q1,Q2,... [--repair] [--force] [--model=<OpenAI id>] [--adversarial-model=<OpenAI id>] [--no-adversarial] [--audit-provider=${PROVIDERS.join('|')}] [--audit-model=<id>] [--translation-model=<OpenAI id>]
  audit     --qids=Q1,Q2,... [--provider=${PROVIDERS.join('|')}] [--model=<id>]
  translate --qids=Q1,Q2,... [--force] [--provider=${PROVIDERS.join('|')}] [--model=<id>] [--audit-model=<id>]
  evidence --url=<https URL> [--query=<text>] [--offset=<number>] [--refresh]
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
  if (command === 'finalize') await finalize(argv);
  else if (command === 'verify') await verify(argv);
  else if (command === 'audit') await audit(argv);
  else if (command === 'translate') await translate(argv);
  else if (!(await runCoordinatorCommand(command, argv)))
    throw new Error(USAGE);
}

async function verify(argv: readonly string[]): Promise<void> {
  const unknown = argv.find(
    (arg) =>
      !['--repair', '--force', '--no-adversarial'].includes(arg) &&
      ![
        '--qids=',
        '--model=',
        '--adversarial-model=',
        '--audit-model=',
        '--audit-provider=',
        '--translation-model=',
      ].some((prefix) => arg.startsWith(prefix)),
  );
  if (unknown)
    throw new Error(`Unknown verification flag: ${unknown}\n${USAGE}`);
  const qids = parseQidsFlag(argv);
  if (!qids)
    throw new Error(
      `--qids is required: verification runs per chosen batch\n${USAGE}`,
    );
  const models = routeVerificationModels(argv);
  const stored = await readStoredProfiles(RAW_PROFILES_DIR);
  const subjects = new Map(
    loadSubjects().map((subject) => [subject.qid, subject]),
  );
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
        ...models,
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
          complete: models.complete,
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
  const { provider, complete } = routeProfileModels('audit', argv);
  const stored = await readStoredProfiles(RAW_PROFILES_DIR);
  const subjects = new Map(
    loadSubjects().map((subject) => [subject.qid, subject]),
  );
  for (const qid of qids) {
    try {
      const entry = stored.get(qid);
      const subject = subjects.get(qid);
      if (!entry || !subject)
        throw new Error('No raw Profile or dataset entity for this QID');
      const result = await auditSavedProfile(entry.filePath, subject, complete);
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
      !['--qids=', '--provider=', '--model=', '--audit-model='].some((prefix) =>
        arg.startsWith(prefix),
      ),
  );
  if (unknown)
    throw new Error(`Unknown translation flag: ${unknown}\n${USAGE}`);
  const qids = parseQidsFlag(argv);
  if (!qids) throw new Error(`--qids is required\n${USAGE}`);
  const { complete } = routeProfileModels('translate', argv);
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
