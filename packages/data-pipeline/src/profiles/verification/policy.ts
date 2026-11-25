import { passages } from '../passages.js';
import { asRecord } from '../values.js';
import {
  type AdversarialResult,
  parseAdversarialResult,
  selectAdversarialTargets,
} from './adversarial.js';
import {
  type Assessment,
  type Audit,
  findingExcerpts,
  hash,
  normalizeText,
  parseAssessment,
  parseAudit,
  strings,
} from './assessment.js';

export {
  type Assessment,
  type Evidence,
  findingExcerpts,
  hash,
  normalizeText,
  parseAssessment,
  parseAudit,
  strings,
} from './assessment.js';

export const POLICY_VERSION = '8';

export interface SourceHeading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  offset: number;
}

export interface Source {
  id: string;
  url: string;
  fetched_at: string;
  text: string;
  anchors?: string[];
  title?: string;
  headings?: SourceHeading[];
}

export interface Report {
  policy_version: string;
  profile_hash: string;
  verified_at: string;
  subject: { qid: string; dates: string };
  models: string[];
  assessment: Assessment;
  audit: Audit;
  adversarial?: AdversarialResult;
  sources: Pick<Source, 'id' | 'url' | 'fetched_at'>[];
  evidence_errors: string[];
  mechanical: string[];
  blockers: string[];
  repairs: number;
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

export function checkEvidence(
  assessment: {
    findings: readonly Pick<
      Assessment['findings'][number],
      'path' | 'evidence' | 'counterevidence'
    >[];
  },
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

export function assessmentBlockers(
  profile: Parameters<typeof passages>[0],
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

export function blockers(
  report: Omit<Report, 'blockers'>,
  profile: Parameters<typeof passages>[0] & { subject?: string },
): string[] {
  const { assessment } = report;
  const result = [
    ...report.mechanical,
    ...report.evidence_errors,
    ...report.audit.uncovered,
    ...report.audit.issues,
    ...assessmentBlockers(profile, assessment, report.sources),
  ];
  if (!report.audit.coherent) result.push('Profile is not coherent');
  const sources = new Map(report.sources.map((source) => [source.id, source]));
  const targets = selectAdversarialTargets(profile, assessment);
  try {
    if (report.adversarial !== undefined) {
      const checks = parseAdversarialResult(report.adversarial, targets);
      if (
        !report.adversarial.model?.trim() ||
        !strings(report.models, 'report models').includes(
          report.adversarial.model,
        )
      )
        throw new Error('Missing adversarial model');
      for (const check of checks) {
        const merged =
          assessment.findings[check.finding_index]?.counterevidence ?? [];
        for (const item of check.counterevidence) {
          if (
            !sources.has(item.source) ||
            !merged.some(
              (entry) =>
                entry.source === item.source &&
                normalizeText(entry.quote) === normalizeText(item.quote),
            )
          )
            throw new Error(
              `${check.path}: adversarial counterevidence is missing from the assessment or sources`,
            );
        }
      }
    } else if (targets.length) {
      throw new Error('Missing adversarial checks for selected findings');
    }
  } catch (error) {
    result.push(error instanceof Error ? error.message : String(error));
  }
  return [...new Set(result)];
}

export interface ProfileApproval {
  isCurrentFor(dates: string): boolean;
}

// Validate the saved receipt and stored invariants at publish time without
// re-running current target-selection rules against previously approved drafts.
export function readProfileApproval(
  profile: unknown,
  verification: unknown,
  _text?: Parameters<typeof passages>[0],
): ProfileApproval | undefined {
  try {
    const root = asRecord(profile, 'Profile');
    const meta = asRecord(root.meta, 'meta');
    const review = asRecord(meta.review, 'review');
    const approval = asRecord(review.approval, 'approval');
    const report = asRecord(verification, 'report');
    const subject = asRecord(report.subject, 'report.subject');
    const source = asRecord(meta.source, 'meta.source');
    const dates = subject.dates;
    const policyVersion = report.policy_version;
    if (
      subject.qid !== source.wikidata_qid ||
      typeof dates !== 'string' ||
      dates.length === 0 ||
      typeof policyVersion !== 'string' ||
      policyVersion.length === 0 ||
      !['reviewed', 'edited'].includes(String(review.status)) ||
      approval.policy_version !== policyVersion ||
      approval.profile_hash !== profileHash(profile) ||
      report.profile_hash !== approval.profile_hash ||
      approval.report_hash !== hash(verification)
    )
      return undefined;
    // Parsing the model-owned parts here also prevents malformed reports from
    // acquiring publishing rights just by adding a review status.
    const assessment = parseAssessment(report.assessment);
    const audit = parseAudit(report.audit);
    if (
      !Array.isArray(report.sources) ||
      strings(report.blockers, 'blockers').length > 0 ||
      strings(report.mechanical, 'mechanical').length > 0 ||
      strings(report.evidence_errors, 'evidence_errors').length > 0 ||
      !audit.coherent ||
      audit.issues.length > 0 ||
      audit.uncovered.length > 0 ||
      !assessment.coherent ||
      assessment.issues.length > 0 ||
      assessment.uncovered.length > 0
    )
      return undefined;
    return { isCurrentFor: (currentDates) => dates === currentDates };
  } catch {
    return undefined;
  }
}
