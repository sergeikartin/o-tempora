import { fileURLToPath } from 'node:url';
import { applyProfilePatch } from './patch.ts';
import { RAW_PROFILES_DIR, SOURCES_DIR, WORK_DIR, workFile } from './paths.ts';
import {
  formatZodIssues,
  ProfileDraftSchema,
  type ProfileHarness,
  ProfileHarnessSchema,
  type ProfileLocale,
  ProfileLocaleSchema,
} from './schemas.ts';
import { fetchSource, readSourceIndex } from './sources.ts';
import {
  findCommittedProfile,
  readJsonIfExists,
  writeJsonFile,
} from './store.ts';
import { findEntities, loadSubjects } from './subjects.ts';
import { validateCheck, validateDraft, validatePatch } from './validate.ts';
import {
  getProfileStatus,
  type ProfileStage,
  prepareProfiles,
  promoteProfile,
  type StatusScope,
} from './workflow.ts';

interface ParsedArgs {
  positional: string[];
  flags: Record<string, string | true>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq === -1) {
        flags[arg.slice(2)] = true;
      } else {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function flagString(
  flags: Record<string, string | true>,
  name: string,
): string | undefined {
  const value = flags[name];
  return typeof value === 'string' ? value : undefined;
}

function parseLocale(flags: Record<string, string | true>): ProfileLocale {
  const raw = flagString(flags, 'locale') ?? 'en';
  const parsed = ProfileLocaleSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid --locale="${raw}" (expected "en" or "ru")`);
  }
  return parsed.data;
}

function parseQidList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseHarness(
  flags: Record<string, string | true>,
): ProfileHarness | undefined {
  const raw = flagString(flags, 'harness');
  if (raw === undefined) return undefined;
  const parsed = ProfileHarnessSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid --harness="${raw}" (expected "codex", "claude", or "agy")`,
    );
  }
  return parsed.data;
}

