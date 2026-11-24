import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { extractAssessedProfile } from '../assessed-profile.js';
import {
  type ModelProfile,
  PROFILE_SCHEMA_VERSION,
  parseModelProfile,
} from '../model-profile.js';
import { readPromptText } from '../prompt.js';
import type { Complete } from '../providers.js';
import { writeJson } from '../store.js';
import { formatDates, type ProfileSubject } from '../subjects.js';
import { asRecord, extractJson } from '../values.js';
import type { ResolveArticleQids } from '../wikipedia-qids.js';
import {
  AdversarialBudgetError,
  type AdversarialCheck,
  type AdversarialChecker,
  type AdversarialResult,
  mergeAdversarialResult,
  parseAdversarialResult,
  selectAdversarialTargets,
} from './adversarial.js';
import { evidenceChecks, mechanicalChecks } from './mechanical.js';
import {
  blockers,
  checkEvidence,
  hash,
  POLICY_VERSION,
  profileHash,
  type Report,
  readProfileApproval,
} from './policy.js';
import { auditProfile, type Research } from './researcher.js';
import { SourceStore } from './sources.js';

export interface VerifyOptions {
  filePath: string;
  subject: ProfileSubject;
  research: Research;
  adversarial?: AdversarialChecker;
  adversarialDisabled?: true;
  complete: Complete;
  resolve: ResolveArticleQids;
  repair: boolean;
  force?: boolean;
  sources?: SourceStore;
  now?: Date;
  repairs?: number;
  expectedRecordHash?: string;
  log?: (message: string) => void;
}

