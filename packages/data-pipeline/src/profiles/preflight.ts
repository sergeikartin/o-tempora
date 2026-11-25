import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  extractAssessedProfile,
  readPendingAssessment,
} from './assessed-profile.js';
import { readSnapshot } from './evidence-cache.js';
import { parseModelProfile } from './model-profile.js';
import { passages } from './passages.js';
import type { ProfileSubject } from './subjects.js';
import { asRecord } from './values.js';
import {
  evidenceChecks,
  localMechanicalChecks,
} from './verification/mechanical.js';
import {
  type Assessment,
  assessmentBlockers,
  checkEvidence,
  type Evidence,
  findingExcerpts,
  parseAssessment,
  profileHash,
  type Source,
} from './verification/policy.js';
import { reportPathFor } from './verification/runner.js';
import {
  isCanonicalPrimaryTextUrl,
  isLowTrustDomain,
} from './verification/sources.js';
import { titleOfArticleUrl } from './wikipedia-qids.js';

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

async function readDraft(filePath: string, qid: string, issues: string[]) {
  const record = asRecord(
    JSON.parse(await readFile(filePath, 'utf8')),
    'Profile',
  );
  if (typeof record.overview !== 'string')
    return extractAssessedProfile(
      record.input_hash && record.result ? record.result : record,
    );

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
    const { profile, assessment } = await readDraft(filePath, qid, issues);
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
