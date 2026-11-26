import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { readPendingAssessment } from './assessed-profile.ts';
import { writeJson } from './store.ts';
import { asRecord, asString } from './values.ts';
import { profileHash } from './verification/approval.ts';
import {
  type Assessment,
  parseAssessment,
  strings,
} from './verification/assessment.ts';

export interface PendingAssessmentState {
  assessment: Assessment;
  model: string;
  repairedPaths?: string[];
  priorBlockers?: string[];
}

export interface PendingState {
  profile_hash: string;
  assessment?: Assessment;
  model?: string;
  repaired_paths?: string[];
  prior_blockers?: string[];
  repairs?: number;
}

export function pendingStatePath(profilesDir: string, qid: string): string {
  return path.join(profilesDir, 'tasks', qid, 'pending.json');
}

async function readPendingFile(
  profilesDir: string,
  qid: string,
): Promise<Record<string, unknown> | undefined> {
  try {
    return asRecord(
      JSON.parse(await readFile(pendingStatePath(profilesDir, qid), 'utf8')),
      'pending state',
    );
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code === 'ENOENT' ||
      error instanceof SyntaxError
    )
      return undefined;
    throw error;
  }
}

export async function readPendingAssessmentState(
  profilesDir: string,
  qid: string,
  record: Record<string, unknown>,
): Promise<PendingAssessmentState | undefined> {
  const expectedHash = profileHash(record);
  const file = await readPendingFile(profilesDir, qid);
  if (
    file &&
    file.profile_hash === expectedHash &&
    file.assessment !== undefined
  ) {
    return {
      assessment: parseAssessment(file.assessment),
      model: asString(file.model, 'pending assessment model'),
      ...(file.repaired_paths !== undefined
        ? { repairedPaths: strings(file.repaired_paths, 'repaired_paths') }
        : {}),
      ...(file.prior_blockers !== undefined
        ? { priorBlockers: strings(file.prior_blockers, 'prior_blockers') }
        : {}),
    };
  }
  return readPendingAssessment(record);
}

export async function readCompletedRepairs(
  profilesDir: string,
  qid: string,
  record: Record<string, unknown>,
): Promise<number> {
  const expectedHash = profileHash(record);
  const file = await readPendingFile(profilesDir, qid);
  if (file && file.profile_hash === expectedHash) {
    return file.repairs === 1 || file.repairs === 2 ? file.repairs : 0;
  }
  const checkpoint = asRecord(record.meta, 'meta').coordinator_repair;
  if (checkpoint === undefined) return 0;
  const { profile_hash, count } = asRecord(checkpoint, 'repair checkpoint');
  return profile_hash === expectedHash && (count === 1 || count === 2)
    ? count
    : 0;
}

export async function writePendingState(
  profilesDir: string,
  qid: string,
  state: PendingState,
): Promise<void> {
  await writeJson(pendingStatePath(profilesDir, qid), state);
}

export async function clearPendingState(
  profilesDir: string,
  qid: string,
): Promise<void> {
  await rm(pendingStatePath(profilesDir, qid), { force: true });
}
