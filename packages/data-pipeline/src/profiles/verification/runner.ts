import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { extractAssessedProfile } from '../assessed-profile.js';
import {
  type ModelProfile,
  PROFILE_SCHEMA_VERSION,
  parseModelProfile,
} from '../model-profile.js';
import { writeJson } from '../store.js';
import { formatDates, type ProfileSubject } from '../subjects.js';
import { asRecord } from '../values.js';
import type { ResolveArticleQids } from '../wikipedia-qids.js';
import {
  type AdversarialResult,
  mergeAdversarialResult,
} from './adversarial.js';
import { evidenceChecks, mechanicalChecks } from './mechanical.js';
import {
  type Assessment,
  blockers,
  checkEvidence,
  hash,
  POLICY_VERSION,
  parseAudit,
  profileHash,
  type Report,
  readProfileApproval,
  type Source,
} from './policy.js';
export interface EnglishAuditOptions {
  filePath: string;
  subject: ProfileSubject;
  assessment: Assessment;
  researcherModel: string;
  adversarial?: AdversarialResult;
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
  const qids = await resolve(
    repaired.connections.map((item) => item.wikipedia_url),
  );
  return replaceProfile(record, repaired, qids);
}

export function completedRepairs(record: Record<string, unknown>): number {
  const checkpoint = asRecord(record.meta, 'meta').coordinator_repair;
  if (checkpoint === undefined) return 0;
  const { profile_hash, count } = asRecord(checkpoint, 'repair checkpoint');
  return profile_hash === profileHash(record) && (count === 1 || count === 2)
    ? count
    : 0;
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
  status: 'draft' | 'evidence-only' | 'proposal';
  filePath: string;
}> {
  const { filePath, subject, record, report } = options;
  const repairs = completedRepairs(record);
  const current = parseModelProfile(record, filePath);
  const { profile, assessment } = extractAssessedProfile(options.result);
  const changed = hash(profile) !== hash(current);
  if (changed && repairs >= 2)
    throw new Error('English draft repair limit reached');
  if (!changed && hash(assessment) === hash(report.assessment))
    throw new Error('Repair did not change the draft or assessment');
  const next = changed
    ? await applyRepair(record, current, profile, options.resolve)
    : record;
  const originalHash = profileHash(record);
  const candidateHash = profileHash(next);
  if (
    hash(await readJson(filePath)) !== hash(record) ||
    hash(await readJson(reportPathFor(filePath))) !== hash(report)
  )
    throw new Error('Profile or report changed during repair');
  const root = path.join(path.dirname(filePath), '..');
  const { pending_adversarial: _adversarial, ...meta } = asRecord(
    record.meta,
    'meta',
  );
  const pending = {
    profile_hash: candidateHash,
    assessment,
    model: options.model,
  };
  if (!changed) {
    await writeJson(filePath, {
      ...record,
      meta: { ...meta, pending_assessment: pending },
    });
    return { status: 'evidence-only', filePath };
  }
  const review = asRecord(meta.review, 'review');
  if (review.status === 'edited') {
    const proposalPath = path.join(root, 'proposals', path.basename(filePath));
    await writeJson(proposalPath, {
      original_hash: originalHash,
      proposed: next,
      blockers: report.blockers,
      assessment,
    });
    return { status: 'proposal', filePath: proposalPath };
  }
  await writeJson(
    path.join(
      root,
      'verification-history',
      subject.qid,
      `${originalHash}.json`,
    ),
    { profile: record, report },
  );
  const { approval: _approval, ...reviewFields } = review;
  await writeJson(filePath, {
    ...next,
    meta: {
      ...meta,
      schema_version: PROFILE_SCHEMA_VERSION,
      pending_assessment: pending,
      coordinator_repair: { profile_hash: candidateHash, count: repairs + 1 },
      review: { ...reviewFields, status: 'draft', reviewed_at: null },
    },
  });
  return { status: 'draft', filePath };
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
  const { subject, adversarial, snapshots } = options;
  const now = (options.now ?? new Date()).toISOString();
  const assessment = adversarial
    ? mergeAdversarialResult(options.assessment, adversarial)
    : options.assessment;
  const mechanical = await mechanicalChecks(
    record,
    profile,
    subject,
    options.resolve,
  );
  mechanical.push(...evidenceChecks(profile, subject, assessment, snapshots));
  const base = {
    policy_version: POLICY_VERSION,
    profile_hash: profileHash(record),
    verified_at: now,
    subject: { qid: subject.qid, dates },
    models: adversarial
      ? [options.researcherModel, adversarial.model, options.auditModel]
      : [options.researcherModel, options.auditModel],
    assessment,
    ...(adversarial ? { adversarial } : {}),
    audit: parseAudit(options.audit),
    sources: snapshots.map(({ id, url, fetched_at }) => ({
      id,
      url,
      fetched_at,
    })),
    evidence_errors: checkEvidence(assessment, snapshots),
    mechanical,
    repairs: options.repairs ?? 0,
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
      path.join(
        path.dirname(options.filePath),
        '..',
        'evidence',
        `${source.id}.json`,
      ),
      source,
    );
  }
  await writeJson(reportPath, report);
  await writeJson(options.filePath, { ...record, meta: nextMeta });
  return {
    status: approved ? 'approved' : 'held',
    blockers: report.blockers,
    reportPath,
  };
}
