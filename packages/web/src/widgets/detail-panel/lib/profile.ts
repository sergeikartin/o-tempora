import type { Profile } from '@o-tempora/shared-types';

// What the panel renders of a Profile; its Connections are resolved against the
// loaded datasets into ResolvedConnection rows instead.
export type ProfileBody = Omit<Profile, 'connections'>;

export type ProfileState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; profile: Profile };

export interface ResolvedConnection {
  slug: string;
  name: string;
  color: string;
  reason: string;
  // Index into DETAIL_LEVELS of the lowest level that shows the target.
  levelIndex: number;
  isShown: boolean;
}

export type BoldRun = { text: string; isBold: boolean };

// Splits `**bold**` markup into runs so the panel renders it as elements,
// never as injected HTML. An unpaired `**` stays literal.
export function parseBoldRuns(text: string): BoldRun[] {
  const parts = text.split('**');
  if (parts.length % 2 === 0) return [{ text, isBold: false }];
  return parts
    .map((part, index) => ({ text: part, isBold: index % 2 === 1 }))
    .filter((run) => run.text !== '');
}

// A Key Moment dated as a span is drawn as a capsule, one dated to a moment
// as a dot: the timeline's own duration encoding.
export function isSpanDate(date: string): boolean {
  return /\d\s*[–-]\s*\d/.test(date);
}
