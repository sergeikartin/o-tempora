import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  extractAssessedProfile,
  extractRepairResult,
  isRepairPatch,
} from './assessed-profile.ts';
import { readCitationAliases, readSnapshot } from './evidence-cache.ts';
import { parseModelProfile } from './model-profile.ts';
import { passages } from './passages.ts';
import { readPendingAssessmentState } from './pending-state.ts';
import { readStoredProfiles } from './store.ts';
import type { ProfileSubject } from './subjects.ts';
import { asRecord } from './values.ts';
import { profileHash } from './verification/approval.ts';
import { findingExcerpts, parseAssessment } from './verification/assessment.ts';
import {
  citationUrls,
  evaluateEnglishProfile,
} from './verification/evaluate.ts';
import { reportPathFor } from './verification/runner.ts';
import { titleOfArticleUrl } from './wikipedia-qids.ts';

async function readStoredBase(profilesDir: string, qid: string) {
  const entry = (await readStoredProfiles(profilesDir)).get(qid);
  if (!entry)
    throw new Error(`${qid}: no saved English Profile for repair patch`);
  const record = asRecord(
    JSON.parse(await readFile(entry.filePath, 'utf8')),
    'English Profile',
  );
  const profile = parseModelProfile(record, entry.filePath);
  const pending = await readPendingAssessmentState(profilesDir, qid, record);
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
  const pending = await readPendingAssessmentState(profilesDir, qid, record);
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

// Wikipedia treats the first letter of a title as case-insensitive.
function titleKey(title: string): string {
  return title.charAt(0).toUpperCase() + title.slice(1);
}

// `finalize` keeps only Connections whose URL resolves to a dataset entity.
// Offline, a redirect cannot be followed, so a miss is a warning: the writer
// can swap in the dataset entity's article URL before the Connection is lost.
function connectionWarnings(
  connections: readonly { name: string; wikipedia_url: string }[],
  subject: ProfileSubject | undefined,
  subjects: readonly ProfileSubject[],
): string[] {
  const known = new Map<string, string>();
  for (const entry of subjects) {
    const title = articleTitle(entry.wikipediaUrl);
    if (title) known.set(titleKey(title), entry.qid);
  }
  if (!known.size) return [];
  return connections.flatMap(({ name, wikipedia_url }, index) => {
    const title = articleTitle(wikipedia_url);
    if (!title) return [];
    const field = `connections.${index}.wikipedia_url`;
    const target = known.get(titleKey(title));
    if (target === undefined)
      return [
        `${field}: "${name}" is not a dataset entity at this URL; finalize drops it unless the URL redirects to one`,
      ];
    if (target === subject?.qid)
      return [`${field}: "${name}" is the subject itself; finalize drops it`];
    return [];
  });
}

export async function validateProfile({
  qid,
  filePath,
  profilesDir,
  subject,
  subjects = [],
}: {
  qid: string;
  filePath: string;
  profilesDir: string;
  subject: ProfileSubject | undefined;
  // Every dataset entity, used to warn about Connections finalize would drop.
  subjects?: readonly ProfileSubject[];
}) {
  const issues: string[] = [];
  const warnings: string[] = [];
  const report = {
    ok: false,
    qid,
    file: filePath,
    checked_passages: 0,
    checked_findings: 0,
    checked_sources: 0,
    issues,
    warnings,
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
    warnings.push(
      ...connectionWarnings(profile.connections, subject, subjects),
    );

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
    const evaluation = evaluateEnglishProfile({
      profile,
      subject,
      assessment,
      snapshots,
      citationAliases: await readCitationAliases(
        profilesDir,
        citationUrls(profile),
      ),
    });
    issues.push(...evaluation.blockers);
  } catch (error) {
    issues.push(
      `file: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return { ...report, ok: issues.length === 0, issues: [...new Set(issues)] };
}
