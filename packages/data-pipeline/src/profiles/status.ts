import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { DETAIL_LEVEL_FAME_SCORE_FLOORS } from '@o-tempora/shared-types';
import {
  currentAdversarialCheckpoint,
  validateAdversarialEvidence,
} from './adversarial-checkpoint.js';
import { readPendingAssessment } from './assessed-profile.js';
import { parseModelProfile } from './model-profile.js';
import { preflightProfile } from './preflight.js';
import { readStoredProfiles, type StoredProfile } from './store.js';
import { formatDates, type ProfileSubject } from './subjects.js';
import {
  approvedTranslation,
  readTranslation,
  translationFeedback,
} from './translation.js';
import { asRecord } from './values.js';
import {
  parseAdversarialResult,
  selectAdversarialTargets,
} from './verification/adversarial.js';
import {
  isCurrentVerificationPolicy,
  parseAssessment,
  profileHash,
  readProfileApproval,
} from './verification/policy.js';
import { completedRepairs, reportPathFor } from './verification/runner.js';

const COMMANDS = {
  missing: ['prefetch', 'write'],
  staged: ['preflight', 'finalize'],
  'draft-pending-adversarial': ['english-adversarial'],
  'draft-pending-audit': ['english-audit'],
  'english-held': ['english-repair'],
  'english-approved': ['russian-translation'],
  'russian-held': ['russian-translation'],
  'bilingual-approved': ['done'],
} as const;

export type ProfileStage = keyof typeof COMMANDS;
export type ProfileScope = 'legendary' | 'mainstream' | 'all';

function isProfileStage(value: string): value is ProfileStage {
  return Object.hasOwn(COMMANDS, value);
}

export function parseProfileStages(
  value: string | undefined,
): ReadonlySet<ProfileStage> | undefined {
  if (value === undefined) return undefined;
  const stages = value.split(',').map((stage) => stage.trim());
  if (!stages.every(isProfileStage))
    throw new Error(
      `--stage must be a comma-separated list of: ${Object.keys(COMMANDS).join(', ')}`,
    );
  return new Set(stages);
}

export function parseProfileScope(
  value: string | undefined,
): ProfileScope | undefined {
  if (
    value === undefined ||
    value === 'legendary' ||
    value === 'mainstream' ||
    value === 'all'
  )
    return value;
  throw new Error('--scope must be legendary, mainstream, or all');
}
export type StatusItem = {
  [Stage in ProfileStage]: {
    qid: string;
    stage: Stage;
    next_command: (typeof COMMANDS)[Stage][number];
    reason?: string;
  } & (Stage extends 'missing'
    ? { prefetched: boolean }
    : Stage extends 'english-held'
      ? { edited: boolean; remaining_draft_repairs: number }
      : unknown);
}[ProfileStage];

async function readOptionalJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      (error as NodeJS.ErrnoException).code === 'ENOENT'
    )
      return undefined;
    throw error;
  }
}

