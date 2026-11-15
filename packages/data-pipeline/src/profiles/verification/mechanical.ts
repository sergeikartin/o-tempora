import { asRecord, assertBoldOnlyMarkup } from '../../output/profiles.js';
import type { ModelProfile } from '../model-profile.js';
import { type ProfileSubject, SUBJECT_TYPE } from '../subjects.js';
import type { ResolveArticleQids } from '../wikipedia-qids.js';
import { type Assessment, passages, type Source } from './policy.js';

// Key Moment labels use historical years. Month/day prose is left to the
// evidence checks; only unambiguous year labels are interpreted mechanically.
export function yearRange(
  label: string,
): { start: number; end: number; approximate: boolean } | undefined {
  const match =
    /^(c\.?\s*|ca\.?\s*)?(?:(AD|CE)\s*)?(\d{1,4})\s*(BC|BCE|AD|CE)?(?:\s*[–—-]\s*(?:(AD|CE)\s*)?(\d{1,4})\s*(BC|BCE|AD|CE)?)?$/.exec(
      label.trim(),
    );
  if (!match) return undefined;
  const start = Number(match[3]);
  const end = match[6] === undefined ? start : Number(match[6]);
  if (start === 0 || end === 0) return undefined;
  const endEra = match[7] ?? match[5] ?? match[4] ?? match[2];
  const startEra = match[4] ?? match[2] ?? endEra;
  const year = (value: number, era?: string) =>
    era?.startsWith('BC') ? 1 - value : value;
  return {
    start: year(start, startEra),
    end: year(end, endEra),
    approximate: !!match[1],
  };
}

export function evidenceChecks(
  profile: ModelProfile,
  subject: ProfileSubject,
  assessment: Assessment,
  sources: readonly Source[],
): string[] {
  const flags: string[] = [];
  const dates = yearRange(subject.dates);
  const paths = new Set(passages(profile).map((item) => item.path));
  for (const date of assessment.subject_dates) {
    if (!paths.has(date.path))
      flags.push(`Unknown subject date path: ${date.path}`);
    if (
      dates &&
      Math.abs(date.year - dates[date.boundary]) > (dates.approximate ? 1 : 0)
    ) {
      flags.push(
        `${date.path}: subject ${date.boundary} year ${date.year} disagrees with dataset ${dates[date.boundary]}`,
      );
    }
  }
  const byId = new Map(sources.map((source) => [source.id, source]));
  for (const [kind, items] of [
    ['key_moments', profile.key_moments],
    ['deep_facts', profile.deep_facts],
  ] as const) {
    items.forEach((item, i) => {
      const prefix = `${kind}.${i}.`;
      const supporting = assessment.findings
        .filter(
          (finding) =>
            finding.path.startsWith(prefix) && finding.verdict === 'supported',
        )
        .flatMap((finding) =>
          finding.evidence.flatMap((evidence) => {
            const source = byId.get(evidence.source);
            return source ? [source] : [];
          }),
        );
      try {
        const url = new URL(item.source);
        const fragment = decodeURIComponent(url.hash.slice(1));
        url.hash = '';
        const matched = supporting.find((source) => source.url === url.href);
        if (!matched)
          flags.push(
            `${prefix}text: replace source with a fetched supporting URL`,
          );
        else if (fragment && !matched.anchors?.includes(fragment))
          flags.push(
            `${prefix}text: source section missing; replace anchor or use article URL`,
          );
      } catch {
        flags.push(
          `${prefix}text: replace missing source with a fetched supporting URL`,
        );
      }
    });
  }
  return flags;
}

export async function mechanicalChecks(
  record: Record<string, unknown>,
  profile: ModelProfile,
  subject: ProfileSubject,
  resolve: ResolveArticleQids,
): Promise<string[]> {
  const flags: string[] = [];
  if (profile.type !== SUBJECT_TYPE[subject.lane])
    flags.push('Subject type differs from dataset');
  const meta = asRecord(record.meta, 'meta');
  const identity = asRecord(meta.source, 'meta.source');
  if (identity.wikidata_qid !== subject.qid || meta.locale !== 'en')
    flags.push('Subject identity or locale differs from dataset');
  for (const passage of passages(profile)) {
    try {
      assertBoldOnlyMarkup(passage.text, passage.path);
    } catch (error) {
      flags.push((error as Error).message);
    }
  }
  const resolved = await resolve([
    subject.wikipediaUrl,
    profile.wikipedia_url,
    ...profile.connections.map((item) => item.wikipedia_url),
  ]);
  if (
    resolved.get(profile.wikipedia_url) !== subject.qid ||
    resolved.get(subject.wikipediaUrl) !== subject.qid
  )
    flags.push('Subject URL does not resolve to its dataset QID');
  const rawConnections = record.connections as Record<string, unknown>[];
  profile.connections.forEach((connection, i) => {
    const qid = resolved.get(connection.wikipedia_url);
    if (!qid || qid !== rawConnections[i]?.qid)
      flags.push(`connections.${i}.connection: unresolved URL or QID mismatch`);
  });
  for (const [i, moment] of profile.key_moments.entries()) {
    const range = yearRange(moment.date);
    if (range && range.start > range.end)
      flags.push(`key_moments.${i}.date: years run backwards`);
    if (
      /\b0\s*(BC|BCE|AD|CE)\b/.test(moment.date) ||
      /^(AD|CE)\s*0\b/.test(moment.date)
    )
      flags.push(`key_moments.${i}.date: historical dates have no year zero`);
  }
  return flags;
}
