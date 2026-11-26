import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { DETAIL_LEVEL_FAME_SCORE_FLOORS } from '@o-tempora/shared-types';
import { parseModelProfile } from './model-profile.ts';
import {
  readCompletedRepairs,
  readPendingAssessmentState,
} from './pending-state.ts';
import { readStoredProfiles, type StoredProfile } from './store.ts';
import { formatDates, type ProfileSubject } from './subjects.ts';
import { asRecord } from './values.ts';
import { profileHash, readProfileApproval } from './verification/approval.ts';
import { parseAssessment } from './verification/assessment.ts';
import { reportPathFor } from './verification/runner.ts';

const COMMANDS = {
  missing: ['prefetch', 'write'],
  staged: ['validate', 'finalize'],
  'draft-pending-audit': ['english-audit'],
  'english-held': ['english-repair'],
  'english-approved': ['done'],
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

export async function readOptionalJson(file: string): Promise<unknown> {
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
    const { validateProfile } = await import('./validate.ts');
    const validation = await validateProfile({
      qid,
      subject,
      profilesDir,
      filePath: incoming,
    });
    return {
      qid,
      stage: 'staged',
      next_command: validation.ok ? 'finalize' : 'validate',
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
  parseModelProfile(record, filePath);
  const profile_hash = profileHash(record);
  const dates = formatDates(subject.dateSpan);
  const saved = await readOptionalJson(reportPathFor(filePath));
  const report =
    saved && typeof saved === 'object' && !Array.isArray(saved)
      ? asRecord(saved, 'verification report')
      : undefined;
  const approval = readProfileApproval(record, report);
  const pending = await readPendingAssessmentState(profilesDir, qid, record);
  if (!pending && approval?.isCurrentFor(dates)) {
    return { qid, stage: 'english-approved', next_command: 'done' };
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
    typeof currentReport?.policy_version === 'string' &&
    currentReport.policy_version.length > 0 &&
    Array.isArray(currentReport.blockers) &&
    currentReport.blockers.length
  ) {
    const edited = stored.status === 'edited';
    const repairs = await readCompletedRepairs(profilesDir, qid, record);
    return {
      qid,
      stage: 'english-held',
      next_command: 'english-repair',
      edited,
      remaining_draft_repairs: 2 - repairs,
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
  return {
    qid,
    stage: 'draft-pending-audit',
    next_command: 'english-audit',
    ...(savedAssessment
      ? reason
        ? { reason }
        : {}
      : {
          reason: [
            reason,
            'No saved assessment for this draft; re-stage and finalize',
          ]
            .filter(Boolean)
            .join('. '),
        }),
  };
}

export function selectStatusSubjects({
  qids,
  scope,
  defaultScope,
  limit,
  subjects,
}: {
  qids?: ReadonlySet<string>;
  scope?: ProfileScope;
  defaultScope: ProfileScope;
  limit?: number;
  subjects: readonly ProfileSubject[];
}): ProfileSubject[] {
  if (qids && scope)
    throw new Error('--qids and --scope are mutually exclusive');
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1))
    throw new Error('--limit must be a positive integer');
  const selectedScope = parseProfileScope(scope) ?? defaultScope;
  const byQid = new Map(subjects.map((subject) => [subject.qid, subject]));
  return qids
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
  const selected = selectStatusSubjects({
    qids,
    scope,
    defaultScope: 'mainstream',
    limit,
    subjects,
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