async function hasFile(file: string) {
  try {
    return (await stat(file)).isFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function inspectSubject(
  subject: ProfileSubject,
  stored: StoredProfile | undefined,
  profilesDir: string,
  incomingDir: string,
): Promise<StatusItem> {
  const { qid } = subject;
  const incoming = path.join(incomingDir, `${qid}.json`);
  if (stored?.status !== 'edited' && (await hasFile(incoming))) {
    const preflight = await preflightProfile({
      qid,
      subject,
      profilesDir,
      filePath: incoming,
    });
    return {
      qid,
      stage: 'staged',
      next_command: preflight.ok ? 'finalize' : 'preflight',
    };
  }
  if (!stored) {
    const map = await readOptionalJson(
      path.join(profilesDir, 'evidence', 'prefetch', `${qid}.json`),
    );
    const sourceMap = map as { qid?: unknown; sources?: unknown } | undefined;
    const prefetched =
      sourceMap?.qid === qid &&
      Array.isArray(sourceMap.sources) &&
      sourceMap.sources.length > 0;
    return {
      qid,
      stage: 'missing',
      prefetched,
      next_command: prefetched ? 'write' : 'prefetch',
    };
  }

  const { filePath } = stored;
  const record = asRecord(await readOptionalJson(filePath), filePath);
  const profile = parseModelProfile(record, filePath);
  const profile_hash = profileHash(record);
  const dates = formatDates(subject.dateSpan);
  const saved = await readOptionalJson(reportPathFor(filePath));
  const report =
    saved && typeof saved === 'object' && !Array.isArray(saved)
      ? asRecord(saved, 'verification report')
      : undefined;
  const approval = readProfileApproval(record, report, profile);
  const pending = readPendingAssessment(record);
  if (!pending && approval?.isCurrentFor(dates)) {
    const translation = await readTranslation(filePath);
    if (approvedTranslation(translation, record))
      return { qid, stage: 'bilingual-approved', next_command: 'done' };
    const reason =
      translation === undefined
        ? undefined
        : 'Saved Russian translation does not approve the current English Profile';
    const stage = (await translationFeedback(filePath, record))
      ? 'russian-held'
      : 'english-approved';
    return {
      qid,
      stage,
      next_command: 'russian-translation',
      ...(reason ? { reason } : {}),
    };
  }

  const currentReport =
    report?.profile_hash === profile_hash ? report : undefined;
  const reportSubject = currentReport?.subject as
    | { dates?: unknown; qid?: unknown }
    | undefined;
  if (
    !pending &&
    reportSubject?.qid === qid &&
    reportSubject.dates === dates &&
    isCurrentVerificationPolicy(currentReport?.policy_version, dates) &&
    Array.isArray(currentReport?.blockers) &&
    currentReport.blockers.length
  ) {
    const edited = stored.status === 'edited';
    return {
      qid,
      stage: 'english-held',
      next_command: 'english-repair',
      edited,
      remaining_draft_repairs: 2 - completedRepairs(record),
    };
  }

  const reason =
    approval && !approval.isCurrentFor(dates)
      ? 'English approval was issued for different dataset dates'
      : report && !currentReport
        ? 'Verification report belongs to different English content'
        : undefined;
  const savedAssessment =
    pending?.assessment ??
    (currentReport?.assessment === undefined
      ? undefined
      : parseAssessment(currentReport.assessment));
  if (!savedAssessment) {
    return {
      qid,
      stage: 'draft-pending-adversarial',
      next_command: 'english-adversarial',
      reason: [reason, 'Prepare an assessment and supply it with --research']
        .filter(Boolean)
        .join('. '),
    };
  }

  const targets = selectAdversarialTargets(profile, savedAssessment);
  let readyForAudit = !targets.length;
  if (targets.length) {
    try {
      const checkpoint =
        currentAdversarialCheckpoint(record, savedAssessment) ??
        (pending ? undefined : currentReport?.adversarial);
      const result = asRecord(checkpoint, 'adversarial result');
      if (typeof result.model !== 'string' || !result.model.trim())
        throw new Error('Missing adversarial model');
      const checks = parseAdversarialResult(result, targets);
      await validateAdversarialEvidence(
        path.join(profilesDir, 'evidence'),
        checks,
        savedAssessment,
      );
      readyForAudit = true;
    } catch {
      // A missing, stale or incomplete checkpoint requires the adversarial step.
    }
  }
  return readyForAudit
    ? {
        qid,
        stage: 'draft-pending-audit',
        next_command: 'english-audit',
        ...(reason ? { reason } : {}),
      }
    : {
        qid,
        stage: 'draft-pending-adversarial',
        next_command: 'english-adversarial',
        ...(reason ? { reason } : {}),
      };
}

export async function inspectProfileStatus({
  qids,
  scope,
  stages,
  limit,
  subjects,
  profilesDir,
  incomingDir,
}: {
  qids?: ReadonlySet<string>;
  scope?: ProfileScope;
  stages?: ReadonlySet<ProfileStage>;
  limit?: number;
  subjects: readonly ProfileSubject[];
  profilesDir: string;
  incomingDir: string;
}): Promise<{ summary: Record<ProfileStage, number>; items: StatusItem[] }> {
  if (qids && scope)
    throw new Error('--qids and --scope are mutually exclusive');
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1))
    throw new Error('--limit must be a positive integer');
  const selectedScope = parseProfileScope(scope) ?? 'mainstream';
  const byQid = new Map(subjects.map((subject) => [subject.qid, subject]));
  const selected = qids
    ? [...qids].map((qid) => {
        const subject = byQid.get(qid);
        if (!subject) throw new Error(`${qid}: no dataset entity`);
        return subject;
      })
    : [...byQid.values()]
        .sort((a, b) => a.qid.localeCompare(b.qid))
        .filter((subject) => {
          if (selectedScope === 'all') return true;
          const { lane, fameScore } = subject;
          const level = selectedScope === 'legendary' ? 0 : 1;
          return (
            lane !== 'conflicts' &&
            fameScore !== undefined &&
            fameScore >= DETAIL_LEVEL_FAME_SCORE_FLOORS[lane][level]
          );
        });

  const stored = await readStoredProfiles(profilesDir);
  const items: StatusItem[] = [];
  const summary = Object.fromEntries(
    Object.keys(COMMANDS).map((stage) => [stage, 0]),
  ) as Record<ProfileStage, number>;
  for (const subject of selected) {
    const item = await inspectSubject(
      subject,
      stored.get(subject.qid),
      profilesDir,
      incomingDir,
    );
    if (stages && !stages.has(item.stage)) continue;
    items.push(item);
    summary[item.stage]++;
    if (items.length === limit) break;
  }
  return { summary, items };
}