const HELP = `Usage: npm run profiles --workspace packages/data-pipeline -- <command> [options]

Commands:
  status [--locale=en|ru] [--scope=legendary|mainstream|all] [--stage=...] [--qids=Q1,Q2] [--limit=N]
  prepare --qids=Q1,Q2 [--locale=en|ru] [--refresh]
  fetch-source <url> [--refresh]
  find-entity <query...> [--limit=N]
  validate <qid> [--locale=en|ru] [--kind=draft|patch|check|recheck] [--file=<path>]
  apply-patch <qid> [--locale=en|ru]
  promote <qid> [--locale=en|ru] [--writer-model=<id>] [--checker-model=<id>] [--harness=codex|claude|agy] [--force] [--human-approved]`;

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h') {
    console.log(HELP);
    return;
  }

  const { positional, flags } = parseArgs(rest);

  switch (command) {
    case 'status': {
      const locale = parseLocale(flags);
      const scopeRaw = flagString(flags, 'scope') ?? 'mainstream';
      if (
        scopeRaw !== 'legendary' &&
        scopeRaw !== 'mainstream' &&
        scopeRaw !== 'all'
      ) {
        throw new Error(`Invalid --scope="${scopeRaw}"`);
      }
      const qids = parseQidList(flagString(flags, 'qids'));
      const stageRaw = flagString(flags, 'stage');
      const stages = stageRaw
        ? (stageRaw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean) as ProfileStage[])
        : undefined;
      const limitRaw = flagString(flags, 'limit');
      const limit = limitRaw !== undefined ? Number(limitRaw) : undefined;
      if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
        throw new Error(`Invalid --limit="${limitRaw}"`);
      }
      const subjects = loadSubjects({ readOnly: true });
      const result = await getProfileStatus({
        locale,
        scope: scopeRaw as StatusScope,
        qids: qids.length > 0 ? qids : undefined,
        stages,
        limit,
        subjects,
      });
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    case 'prepare': {
      const locale = parseLocale(flags);
      const qids = [...parseQidList(flagString(flags, 'qids')), ...positional];
      if (qids.length === 0) {
        throw new Error('prepare requires --qids=Q1,Q2 or positional QIDs');
      }
      const subjects = loadSubjects();
      const result = await prepareProfiles({
        qids,
        locale,
        subjects,
        refresh: flags.refresh === true,
      });
      console.log(JSON.stringify({ locale, prepared: result }, null, 2));
      return;
    }

    case 'fetch-source': {
      const url = positional[0] ?? flagString(flags, 'url');
      if (!url) throw new Error('fetch-source requires a URL');
      const summary = await fetchSource(url, {
        sourcesDir: SOURCES_DIR,
        refresh: flags.refresh === true,
      });
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    case 'find-entity': {
      if (positional.length === 0) {
        throw new Error('find-entity requires one or more search queries');
      }
      const limitRaw = flagString(flags, 'limit');
      const limit = limitRaw !== undefined ? Number(limitRaw) : 5;
      const subjects = loadSubjects();
      const results = Object.fromEntries(
        positional.map((query) => [
          query,
          findEntities(subjects, query, limit),
        ]),
      );
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    case 'validate': {
      const qid = positional[0] ?? flagString(flags, 'qid');
      const locale = parseLocale(flags);
      const kind = flagString(flags, 'kind') ?? 'draft';
      const explicitFile = flagString(flags, 'file');
      if (!qid && !explicitFile) {
        throw new Error('validate requires <qid> or --file=<path>');
      }
      const filePath =
        explicitFile ??
        workFile(
          qid as string,
          kind === 'draft'
            ? `${locale}.draft.json`
            : kind === 'patch'
              ? `${locale}.patch.json`
              : kind === 'recheck'
                ? `${locale}.recheck.json`
                : `${locale}.check.json`,
          WORK_DIR,
        );
      const raw = await readJsonIfExists(filePath);
      if (raw === undefined) {
        throw new Error(`File not found: ${filePath}`);
      }

      if (kind === 'patch') {
        const result = validatePatch(raw);
        console.log(
          JSON.stringify(
            { ok: result.ok, kind, filePath, issues: result.issues },
            null,
            2,
          ),
        );
        if (!result.ok) process.exitCode = 1;
        return;
      }

      if (kind === 'check' || kind === 'recheck') {
        const result = validateCheck(raw, qid ? { qid, locale } : undefined);
        console.log(
          JSON.stringify(
            { ok: result.ok, kind, filePath, issues: result.issues },
            null,
            2,
          ),
        );
        if (!result.ok) process.exitCode = 1;
        return;
      }

      if (kind !== 'draft') {
        throw new Error(
          `Unknown --kind="${kind}" (expected draft|patch|check|recheck)`,
        );
      }

      const subjects = loadSubjects();
      const subjectByQid = new Map(subjects.map((s) => [s.qid, s]));
      const targetQid =
        qid ??
        (raw &&
        typeof raw === 'object' &&
        'qid' in raw &&
        typeof raw.qid === 'string'
          ? raw.qid
          : undefined);
      const subject = targetQid ? subjectByQid.get(targetQid) : undefined;
      if (!subject) {
        throw new Error(`Unknown dataset QID: ${targetQid ?? '(missing)'}`);
      }
      const sourceIndex =
        locale === 'en' ? await readSourceIndex(SOURCES_DIR) : undefined;
      const englishProfile =
        locale === 'ru'
          ? (await findCommittedProfile(subject.qid, 'en', RAW_PROFILES_DIR))
              ?.profile
          : undefined;
      const result = validateDraft(raw, {
        locale,
        subject,
        subjectByQid,
        sourceIndex,
        englishProfile,
      });
      console.log(
        JSON.stringify(
          {
            ok: result.ok,
            kind,
            qid: subject.qid,
            locale,
            filePath,
            issues: result.issues,
          },
          null,
          2,
        ),
      );
      if (!result.ok) process.exitCode = 1;
      return;
    }

    case 'apply-patch': {
      const qid = positional[0] ?? flagString(flags, 'qid');
      if (!qid) throw new Error('apply-patch requires <qid>');
      const locale = parseLocale(flags);
      const draftPath = workFile(qid, `${locale}.draft.json`, WORK_DIR);
      const checkPath = workFile(qid, `${locale}.check.json`, WORK_DIR);
      const patchPath = workFile(qid, `${locale}.patch.json`, WORK_DIR);

      const [draftRaw, checkRaw, patchRaw] = await Promise.all([
        readJsonIfExists(draftPath),
        readJsonIfExists(checkPath),
        readJsonIfExists(patchPath),
      ]);
      if (draftRaw === undefined)
        throw new Error(`Missing draft: ${draftPath}`);
      if (checkRaw === undefined)
        throw new Error(`Missing check: ${checkPath}`);
      if (patchRaw === undefined)
        throw new Error(`Missing patch: ${patchPath}`);

      const checkResult = validateCheck(checkRaw, { qid, locale });
      if (!checkResult.ok || !checkResult.data) {
        throw new Error(
          `Invalid check verdict: ${checkResult.issues.join('; ')}`,
        );
      }
      const patchResult = validatePatch(patchRaw);
      if (!patchResult.ok || !patchResult.data) {
        throw new Error(`Invalid patch: ${patchResult.issues.join('; ')}`);
      }

      const subjects = loadSubjects();
      const subjectByQid = new Map(subjects.map((s) => [s.qid, s]));
      const subject = subjectByQid.get(qid);
      if (!subject) throw new Error(`Unknown dataset QID: ${qid}`);

      const initialDraft = ProfileDraftSchema.safeParse(draftRaw);
      if (!initialDraft.success) {
        throw new Error(
          `Invalid base draft: ${formatZodIssues(initialDraft.error).join('; ')}`,
        );
      }

      const { draft: merged, patchedPaths } = applyProfilePatch(
        initialDraft.data,
        checkResult.data,
        patchResult.data,
      );

      const sourceIndex =
        locale === 'en' ? await readSourceIndex(SOURCES_DIR) : undefined;
      const englishProfile =
        locale === 'ru'
          ? (await findCommittedProfile(qid, 'en', RAW_PROFILES_DIR))?.profile
          : undefined;

      const postValidation = validateDraft(merged, {
        locale,
        subject,
        subjectByQid,
        sourceIndex,
        englishProfile,
      });
      if (!postValidation.ok) {
        console.log(
          JSON.stringify(
            {
              ok: false,
              qid,
              locale,
              patchedPaths,
              issues: postValidation.issues,
            },
            null,
            2,
          ),
        );
        process.exitCode = 1;
        return;
      }

      await writeJsonFile(draftPath, merged);
      console.log(
        JSON.stringify(
          { ok: true, qid, locale, patchedPaths, draftPath },
          null,
          2,
        ),
      );
      return;
    }

    case 'promote': {
      const qid = positional[0] ?? flagString(flags, 'qid');
      if (!qid) throw new Error('promote requires <qid>');
      const locale = parseLocale(flags);
      const harness = parseHarness(flags);
      const subjects = loadSubjects();
      const result = await promoteProfile({
        qid,
        locale,
        subjects,
        force: flags.force === true,
        humanApproved: flags['human-approved'] === true,
        writerModel: flagString(flags, 'writer-model'),
        checkerModel: flagString(flags, 'checker-model'),
        harness,
      });
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    default:
      throw new Error(
        `Unknown command "${command}". Run with --help for usage.`,
      );
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
