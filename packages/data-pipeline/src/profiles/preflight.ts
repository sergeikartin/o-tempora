import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  extractAssessedProfile,
  extractRepairResult,
  isRepairPatch,
  readPendingAssessment,
} from './assessed-profile.js';
import { readSnapshot } from './evidence-cache.js';
import { parseModelProfile } from './model-profile.js';
import { passages } from './passages.js';
import { readStoredProfiles } from './store.js';
import type { ProfileSubject } from './subjects.js';
import { asRecord } from './values.js';
import {
  evidenceChecks,
  localMechanicalChecks,
  sourceClassificationIssues,
} from './verification/mechanical.js';
import {
  assessmentBlockers,
  checkEvidence,
  findingExcerpts,
  parseAssessment,
  profileHash,
} from './verification/policy.js';
import { reportPathFor } from './verification/runner.js';
import { titleOfArticleUrl } from './wikipedia-qids.js';

async function readStoredBase(profilesDir: string, qid: string) {
  const entry = (await readStoredProfiles(profilesDir)).get(qid);
  if (!entry)
    throw new Error(`${qid}: no saved English Profile for repair patch`);
  const record = asRecord(
    JSON.parse(await readFile(entry.filePath, 'utf8')),
    'English Profile',
  );
  const profile = parseModelProfile(record, entry.filePath);
  const pending = readPendingAssessment(record);
  if (pending) return { profile, assessment: pending.assessment };
  const report = asRecord(
    JSON.parse(await readFile(reportPathFor(entry.filePath), 'utf8')),
    'verification report',
  );
  if (report.profile_hash !== profileHash(record))
    throw new Error(
      'assessment: verification report belongs to different Profile content',
    );
  return { profile, assessment: parseAssessment(report.assessment) };
}

async function readDraft(
  filePath: string,
  qid: string,
  profilesDir: string,
  issues: string[],
) {
  const record = asRecord(
    JSON.parse(await readFile(filePath, 'utf8')),
    'Profile',
  );
  if (typeof record.overview !== 'string') {
    const payload = record.input_hash && record.result ? record.result : record;
    if (isRepairPatch(payload)) {
      const base = await readStoredBase(profilesDir, qid);
      return extractRepairResult(base.profile, base.assessment, payload);
    }
    return extractAssessedProfile(payload);
  }

  const profile = parseModelProfile(record, filePath);
  const meta = asRecord(record.meta, 'meta');
  if (meta.locale !== 'en')
    issues.push('meta.locale: expected English Profile');
  if (asRecord(meta.source, 'meta.source').wikidata_qid !== qid)
    issues.push('meta.source.wikidata_qid: differs from requested QID');
  const pending = readPendingAssessment(record);
  if (pending) return { profile, assessment: pending.assessment };

  const reportPath = reportPathFor(filePath);
  let value: unknown;
  try {
    value = JSON.parse(await readFile(reportPath, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      throw new Error(
        'assessment: no current pending assessment or verification report',
      );
    throw error;
  }
  const report = asRecord(value, 'verification report');
  if (report.profile_hash !== profileHash(record))
    throw new Error(
      'assessment: verification report belongs to different Profile content',
    );
  return { profile, assessment: parseAssessment(report.assessment) };
}

function articleTitle(url: string): string | undefined {
  if (/\s/.test(url)) return undefined;
  return titleOfArticleUrl(url)?.trim() || undefined;
}

export async function preflightProfile({
  qid,
  filePath,
  profilesDir,
  subject,
}: {
  qid: string;
  filePath: string;
  profilesDir: string;
  subject: ProfileSubject | undefined;
}) {
  const issues: string[] = [];
  const report = {
    ok: false,
    qid,
    file: filePath,
    checked_passages: 0,
    checked_findings: 0,
    checked_sources: 0,
    issues,
  };
  try {
    const { profile, assessment } = await readDraft(
      filePath,
      qid,
      profilesDir,
      issues,
    );
    report.checked_passages = passages(profile).length;
    report.checked_findings = assessment.findings.length;
    if (subject) issues.push(...localMechanicalChecks(profile, subject));
    else issues.push('qid: no dataset subject');
    if (!articleTitle(profile.wikipedia_url))
      issues.push(
        'wikipedia_url: expected a plain English Wikipedia article URL',
      );

    const titles = new Set<string>();
    profile.connections.forEach((connection, index) => {
      const field = `connections.${index}.wikipedia_url`;
      const title = articleTitle(connection.wikipedia_url);
      if (!title)
        issues.push(`${field}: expected a plain English Wikipedia article URL`);
      else if (titles.has(title))
        issues.push(`${field}: duplicate Connection URL`);
      else titles.add(title);
    });

    const ids = [
      ...new Set(
        assessment.findings.flatMap((finding) =>
          findingExcerpts(finding).map(({ source }) => source),
        ),
      ),
    ];
    const directory = path.join(profilesDir, 'evidence');
    const results = await Promise.allSettled(
      ids.map((id) => readSnapshot(directory, id)),
    );
    const snapshots = results.flatMap((result, index) => {
      if (result.status === 'fulfilled') return [result.value];
      issues.push(
        `evidence.${ids[index]}: missing or invalid snapshot (${result.reason instanceof Error ? result.reason.message : String(result.reason)})`,
      );
      return [];
    });
    report.checked_sources = snapshots.length;
    if (subject)
      issues.push(...evidenceChecks(profile, subject, assessment, snapshots));
    issues.push(
      ...checkEvidence(assessment, snapshots),
      ...assessmentBlockers(profile, assessment, snapshots),
      ...sourceClassificationIssues(assessment, snapshots),
    );
  } catch (error) {
    issues.push(
      `file: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return { ...report, ok: issues.length === 0, issues: [...new Set(issues)] };
}
