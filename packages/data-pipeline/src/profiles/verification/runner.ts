import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { extractRepairResult } from '../assessed-profile.ts';
import {
  type ModelProfile,
  PROFILE_SCHEMA_VERSION,
  parseModelProfile,
} from '../model-profile.ts';
import {
  clearPendingState,
  readCompletedRepairs,
  writePendingState,
} from '../pending-state.ts';
import { writeJson } from '../store.ts';
import { formatDates, type ProfileSubject } from '../subjects.ts';
import { asRecord } from '../values.ts';
import type { ResolveArticleQids } from '../wikipedia-qids.ts';
import { evidenceChecks, mechanicalChecks } from './mechanical.ts';
import {
  type Assessment,
  blockers,
  checkEvidence,
  hash,
  POLICY_VERSION,
  parseAssessment,
  parseAudit,
  profileHash,
  type Report,
  readProfileApproval,
  type Source,
  strings,
} from './policy.ts';
export interface EnglishAuditOptions {
  filePath: string;
  subject: ProfileSubject;
  assessment: Assessment;
  researcherModel: string;
  audit: unknown;
  auditModel: string;
  snapshots: readonly Source[];
  resolve: ResolveArticleQids;
  expectedRecordHash?: string;
  repairs?: number;
  now?: Date;
  force?: boolean;
}

export interface VerifyResult {
  status: 'approved' | 'held' | 'skipped';
  blockers: string[];
  reportPath: string;
}

export function reportPathFor(filePath: string): string {
  return filePath.replace(/\.json$/, '.verification.json');
}

async function readJson(filePath: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

function replaceProfile(
  record: Record<string, unknown>,
  profile: ModelProfile,
  qids: Map<string, string>,
): Record<string, unknown> {
  return {
    ...record,
    ...profile,
    connections: profile.connections.map((connection) => ({
      ...connection,
      qid: qids.get(connection.wikipedia_url),
    })),
    meta: {
      ...asRecord(record.meta, 'meta'),
      schema_version: PROFILE_SCHEMA_VERSION,
    },
  };
}

async function applyRepair(
  record: Record<string, unknown>,
  profile: ModelProfile,
  repaired: ModelProfile,
  resolve: ResolveArticleQids,
): Promise<Record<string, unknown>> {
  if (
    repaired.subject !== profile.subject ||
    repaired.type !== profile.type ||
    repaired.wikipedia_url !== profile.wikipedia_url
  )
    throw new Error('Repair changed subject identity');
  // Repair cannot introduce a new Connection or silently redirect an existing
  // one. New relationships belong in a fresh writer run.
  const originalUrls = new Set(
    profile.connections.map((item) => item.wikipedia_url),
  );
  if (
    repaired.connections.some((item) => !originalUrls.has(item.wikipedia_url))
  )
    throw new Error('Repair introduced a new Connection');
  const qids = new Map<string, string>();
  const rawConnections = Array.isArray(record.connections)
    ? record.connections
    : [];
  for (const item of rawConnections) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as Record<string, unknown>).wikipedia_url === 'string' &&
      typeof (item as Record<string, unknown>).qid === 'string'
    ) {
      qids.set(
        (item as Record<string, unknown>).wikipedia_url as string,
        (item as Record<string, unknown>).qid as string,
      );
    }
  }
  const missing = repaired.connections
    .map((item) => item.wikipedia_url)
    .filter((url) => !qids.has(url));
  if (missing.length) {
    for (const [url, qid] of await resolve(missing)) qids.set(url, qid);
  }
  return replaceProfile(record, repaired, qids);
}

export async function checkpointEnglishRepair(options: {
  filePath: string;
  subject: ProfileSubject;
  record: Record<string, unknown>;
  report: Record<string, unknown>;
  result: unknown;
  model: string;
  resolve: ResolveArticleQids;
}): Promise<{
  status: 'draft' | 'evidence-only';
  filePath: string;
}> {
  const { filePath, subject, record, report } = options;
  const profilesDir = path.join(path.dirname(filePath), '..');
  const repairs = await readCompletedRepairs(profilesDir, subject.qid, record);
  const current = parseModelProfile(record, filePath);
  const currentAssessment = parseAssessment(report.assessment);
  const { profile, assessment, repairedPaths } = extractRepairResult(
    current,
    currentAssessment,
    options.result,
  );
  const changed = hash(profile) !== hash(current);
  if (changed && repairs >= 2)
    throw new Error('English draft repair limit reached');
  if (!changed && hash(assessment) === hash(currentAssessment))
    throw new Error('Repair did not change the draft or assessment');
  const {
    pending_assessment: _pending,
    pending_adversarial: _adversarial,
    coordinator_repair: _repair,
    ...meta
  } = asRecord(record.meta, 'meta');
  const review = asRecord(meta.review, 'review');
  if (changed && review.status === 'edited')
    throw new Error(
      'Cannot modify protected edited Profile prose during repair',
    );
  const next = changed
    ? await applyRepair(record, current, profile, options.resolve)
    : record;
  const candidateHash = profileHash(next);
  if (
    hash(await readJson(filePath)) !== hash(record) ||
    hash(await readJson(reportPathFor(filePath))) !== hash(report)
  )
    throw new Error('Profile or report changed during repair');
  const nextRepairs = changed ? repairs + 1 : repairs;
  if (changed) {
    const { approval: _approval, ...reviewFields } = review;
    await writeJson(filePath, {
      ...next,
      meta: {
        ...meta,
        schema_version: PROFILE_SCHEMA_VERSION,
        review: { ...reviewFields, status: 'draft', reviewed_at: null },
      },
    });
  }
  await writePendingState(profilesDir, subject.qid, {
    profile_hash: candidateHash,
    assessment,
    model: options.model,
    repaired_paths: repairedPaths,
    prior_blockers: strings(report.blockers, 'blockers'),
    repairs: nextRepairs,
  });
  return { status: changed ? 'draft' : 'evidence-only', filePath };
}

