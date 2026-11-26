import { assertBoldOnlyMarkup } from '../markup.ts';
import type { ModelProfile } from '../model-profile.ts';
import { passages } from '../passages.ts';
import { type ProfileSubject, SUBJECT_TYPE } from '../subjects.ts';
import { asRecord } from '../values.ts';
import {
  type Assessment,
  type Audit,
  type Evidence,
  findingExcerpts,
  normalizeText,
  type Source,
} from './assessment.ts';
import { isCanonicalPrimaryTextUrl, isLowTrustDomain } from './sources.ts';

export interface EnglishEvaluationInput {
  profile: ModelProfile;
  subject?: ProfileSubject;
  assessment: Assessment;
  snapshots: readonly Source[];
  // Maps a requested (pre-redirect) URL to the cached snapshot ID it fetched.
  citationAliases?: ReadonlyMap<string, string>;
  audit?: Audit;
  // Supplied at audit time after resolving Wikipedia URLs at the outer seam.
  identity?: {
    record: Record<string, unknown>;
    resolvedQids: ReadonlyMap<string, string>;
  };
}

export interface EnglishEvaluation {
  mechanical: string[];
  evidenceErrors: string[];
  blockers: string[];
}

// The URLs displayed as Key Moment and Deep Fact citations.
export function citationUrls(profile: ModelProfile): string[] {
  return [...profile.key_moments, ...profile.deep_facts].map(
    ({ source }) => source,
  );
}

// Key Moment labels use historical years. Month/day prose is left to the
// evidence checks; only unambiguous year labels are interpreted mechanically.
const YEAR_RANGE =
  /^(c\.?\s*|ca\.?\s*)?(?:(AD|CE)\s*)?(\d{1,4})\s*(BC|BCE|AD|CE)?(?:\s*[–—-]\s*(c\.?\s*|ca\.?\s*)?(?:(AD|CE)\s*)?(\d{1,4})\s*(BC|BCE|AD|CE)?)?$/;

