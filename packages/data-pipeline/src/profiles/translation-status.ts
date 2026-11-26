import { parseModelProfile } from './model-profile.ts';
import { readPendingAssessmentState } from './pending-state.ts';
import {
  type ProfileScope,
  readOptionalJson,
  selectStatusSubjects,
} from './status.ts';
import { readStoredProfiles, type StoredProfile } from './store.ts';
import { formatDates, type ProfileSubject } from './subjects.ts';
import {
  approvedTranslation,
  readTranslation,
  translationFeedback,
} from './translation.ts';
import { asRecord } from './values.ts';
import { readProfileApproval } from './verification/approval.ts';
import { reportPathFor } from './verification/runner.ts';

const TRANSLATION_COMMANDS = {
  'awaiting-english': ['none'],
  missing: ['russian-translation'],
  held: ['russian-translation'],
  approved: ['done'],
} as const;

export type TranslationStage = keyof typeof TRANSLATION_COMMANDS;

function isTranslationStage(value: string): value is TranslationStage {
  return Object.hasOwn(TRANSLATION_COMMANDS, value);
}

export function parseTranslationStages(
  value: string | undefined,
): ReadonlySet<TranslationStage> | undefined {
  if (value === undefined) return undefined;
  const stages = value.split(',').map((stage) => stage.trim());
  if (!stages.every(isTranslationStage))
    throw new Error(
      `--stage must be a comma-separated list of: ${Object.keys(TRANSLATION_COMMANDS).join(', ')}`,
    );
  return new Set(stages);
}

export type TranslationStatusItem = {
  [Stage in TranslationStage]: {
    qid: string;
    stage: Stage;
    next_command: (typeof TRANSLATION_COMMANDS)[Stage][number];
    reason?: string;
  };
}[TranslationStage];

async function inspectTranslationSubject(
  subject: ProfileSubject,
  stored: StoredProfile | undefined,
  profilesDir: string,
): Promise<TranslationStatusItem> {
  const { qid } = subject;
  if (!stored) {
    return {
      qid,
      stage: 'awaiting-english',
      next_command: 'none',
      reason: 'No English Profile',
    };
  }

  const { filePath } = stored;
  const record = asRecord(await readOptionalJson(filePath), filePath);
  parseModelProfile(record, filePath);
  const dates = formatDates(subject.dateSpan);
  const saved = await readOptionalJson(reportPathFor(filePath));
  const report =
    saved && typeof saved === 'object' && !Array.isArray(saved)
      ? asRecord(saved, 'verification report')
      : undefined;
  const approval = readProfileApproval(record, report);
  const pending = await readPendingAssessmentState(profilesDir, qid, record);

  if (pending || !approval?.isCurrentFor(dates)) {
    const reason = pending
      ? 'English Profile has pending unaudited changes'
      : approval && !approval.isCurrentFor(dates)
        ? 'English approval was issued for different dataset dates'
        : 'English Profile is not currently approved';
    return {
      qid,
      stage: 'awaiting-english',
      next_command: 'none',
      reason,
    };
  }

  const translation = await readTranslation(filePath);
  if (approvedTranslation(translation, record)) {
    return { qid, stage: 'approved', next_command: 'done' };
  }

  const reason =
    translation === undefined
      ? undefined
      : 'Saved Russian translation does not approve the current English Profile';
  const stage = (await translationFeedback(filePath, record))
    ? 'held'
    : 'missing';
  return {
    qid,
    stage,
    next_command: 'russian-translation',
    ...(reason ? { reason } : {}),
  };
}

export async function inspectTranslationStatus({
  qids,
  scope,
  stages,
  limit,
  subjects,
  profilesDir,
}: {
  qids?: ReadonlySet<string>;
  scope?: ProfileScope;
  stages?: ReadonlySet<TranslationStage>;
  limit?: number;
  subjects: readonly ProfileSubject[];
  profilesDir: string;
}): Promise<{
  summary: Record<TranslationStage, number>;
  items: TranslationStatusItem[];
}> {
  const selected = selectStatusSubjects({
    qids,
    scope,
    defaultScope: 'all',
    limit,
    subjects,
  });
  const stored = await readStoredProfiles(profilesDir);
  const includeAwaiting = Boolean(qids || stages?.has('awaiting-english'));
  const items: TranslationStatusItem[] = [];
  const summary = Object.fromEntries(
    Object.keys(TRANSLATION_COMMANDS).map((stage) => [stage, 0]),
  ) as Record<TranslationStage, number>;

  for (const subject of selected) {
    const entry = stored.get(subject.qid);
    if (!entry && !includeAwaiting) continue;
    const item = await inspectTranslationSubject(subject, entry, profilesDir);
    if (item.stage === 'awaiting-english' && !includeAwaiting) continue;
    if (stages && !stages.has(item.stage)) continue;
    items.push(item);
    summary[item.stage]++;
    if (items.length === limit) break;
  }
  return { summary, items };
}
