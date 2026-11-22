import { createHash } from 'node:crypto';
import { asArray, asRecord, asString } from '../values.js';

export const POLICY_VERSION = '3';

export function isCurrentVerificationPolicy(
  version: unknown,
  dates: string,
): boolean {
  // Version 2 checked the same years for closed spans and points. Its label
  // parser skipped every comparison for an ongoing subject.
  return (
    version === POLICY_VERSION ||
    (POLICY_VERSION === '3' && version === '2' && !dates.endsWith('–present'))
  );
}

export interface Evidence {
  source: string;
  quote: string;
  kind: 'wikipedia' | 'primary' | 'scholarly' | 'other';
  // The original work/account, not the website repeating it.
  origin: string;
}

export interface Finding {
  path: string;
  claim: string;
  verdict: 'supported' | 'contradicted' | 'unverifiable' | 'disputed';
  risk: 'ordinary' | 'corroborate';
  explanation: string;
  correction: string;
  evidence: Evidence[];
}

export interface Assessment {
  findings: Finding[];
  covered: string[];
  uncovered: string[];
  issues: string[];
  coherent: boolean;
  subject_dates: { path: string; boundary: 'start' | 'end'; year: number }[];
}

export interface Source {
  id: string;
  url: string;
  fetched_at: string;
  text: string;
  anchors?: string[];
}

export interface Report {
  policy_version: string;
  profile_hash: string;
  verified_at: string;
  subject: { qid: string; dates: string };
  models: string[];
  assessment: Assessment;
  audit: { uncovered: string[]; issues: string[]; coherent: boolean };
  sources: Pick<Source, 'id' | 'url' | 'fetched_at'>[];
  evidence_errors: string[];
  mechanical: string[];
  blockers: string[];
  repairs: number;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function hash(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

// Review metadata can change without invalidating the checked content. Identity
// and locale are included because an approval cannot be moved to another entity.
export function profileHash(value: unknown): string {
  const { meta, ...content } = asRecord(value, 'Profile');
  const metadata = asRecord(meta, 'Profile.meta');
  return hash({
    ...content,
    identity: metadata.source,
    locale: metadata.locale,
  });
}

export function strings(value: unknown, where: string): string[] {
  return asArray(value, where).map((item) => asString(item, where));
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  where: string,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${where}: expected ${allowed.join(' | ')}`);
  }
  return value as T;
}

export function parseAudit(value: unknown): Report['audit'] {
  const root = asRecord(value, 'audit');
  if (typeof root.coherent !== 'boolean')
    throw new Error('audit.coherent: expected boolean');
  return {
    uncovered: strings(root.uncovered, 'audit.uncovered'),
    issues: strings(root.issues, 'audit.issues'),
    coherent: root.coherent,
  };
}

export function parseAssessment(value: unknown): Assessment {
  const root = asRecord(value, 'assessment');
  return {
    ...parseAudit(root),
    covered: strings(root.covered, 'covered'),
    subject_dates: asArray(root.subject_dates, 'subject_dates').map((item) => {
      const date = asRecord(item, 'subject date');
      if (typeof date.year !== 'number' || !Number.isInteger(date.year))
        throw new Error('subject date: expected integer astronomical year');
      return {
        path: asString(date.path, 'subject date path'),
        boundary: oneOf(
          date.boundary,
          ['start', 'end'],
          'subject date boundary',
        ),
        year: date.year,
      };
    }),
    findings: asArray(root.findings, 'findings').map((item) => {
      const row = asRecord(item, 'finding');
      if (typeof row.correction !== 'string')
        throw new Error('correction: expected string');
      return {
        path: asString(row.path, 'finding.path'),
        claim: asString(row.claim, 'finding.claim'),
        verdict: oneOf(
          row.verdict,
          ['supported', 'contradicted', 'unverifiable', 'disputed'],
          'verdict',
        ),
        risk: oneOf(row.risk, ['ordinary', 'corroborate'], 'risk'),
        explanation: asString(row.explanation, 'explanation'),
        correction: row.correction,
        evidence: asArray(row.evidence, 'evidence').map((item) => {
          const evidence = asRecord(item, 'evidence');
          return {
            source: asString(evidence.source, 'evidence.source'),
            quote: asString(evidence.quote, 'evidence.quote'),
            kind: oneOf(
              evidence.kind,
              ['wikipedia', 'primary', 'scholarly', 'other'],
              'evidence.kind',
            ),
            origin: asString(evidence.origin, 'evidence.origin'),
          };
        }),
      };
    }),
  };
}

export function normalizeText(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim();
}

export function checkEvidence(
  assessment: Assessment,
  sources: readonly Source[],
): string[] {
  const byId = new Map(sources.map((source) => [source.id, source]));
  return assessment.findings.flatMap((finding) =>
    finding.evidence.flatMap((evidence) => {
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

export function blockers(
  report: Omit<Report, 'blockers'>,
  paths: readonly string[],
): string[] {
  const result = [
    ...report.mechanical,
    ...report.evidence_errors,
    ...report.assessment.uncovered,
    ...report.assessment.issues,
    ...report.audit.uncovered,
    ...report.audit.issues,
  ];
  const { assessment } = report;
  if (!assessment.coherent || !report.audit.coherent)
    result.push('Profile is not coherent');
  if (assessment.findings.length === 0)
    result.push('No factual claims checked');
  if (
    new Set(assessment.covered).size !== assessment.covered.length ||
    paths.length !== assessment.covered.length ||
    paths.some((path) => !assessment.covered.includes(path))
  ) {
    result.push('Coverage must account for every visible field exactly once');
  }
  const sources = new Map(report.sources.map((source) => [source.id, source]));
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
  return [...new Set(result)];
}

// This is a publication receipt, not a model confidence score. A report must
// be unchanged since the runner validated its evidence and issued the receipt.
export function hasApproval(
  profile: unknown,
  verification: unknown,
  paths: readonly string[],
): boolean {
  try {
    const root = asRecord(profile, 'Profile');
    const meta = asRecord(root.meta, 'meta');
    const review = asRecord(meta.review, 'review');
    const approval = asRecord(review.approval, 'approval');
    const report = asRecord(verification, 'report');
    const subject = asRecord(report.subject, 'report.subject');
    const source = asRecord(meta.source, 'meta.source');
    if (
      subject.qid !== source.wikidata_qid ||
      typeof subject.dates !== 'string' ||
      subject.dates.length === 0 ||
      !['reviewed', 'edited'].includes(String(review.status)) ||
      approval.policy_version !== report.policy_version ||
      !isCurrentVerificationPolicy(report.policy_version, subject.dates) ||
      approval.profile_hash !== profileHash(profile) ||
      report.profile_hash !== approval.profile_hash ||
      approval.report_hash !== hash(verification)
    )
      return false;
    // Parsing the model-owned parts here also prevents malformed reports from
    // acquiring publishing rights just by adding a review status.
    const assessment = parseAssessment(report.assessment);
    const audit = parseAudit(report.audit);
    const parsed = {
      ...report,
      assessment,
      audit,
      mechanical: strings(report.mechanical, 'mechanical'),
      evidence_errors: strings(report.evidence_errors, 'evidence_errors'),
    } as unknown as Report;
    return (
      Array.isArray(report.sources) &&
      strings(report.blockers, 'blockers').length === 0 &&
      blockers(parsed, paths).length === 0
    );
  } catch {
    return false;
  }
}