function yearRange(
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

function localMechanicalChecks(
  profile: ModelProfile,
  subject: ProfileSubject | undefined,
): string[] {
  const flags: string[] = [];
  if (!subject) flags.push('qid: no dataset subject');
  else if (profile.type !== SUBJECT_TYPE[subject.lane])
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

function identityChecks(
  record: Record<string, unknown>,
  profile: ModelProfile,
  subject: ProfileSubject,
  resolvedQids: ReadonlyMap<string, string>,
): string[] {
  const flags: string[] = [];
  const meta = asRecord(record.meta, 'meta');
  const identity = asRecord(meta.source, 'meta.source');
  if (identity.wikidata_qid !== subject.qid || meta.locale !== 'en')
    flags.push('Subject identity or locale differs from dataset');
  if (
    resolvedQids.get(profile.wikipedia_url) !== subject.qid ||
    resolvedQids.get(subject.wikipediaUrl) !== subject.qid
  )
    flags.push('Subject URL does not resolve to its dataset QID');
  const rawConnections = record.connections as Record<string, unknown>[];
  profile.connections.forEach((connection, i) => {
    const qid = resolvedQids.get(connection.wikipedia_url);
    if (!qid || qid !== rawConnections[i]?.qid)
      flags.push(`connections.${i}.connection: unresolved URL or QID mismatch`);
  });
  return flags;
}

function evidenceChecks(
  profile: ModelProfile,
  subject: ProfileSubject | undefined,
  assessment: Assessment,
  sources: readonly Source[],
  citationAliases: ReadonlyMap<string, string>,
): string[] {
  const flags: string[] = [];
  if (subject) {
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
        const alias = citationAliases.get(url.href);
        const matched = supporting.find(
          (source) => source.url === url.href || source.id === alias,
        );
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

function checkEvidence(
  assessment: Assessment,
  sources: readonly Source[],
): string[] {
  const byId = new Map(sources.map((source) => [source.id, source]));
  return assessment.findings.flatMap((finding) =>
    findingExcerpts(finding).flatMap((evidence) => {
      const source = byId.get(evidence.source);
      return source &&
        normalizeText(evidence.quote).length > 0 &&
        normalizeText(source.text).includes(normalizeText(evidence.quote))
        ? []
        : [
            `${finding.path}: evidence was not found in a fetched source (${evidence.source})`,
          ];
    }),
  );
}

function sourceClassificationIssues(
  assessment: Assessment,
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

function assessmentBlockers(
  profile: ModelProfile,
  assessment: Assessment,
  snapshots: readonly Pick<Source, 'id' | 'url'>[],
): string[] {
  const paths = passages(profile).map(({ path }) => path);
  const result = [...assessment.uncovered, ...assessment.issues];
  if (!assessment.coherent) result.push('Profile is not coherent');
  if (assessment.findings.length === 0)
    result.push('No factual claims checked');
  if (
    new Set(assessment.covered).size !== assessment.covered.length ||
    paths.length !== assessment.covered.length ||
    paths.some((path) => !assessment.covered.includes(path))
  ) {
    result.push('Coverage must account for every visible field exactly once');
  }
  const sources = new Map(snapshots.map((source) => [source.id, source]));
  for (const path of paths) {
    if (
      !path.endsWith('.title') &&
      !assessment.findings.some((finding) => finding.path === path)
    ) {
      result.push(`${path}: no factual claims checked for this passage`);
    }
  }
  for (const finding of assessment.findings) {
    if (!paths.includes(finding.path))
      result.push(`Unknown passage: ${finding.path}`);
    if (finding.verdict !== 'supported')
      result.push(`${finding.path}: ${finding.verdict}: ${finding.claim}`);
    else {
      const reliable = finding.evidence.filter((evidence) => {
        const source = sources.get(evidence.source);
        return (
          source &&
          evidence.kind !== 'other' &&
          (evidence.kind !== 'wikipedia' ||
            new URL(source.url).hostname.endsWith('.wikipedia.org'))
        );
      });
      if (!reliable.length)
        result.push(`${finding.path}: no reliable fetched evidence`);
      if (finding.risk === 'corroborate') {
        const hosts = new Set(
          reliable.map((e) =>
            new URL(sources.get(e.source)?.url ?? '').hostname.replace(
              /^www\./,
              '',
            ),
          ),
        );
        const origins = new Set(
          reliable.map((e) => normalizeText(e.origin).toLowerCase()),
        );
        if (
          hosts.size < 2 ||
          origins.size < 2 ||
          !reliable.some((e) => e.kind === 'primary' || e.kind === 'scholarly')
        )
          result.push(`${finding.path}: independent corroboration missing`);
      }
    }
  }
  return result;
}

function auditBlockers(audit: Audit): string[] {
  return [
    ...audit.uncovered,
    ...audit.issues,
    ...(audit.coherent ? [] : ['Profile is not coherent']),
  ];
}

// Single deterministic, offline rule engine shared by local `validate` and
// authoritative `applyEnglishAudit`.
export function evaluateEnglishProfile({
  profile,
  subject,
  assessment,
  snapshots,
  citationAliases = new Map(),
  audit,
  identity,
}: EnglishEvaluationInput): EnglishEvaluation {
  const mechanical = [
    ...localMechanicalChecks(profile, subject),
    ...(identity && subject
      ? identityChecks(identity.record, profile, subject, identity.resolvedQids)
      : []),
    ...evidenceChecks(profile, subject, assessment, snapshots, citationAliases),
  ];
  const evidenceErrors = [
    ...checkEvidence(assessment, snapshots),
    ...sourceClassificationIssues(assessment, snapshots),
  ];
  const blockers = [
    ...mechanical,
    ...evidenceErrors,
    ...assessmentBlockers(profile, assessment, snapshots),
    ...(audit ? auditBlockers(audit) : []),
  ];
  return {
    mechanical,
    evidenceErrors,
    blockers: [...new Set(blockers)],
  };
}
