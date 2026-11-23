import path from 'node:path';
import type { StoredProfile } from './store.js';
import type { ProfileSubject } from './subjects.js';

export type SkipReason = 'current' | 'stale' | 'edited';

export type PlanEntry =
  | {
      kind: 'write';
      subject: ProfileSubject;
      outputPath: string;
    }
  | { kind: 'skip'; subject: ProfileSubject; reason: SkipReason };

export interface PlanOptions {
  currentPromptHash: string;
  regenerateStale: boolean;
  incomingDir: string;
}

export function incomingPath(incomingDir: string, qid: string): string {
  return path.join(incomingDir, `${qid}.json`);
}

// An `edited` record is hand-fixed and never planned, stale or not. A record at
// the current prompt is done. A stale one is regenerated only on request,
// since doing so resets its review status to draft.
export function planProfiles(
  subjects: readonly ProfileSubject[],
  stored: ReadonlyMap<string, StoredProfile>,
  options: PlanOptions,
): PlanEntry[] {
  return subjects.map((subject): PlanEntry => {
    const existing = stored.get(subject.qid);
    const outputPath = incomingPath(options.incomingDir, subject.qid);
    if (!existing) {
      return { kind: 'write', subject, outputPath };
    }
    if (existing.status === 'edited') {
      return { kind: 'skip', subject, reason: 'edited' };
    }
    if (existing.promptHash === options.currentPromptHash) {
      return { kind: 'skip', subject, reason: 'current' };
    }
    return options.regenerateStale
      ? { kind: 'write', subject, outputPath }
      : { kind: 'skip', subject, reason: 'stale' };
  });
}