export async function applyEnglishAudit(
  options: EnglishAuditOptions,
): Promise<VerifyResult> {
  const record = asRecord(await readJson(options.filePath), options.filePath);
  const originalHash = hash(record);
  if (options.expectedRecordHash && options.expectedRecordHash !== originalHash)
    throw new Error('Profile changed during audit apply; prepare a fresh task');
  const reportPath = reportPathFor(options.filePath);
  const oldReport = await readJson(reportPath).catch((error: unknown) => {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  });
  const profile = parseModelProfile(record, options.filePath);
  const dates = formatDates(options.subject.dateSpan);
  if (
    !options.force &&
    readProfileApproval(record, oldReport, profile)?.isCurrentFor(dates)
  ) {
    return { status: 'skipped', blockers: [], reportPath };
  }
  const meta = asRecord(record.meta, 'meta');
  const protectedEdit = asRecord(meta.review, 'review').status === 'edited';
  const { subject, assessment, snapshots } = options;
  const profilesDir = path.join(path.dirname(options.filePath), '..');
  const now = (options.now ?? new Date()).toISOString();
  const mechanical = await mechanicalChecks(
    record,
    profile,
    subject,
    options.resolve,
  );
  mechanical.push(...evidenceChecks(profile, subject, assessment, snapshots));
  const repairs = options.repairs ?? 0;
  const base = {
    policy_version: POLICY_VERSION,
    profile_hash: profileHash(record),
    verified_at: now,
    subject: { qid: subject.qid, dates },
    models: [options.researcherModel, options.auditModel],
    assessment,
    audit: parseAudit(options.audit),
    sources: snapshots.map(({ id, url, fetched_at }) => ({
      id,
      url,
      fetched_at,
    })),
    evidence_errors: checkEvidence(assessment, snapshots),
    mechanical,
    repairs,
  };
  const report: Report = { ...base, blockers: blockers(base, profile) };

  // A user edit made while network calls were running wins. Neither the report
  // nor its receipt is installed against a different on-disk record.
  if (hash(await readJson(options.filePath)) !== originalHash)
    throw new Error(
      'Profile changed during verification; retry without overwriting the edit',
    );
  const review = asRecord(meta.review, 'review');
  const approved = report.blockers.length === 0;
  const { approval: _oldApproval, ...reviewFields } = review;
  const {
    pending_assessment: _pending,
    pending_adversarial: _adversarial,
    coordinator_repair: _repair,
    ...savedMeta
  } = asRecord(record.meta, 'meta');
  const nextMeta = {
    ...savedMeta,
    review: {
      ...reviewFields,
      status: protectedEdit ? 'edited' : approved ? 'reviewed' : 'draft',
      reviewed_at: approved ? now : null,
      ...(approved
        ? {
            approval: {
              policy_version: POLICY_VERSION,
              profile_hash: report.profile_hash,
              report_hash: hash(report),
              method: 'automatic',
            },
          }
        : {}),
    },
  };
  // Report first, receipt second: a partial write can only withhold publishing.
  for (const source of snapshots) {
    await writeJson(
      path.join(profilesDir, 'evidence', `${source.id}.json`),
      source,
    );
  }
  await writeJson(reportPath, report);
  await writeJson(options.filePath, { ...record, meta: nextMeta });
  if (approved || repairs === 0) {
    await clearPendingState(profilesDir, subject.qid);
  } else {
    await writePendingState(profilesDir, subject.qid, {
      profile_hash: report.profile_hash,
      repairs,
    });
  }
  return {
    status: approved ? 'approved' : 'held',
    blockers: report.blockers,
    reportPath,
  };
}