export interface VerifyResult {
  status: 'approved' | 'held' | 'skipped' | 'retry';
  blockers: string[];
  reportPath: string;
  proposalPath?: string;
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

export function englishRepairPrompt(
  profile: ModelProfile,
  report: unknown,
): string {
  return (
    readPromptText('profile-repair.md') + JSON.stringify({ profile, report })
  );
}

async function repairProfile(
  record: Record<string, unknown>,
  profile: ModelProfile,
  report: Report,
  options: VerifyOptions,
): Promise<Record<string, unknown>> {
  options.log?.(`${options.subject.qid}: repairing flagged passages`);
  const response = await options.complete(
    englishRepairPrompt(profile, report),
    'repair',
  );
  const repaired = parseModelProfile(extractJson(response.text), 'repair');
  if (hash(repaired) === hash(profile)) return record;
  return applyRepair(record, profile, repaired, options.resolve);
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

export async function verifyProfile(
  options: VerifyOptions,
): Promise<VerifyResult> {
  const original = asRecord(await readJson(options.filePath), options.filePath);
  const originalHash = hash(original);
  if (options.expectedRecordHash && options.expectedRecordHash !== originalHash)
    throw new Error('Profile changed during audit apply; prepare a fresh task');
  let record = original;
  const reportPath = reportPathFor(options.filePath);
  const oldReport = await readJson(reportPath).catch((error: unknown) => {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  });
  let profile = parseModelProfile(record, options.filePath);
  const dates = formatDates(options.subject.dateSpan);
  if (
    !options.force &&
    readProfileApproval(record, oldReport, profile)?.isCurrentFor(dates)
  ) {
    return { status: 'skipped', blockers: [], reportPath };
  }
  const meta = asRecord(record.meta, 'meta');
  const protectedEdit = asRecord(meta.review, 'review').status === 'edited';
  const sources = options.sources ?? new SourceStore();
  const now = (options.now ?? new Date()).toISOString();
  let repairs = options.repairs ?? 0;
  const cachedChecks = new Map<string, AdversarialCheck>();
  const budget = { turns: 0, searches: 0, reads: 0 };
  let adversarialModel: string | undefined;
  let adversarialRetry = false;
  let report: Report;
  let proposalPath: string | undefined;
  for (;;) {
    profile = parseModelProfile(record, options.filePath);
    options.log?.(
      `${options.subject.qid}: verifying${repairs ? ` repair ${repairs}` : ''}`,
    );
    const mechanical = await mechanicalChecks(
      record,
      profile,
      options.subject,
      options.resolve,
    );
    const result = await options.research(profile, options.subject, sources);
    const targets = selectAdversarialTargets(profile, result.assessment);
    let adversarial: AdversarialResult | undefined;
    if (options.adversarial && targets.length) {
      options.log?.(
        `${options.subject.qid}: checking high-risk claims for counterevidence`,
      );
      const uncached = targets.filter(
        ({ claim_hash }) => !cachedChecks.has(claim_hash),
      );
      try {
        const fresh = uncached.length
          ? await options.adversarial(
              profile,
              options.subject,
              result.assessment,
              uncached,
              sources,
              budget,
            )
          : undefined;
        const freshChecks = fresh
          ? parseAdversarialResult(fresh, uncached)
          : [];
        const freshByIndex = new Map(
          freshChecks.map((check) => [check.finding_index, check]),
        );
        const checks = targets.flatMap(
          ({ claim_hash, finding_index, path }) => {
            const check =
              freshByIndex.get(finding_index) ?? cachedChecks.get(claim_hash);
            return check ? [{ ...check, finding_index, path }] : [];
          },
        );
        if (fresh) adversarialModel = fresh.model;
        if (!adversarialModel) throw new Error('Missing adversarial model');
        adversarial = { model: adversarialModel, checks };
        for (const [index, target] of targets.entries()) {
          const check = checks[index];
          if (check) cachedChecks.set(target.claim_hash, check);
        }
      } catch (error) {
        if (
          !sources.failures.size &&
          !(error instanceof AdversarialBudgetError)
        )
          throw error;
        adversarialRetry = true;
        mechanical.push(error instanceof Error ? error.message : String(error));
      }
      if (sources.failures.size) {
        adversarialRetry = true;
        mechanical.push(
          'Adversarial source fetching failed; retry verification',
        );
      }
    }
    const assessment = adversarial
      ? mergeAdversarialResult(result.assessment, adversarial)
      : result.assessment;
    mechanical.push(
      ...evidenceChecks(profile, options.subject, assessment, sources.all()),
    );
    const evidenceErrors = checkEvidence(assessment, sources.all());
    options.log?.(
      `${options.subject.qid}: auditing claim coverage and evidence`,
    );
    const audited = await auditProfile(
      profile,
      options.subject,
      assessment,
      sources.all(),
      options.complete,
      adversarial?.checks,
    );
    const base = {
      policy_version: POLICY_VERSION,
      profile_hash: profileHash(record),
      verified_at: now,
      subject: { qid: options.subject.qid, dates },
      models: adversarial
        ? [result.model, adversarial.model, audited.model]
        : [result.model, audited.model],
      assessment,
      ...(adversarial ? { adversarial } : {}),
      ...(options.adversarialDisabled
        ? { adversarial_disabled: options.adversarialDisabled }
        : {}),
      audit: audited.audit,
      sources: sources
        .all()
        .map(({ id, url, fetched_at }) => ({ id, url, fetched_at })),
      evidence_errors: evidenceErrors,
      mechanical,
      repairs,
    };
    report = { ...base, blockers: blockers(base, profile) };
    if (!report.blockers.length || !options.repair || repairs === 2) break;
    // Infrastructure trouble is retryable and must never delete content merely
    // because the source could not be fetched today.
    if (
      adversarialRetry ||
      sources.failures.size > 0 ||
      (targets.length && !options.adversarial && !options.adversarialDisabled)
    )
      break;
    const next = await repairProfile(record, profile, report, options);
    if (protectedEdit) {
      proposalPath = path.join(
        path.dirname(options.filePath),
        '..',
        'proposals',
        path.basename(options.filePath),
      );
      await writeJson(proposalPath, {
        original_hash: profileHash(original),
        proposed: next,
        blockers: report.blockers,
      });
      break;
    }
    if (profileHash(next) === profileHash(record)) break;
    const history = path.join(
      path.dirname(options.filePath),
      '..',
      'verification-history',
      options.subject.qid,
      `${profileHash(record)}.json`,
    );
    await writeJson(history, { profile: record, report });
    record = next;
    repairs++;
  }

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
  for (const source of sources.all()) {
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
  const retry = !approved && (adversarialRetry || sources.failures.size > 0);
  return {
    status: approved ? 'approved' : retry ? 'retry' : 'held',
    blockers: report.blockers,
    reportPath,
    ...(proposalPath ? { proposalPath } : {}),
  };
}
