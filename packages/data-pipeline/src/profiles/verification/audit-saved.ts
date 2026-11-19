import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseModelProfile } from '../model-profile.js';
import type { Complete } from '../providers.js';
import type { ProfileSubject } from '../subjects.js';
import { asArray, asRecord, asString } from '../values.js';
import {
  hash,
  POLICY_VERSION,
  parseAssessment,
  parseAudit,
  profileHash,
} from './policy.js';
import { auditProfile } from './researcher.js';
import { reportPathFor } from './runner.js';

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
  const reportedSubject = asRecord(report.subject, 'report subject');
  if (
    report.policy_version !== POLICY_VERSION ||
    report.profile_hash !== profileHash(record) ||
    reportedSubject.qid !== subject.qid ||
    reportedSubject.dates !== subject.dates
  ) {
    throw new Error('Saved verification report is stale for this Profile');
  }

  const assessment = parseAssessment(report.assessment);
  const originalAudit = parseAudit(report.audit);
  const cited = new Set(
    assessment.findings.flatMap((finding) =>
      finding.evidence.map((item) => item.source),
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
    const snapshot = asRecord(
      JSON.parse(await readFile(snapshotPath, 'utf8')),
      'saved source',
    );
    const text = asString(snapshot.text, 'saved source text');
    if (snapshot.id !== id || hash(text) !== id)
      throw new Error(`Saved source content does not match ${id}`);
    sources.push({
      id,
      url: asString(url, 'report source URL'),
      fetched_at: asString(fetched_at, 'report source fetched_at'),
      text,
    });
  }

  const result = await auditProfile(
    profile,
    subject,
    assessment,
    sources,
    complete,
  );
  return { ...result, originalAudit };
}
