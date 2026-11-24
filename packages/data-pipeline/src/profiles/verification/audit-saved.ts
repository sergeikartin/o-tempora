import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseModelProfile } from '../model-profile.js';
import type { Complete } from '../providers.js';
import { formatDates, type ProfileSubject } from '../subjects.js';
import { asArray, asRecord } from '../values.js';
import {
  parseAdversarialResult,
  selectAdversarialTargets,
} from './adversarial.js';
import {
  findingExcerpts,
  isCurrentVerificationPolicy,
  parseAssessment,
  parseAudit,
  profileHash,
} from './policy.js';
import { auditProfile } from './researcher.js';
import { reportPathFor } from './runner.js';
import { parseSourceSnapshot } from './sources.js';

export async function auditSavedProfile(
  filePath: string,
  subject: ProfileSubject,
  complete: Complete,
) {
  const record: unknown = JSON.parse(await readFile(filePath, 'utf8'));
  const profile = parseModelProfile(record, filePath);
  const report = asRecord(
    JSON.parse(await readFile(reportPathFor(filePath), 'utf8')),
    'verification report',
  );
  const dates = formatDates(subject.dateSpan);
  const reportedSubject = asRecord(report.subject, 'report subject');
  if (
    !isCurrentVerificationPolicy(report.policy_version, dates) ||
    report.profile_hash !== profileHash(record) ||
    reportedSubject.qid !== subject.qid ||
    reportedSubject.dates !== dates
  ) {
    throw new Error('Saved verification report is stale for this Profile');
  }

  const assessment = parseAssessment(report.assessment);
  const originalAudit = parseAudit(report.audit);
  const cited = new Set(
    assessment.findings.flatMap((finding) =>
      findingExcerpts(finding).map((item) => item.source),
    ),
  );
  const sources = [];
  for (const item of asArray(report.sources, 'report sources')) {
    const { id, url, fetched_at } = asRecord(item, 'report source');
    if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id))
      throw new Error('Invalid saved source ID');
    if (!cited.has(id)) continue;
    const snapshotPath = path.join(
      path.dirname(filePath),
      '..',
      'evidence',
      `${id}.json`,
    );
    const snapshot = parseSourceSnapshot(
      JSON.parse(await readFile(snapshotPath, 'utf8')),
      id,
    );
    if (snapshot.url !== url || snapshot.fetched_at !== fetched_at)
      throw new Error(`Saved source metadata does not match ${id}`);
    sources.push(snapshot);
  }

  const result = await auditProfile(
    profile,
    subject,
    assessment,
    sources,
    complete,
    report.adversarial === undefined
      ? undefined
      : parseAdversarialResult(
          report.adversarial,
          selectAdversarialTargets(profile, assessment),
        ),
  );
  return { ...result, originalAudit };
}
