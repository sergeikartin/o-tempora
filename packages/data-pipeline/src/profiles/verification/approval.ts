import { asRecord } from '../values.ts';
import {
  type Assessment,
  type Audit,
  hash,
  parseAssessment,
  parseAudit,
  type Source,
  strings,
} from './assessment.ts';

export const POLICY_VERSION = '9';

export interface Report {
  policy_version: string;
  profile_hash: string;
  verified_at: string;
  subject: { qid: string; dates: string };
  models: string[];
  assessment: Assessment;
  audit: Audit;
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

export interface ProfileApproval {
  isCurrentFor(dates: string): boolean;
}

// Validate the saved receipt and stored invariants at publish time without
// re-running current audit rules against previously approved drafts.
export function readProfileApproval(
  profile: unknown,
  verification: unknown,
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
