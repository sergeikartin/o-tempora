import { assertBoldOnlyMarkup } from '../markup.js';
import type { ModelProfile } from '../model-profile.js';
import { passages } from '../passages.js';
import { type ProfileSubject, SUBJECT_TYPE } from '../subjects.js';
import { asRecord } from '../values.js';
import type { ResolveArticleQids } from '../wikipedia-qids.js';
import {
  type Assessment,
  type Evidence,
  findingExcerpts,
  type Source,
} from './policy.js';
import { isCanonicalPrimaryTextUrl, isLowTrustDomain } from './sources.js';

export function sourceClassificationIssues(
  assessment: {
    findings: readonly Pick<
      Assessment['findings'][number],
      'path' | 'evidence' | 'counterevidence'
    >[];
  },
  snapshots: readonly Pick<Source, 'id' | 'url'>[],
): string[] {
  const byId = new Map(snapshots.map((source) => [source.id, source]));
  const kindsBySource = new Map<string, Set<Evidence['kind']>>();
  const issues: string[] = [];
  for (const finding of assessment.findings) {
    for (const item of findingExcerpts(finding)) {
      const source = byId.get(item.source);
      if (!source) continue;
      const kinds = kindsBySource.get(item.source) ?? new Set();
      kinds.add(item.kind);
      kindsBySource.set(item.source, kinds);
      const hostname = new URL(source.url).hostname.toLowerCase();
      if (hostname.endsWith('.wikipedia.org') && item.kind !== 'wikipedia') {
        issues.push(
          `${finding.path}: Wikipedia source (${source.url}) must use kind "wikipedia", not "${item.kind}"`,
        );
      }
      if (isCanonicalPrimaryTextUrl(source.url) && item.kind === 'scholarly') {
        issues.push(
          `${finding.path}: primary text edition (${source.url}) should use kind "primary", not "scholarly"`,
        );
      }
      if (
        isLowTrustDomain(source.url) &&
        (item.kind === 'scholarly' || item.kind === 'primary')
      ) {
        issues.push(
          `${finding.path}: low-trust reference site (${source.url}) cannot be classified as "${item.kind}"`,
        );
      }
    }
  }
  for (const [id, kinds] of kindsBySource) {
    if (kinds.has('scholarly') && kinds.has('other')) {
      issues.push(
        `evidence.${id}: inconsistent evidence.kind ("scholarly" and "other") for ${byId.get(id)?.url}`,
      );
    }
  }
  return issues;
}

// Key Moment labels use historical years. Month/day prose is left to the
// evidence checks; only unambiguous year labels are interpreted mechanically.
const YEAR_RANGE =
  /^(c\.?\s*|ca\.?\s*)?(?:(AD|CE)\s*)?(\d{1,4})\s*(BC|BCE|AD|CE)?(?:\s*[–—-]\s*(c\.?\s*|ca\.?\s*)?(?:(AD|CE)\s*)?(\d{1,4})\s*(BC|BCE|AD|CE)?)?$/;

export function yearRange(
  label: string,
):
  | { start: number; end: number; approximate: boolean; endApproximate?: true }
  | undefined {
  const match = YEAR_RANGE.exec(label.trim());
  if (!match) return undefined;
  const start = Number(match[3]);
  const end = match[7] === undefined ? start : Number(match[7]);
  if (start === 0 || end === 0) return undefined;
  const endEra = match[8] ?? match[6] ?? match[4] ?? match[2];
  const startEra = match[4] ?? match[2] ?? endEra;
  const year = (value: number, era?: string) =>
    era?.startsWith('BC') ? 1 - value : value;
  return {
    start: year(start, startEra),
    end: year(end, endEra),
    approximate: !!match[1],
    ...(match[5] || (!match[7] && match[1])
      ? { endApproximate: true as const }
      : {}),
  };
}

export function evidenceChecks(
  profile: ModelProfile,
  subject: ProfileSubject,
  assessment: Assessment,
  sources: readonly Source[],
): string[] {
  const flags: string[] = [];
  const { startYear, endYear, ongoing, approximate, endApproximate } =
    subject.dateSpan;
  const paths = new Set(passages(profile).map((item) => item.path));
  for (const date of assessment.subject_dates) {
    if (!paths.has(date.path))
      flags.push(`Unknown subject date path: ${date.path}`);
    const isStart = date.boundary === 'start';
    const expected = isStart
      ? startYear
      : (endYear ?? (ongoing ? undefined : startYear));
    const isApproximate =
      isStart || endYear === undefined ? approximate : endApproximate;
    if (
      expected !== undefined &&
      Math.abs(date.year - expected) > (isApproximate ? 1 : 0)
    ) {
      flags.push(
        `${date.path}: subject ${date.boundary} year ${date.year} disagrees with dataset ${expected}`,
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
  const flags = localMechanicalChecks(profile, subject);
  const meta = asRecord(record.meta, 'meta');
  const identity = asRecord(meta.source, 'meta.source');
  if (identity.wikidata_qid !== subject.qid || meta.locale !== 'en')
    flags.push('Subject identity or locale differs from dataset');
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
  return flags;
}

export function localMechanicalChecks(
  profile: ModelProfile,
  subject: ProfileSubject,
): string[] {
  const flags: string[] = [];
  if (profile.type !== SUBJECT_TYPE[subject.lane])
    flags.push('type: Subject type differs from dataset');
  for (const passage of passages(profile)) {
    try {
      assertBoldOnlyMarkup(passage.text, passage.path);
    } catch (error) {
      flags.push((error as Error).message);
    }
  }
  for (const [i, moment] of profile.key_moments.entries()) {
    const range = yearRange(moment.date);
    if (range && range.start > range.end)
      flags.push(`key_moments.${i}.date: years run backwards`);
    const match = YEAR_RANGE.exec(moment.date.trim());
    if (
      (match && (Number(match[3]) === 0 || Number(match[7]) === 0)) ||
      /\b0\s*(BC|BCE|AD|CE)\b/.test(moment.date) ||
      /^(AD|CE)\s*0\b/.test(moment.date)
    )
      flags.push(`key_moments.${i}.date: historical dates have no year zero`);
  }
  return flags;
}
