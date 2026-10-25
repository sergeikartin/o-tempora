import path from 'node:path';
import type { StoredProfile } from './store.js';
import { type ProfileSubject, SUBJECT_TYPE } from './subjects.js';

export type SkipReason = 'current' | 'stale' | 'edited';

export type PlanEntry =
  | {
      kind: 'write';
      subject: ProfileSubject;
      // Replaces an existing record made with an older prompt.
      regenerates: boolean;
      outputPath: string;
    }
  | { kind: 'skip'; subject: ProfileSubject; reason: SkipReason };

export interface PlanOptions {
  currentPromptHash: string;
  // Regenerate records whose `prompt_hash` is not the current one.
  regenerateStale: boolean;
  incomingDir: string;
}

// The staging path the profile-writer agent writes `subject` to.
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
      return { kind: 'write', subject, regenerates: false, outputPath };
    }
    if (existing.status === 'edited') {
      return { kind: 'skip', subject, reason: 'edited' };
    }
    if (existing.promptHash === options.currentPromptHash) {
      return { kind: 'skip', subject, reason: 'current' };
    }
    return options.regenerateStale
      ? { kind: 'write', subject, regenerates: true, outputPath }
      : { kind: 'skip', subject, reason: 'stale' };
  });
}

// The inputs the profile-writer agent is given, one block per entity to write.
export function formatPlan(entries: readonly PlanEntry[]): string {
  const lines: string[] = [];
  for (const entry of entries) {
    if (entry.kind !== 'write') continue;
    const { subject } = entry;
    lines.push(
      `${subject.qid}${entry.regenerates ? ' (regenerate)' : ''}`,
      `  type: ${SUBJECT_TYPE[subject.lane]}`,
      `  name: ${subject.name}`,
      `  dates: ${subject.dates}`,
      `  wikipedia_url: ${subject.wikipediaUrl}`,
      `  output: ${entry.outputPath}`,
    );
  }
  const skipped = entries.filter((entry) => entry.kind === 'skip');
  for (const entry of skipped) {
    lines.push(
      `skip ${entry.subject.qid} ${entry.subject.name}: ${entry.reason === 'stale' ? 'stale (--regenerate-stale to redo)' : entry.reason}`,
    );
  }
  const writes = entries.length - skipped.length;
  lines.push(`${writes} to write, ${skipped.length} skipped`);
  return lines.join('\n');
}
