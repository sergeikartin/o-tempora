// A Profile (CONTEXT.md) as the panel renders it. Key Moment and Deep Fact
// text carries `**bold**` runs; claims, sources and review metadata are
// pipeline-side and never reach the panel.
export interface ProfileKeyMoment {
  date: string;
  title: string;
  text: string;
}

export interface ProfileDeepFact {
  text: string;
  isLegend: boolean;
}

// Names the target by slug; the panel's caller resolves it against the loaded
// datasets and drops it when the target is absent.
export interface ProfileConnection {
  slug: string;
  reason: string;
}

export interface Profile {
  overview: string;
  keyMoments: readonly ProfileKeyMoment[];
  deepFacts: readonly ProfileDeepFact[];
  connections: readonly ProfileConnection[];
}

// A Connection target resolved against the datasets, ready to list.
export interface ResolvedConnection {
  slug: string;
  name: string;
  dates: string;
  // Lane color, so the row reads against the marks it names.
  color: string;
  reason: string;
  // Index into DETAIL_LEVELS of the lowest level that shows the target.
  levelIndex: number;
  // Whether the current Detail Level already shows the target.
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
