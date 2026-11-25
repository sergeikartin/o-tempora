import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { readSnapshot } from './evidence-cache.js';
import { asArray, asRecord, asString } from './values.js';
import {
  type AdversarialCheck,
  type AdversarialTarget,
  LONG_QUOTE_PATTERN,
  parseAdversarialResult,
  RISK_CUE_PATTERN,
} from './verification/adversarial.js';
import { sourceClassificationIssues } from './verification/mechanical.js';
import {
  type Assessment,
  checkEvidence,
  findingExcerpts,
  hash,
  normalizeText,
  parseAssessment,
  profileHash,
} from './verification/policy.js';
import { reportPathFor } from './verification/runner.js';

function excerptKey(item: { source: string; quote: string }): string {
  return JSON.stringify([item.source, normalizeText(item.quote)]);
}

function riskCueTokens(text: string): Set<string> {
  return new Set(
    [...text.matchAll(RISK_CUE_PATTERN)].map((match) => match[0].toLowerCase()),
  );
}

function longQuoteTokens(text: string): Set<string> {
  return new Set(
    [...text.matchAll(LONG_QUOTE_PATTERN)].map((match) =>
      normalizeText(match[0]).toLowerCase(),
    ),
  );
}

function numberTokens(text: string): Set<string> {
  return new Set(text.match(/\d+/g) ?? []);
}

function contentWordTokens(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .toLowerCase()
      .match(/[\p{L}\p{N}]{4,}/gu) ?? [],
  );
}

function isSubset<T>(candidate: ReadonlySet<T>, baseline: ReadonlySet<T>) {
  for (const item of candidate) {
    if (!baseline.has(item)) return false;
  }
  return true;
}

function hasSufficientTopicOverlap(a: string, b: string): boolean {
  const left = contentWordTokens(a);
  const right = contentWordTokens(b);
  const denom = Math.min(left.size, right.size);
  if (denom === 0) return false;
  let shared = 0;
  for (const word of left) {
    if (right.has(word)) shared++;
  }
  return shared / denom >= 0.5;
}

export function adversarialBinding(record: unknown, assessment: Assessment) {
  return {
    profile_hash: profileHash(record),
    assessment_hash: hash(assessment),
  };
}

export function currentAdversarialCheckpoint(
  record: Record<string, unknown>,
  assessment: Assessment,
) {
  const pending = asRecord(record.meta, 'meta').pending_adversarial;
  if (pending === undefined) return;
  const checkpoint = asRecord(pending, 'pending adversarial checks');
  const binding = adversarialBinding(record, assessment);
  if (
    checkpoint.profile_hash === binding.profile_hash &&
    checkpoint.assessment_hash === binding.assessment_hash
  )
    return checkpoint;
}

export async function validateAdversarialEvidence(
  directory: string,
  checks: readonly AdversarialCheck[],
  assessment?: Assessment,
) {
  const checkSourceIds = new Set(
    checks.flatMap((check) =>
      check.counterevidence.map(({ source }) => source),
    ),
  );
  const snapshots = await Promise.all(
    [...checkSourceIds].map((id) => readSnapshot(directory, id)),
  );
  const checkFindings = checks.map(({ path, counterevidence }) => ({
    path,
    evidence: [],
    counterevidence,
  }));
  const errors = checkEvidence({ findings: checkFindings }, snapshots);
  const overlappingAssessmentFindings = assessment
    ? assessment.findings.filter((finding) =>
        findingExcerpts(finding).some(({ source }) =>
          checkSourceIds.has(source),
        ),
      )
    : [];
  errors.push(
    ...sourceClassificationIssues(
      { findings: [...overlappingAssessmentFindings, ...checkFindings] },
      snapshots,
    ),
  );
  if (errors.length) throw new Error([...new Set(errors)].join('\n'));
}

export async function reusableAdversarialChecks({
  filePath,
  profilesDir,
  qid,
  targets,
  assessment: currentAssessment,
}: {
  filePath: string;
  profilesDir: string;
  qid: string;
  targets: readonly AdversarialTarget[];
  assessment?: Assessment;
}) {
  const history = path.join(profilesDir, 'verification-history', qid);
  const archived = await readdir(history).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    },
  );
  const candidates = [
    { file: reportPathFor(filePath), archived: false },
    ...archived
      .filter((name) => name.endsWith('.json'))
      .sort()
      .map((name) => ({
        file: path.join(history, name),
        archived: true,
      })),
  ];
  const reused = new Map<number, { check: AdversarialCheck; model: string }>();
  const evidenceDir = path.join(profilesDir, 'evidence');
  const pathCounterevidenceKeys = new Map<string, Set<string>>();
  for (const target of targets) {
    const keys = pathCounterevidenceKeys.get(target.path) ?? new Set<string>();
    for (const item of target.existing_counterevidence)
      keys.add(excerptKey(item));
    pathCounterevidenceKeys.set(target.path, keys);
  }
  if (currentAssessment) {
    for (const finding of currentAssessment.findings) {
      const keys =
        pathCounterevidenceKeys.get(finding.path) ?? new Set<string>();
      for (const item of finding.counterevidence ?? [])
        keys.add(excerptKey(item));
      pathCounterevidenceKeys.set(finding.path, keys);
    }
  }
  for (const candidate of candidates) {
    if (reused.size === targets.length) break;
    let saved: unknown;
    try {
      saved = JSON.parse(await readFile(candidate.file, 'utf8'));
    } catch (error) {
      if (
        error instanceof SyntaxError ||
        (error as NodeJS.ErrnoException).code === 'ENOENT'
      )
        continue;
      throw error;
    }
    try {
      const report = asRecord(
        candidate.archived ? asRecord(saved, 'archive').report : saved,
        'report',
      );
      if (asRecord(report.subject, 'report subject').qid !== qid) continue;
      const priorAssessment = parseAssessment(report.assessment);
      const adversarial = asRecord(
        report.adversarial,
        'saved adversarial result',
      );
      const model = asString(adversarial.model, 'adversarial model');
      if (!model.trim()) continue;
      const byClaim = new Map<string, AdversarialCheck>();
      const byPathConflict = new Map<
        string,
        {
          check: AdversarialCheck;
          finding: Assessment['findings'][number];
          keys: string[];
        }[]
      >();
      const byPathClean = new Map<
        string,
        { check: AdversarialCheck; finding: Assessment['findings'][number] }[]
      >();
      const targetPaths = new Set(
        targets
          .filter((target) => !reused.has(target.finding_index))
          .map((target) => target.path),
      );
      for (const value of asArray(adversarial.checks, 'adversarial checks')) {
        try {
          const { finding_index } = asRecord(value, 'saved adversarial check');
          if (typeof finding_index !== 'number') continue;
          const finding = priorAssessment.findings[finding_index];
          if (!finding || !targetPaths.has(finding.path)) continue;
          const claimHash = hash({ path: finding.path, claim: finding.claim });
          const exactNeeded =
            !byClaim.has(claimHash) &&
            targets.some(
              (target) =>
                target.claim_hash === claimHash &&
                !reused.has(target.finding_index),
            );
          const rawCheck = asRecord(value, 'saved adversarial check');
          const conflictCandidate =
            rawCheck.outcome === 'conflict_found' &&
            targets.some(
              (target) =>
                target.path === finding.path &&
                (pathCounterevidenceKeys.get(target.path)?.size ?? 0) > 0 &&
                !reused.has(target.finding_index),
            );
          const cleanCandidate =
            rawCheck.outcome === 'no_conflict_found' &&
            targets.some(
              (target) =>
                target.path === finding.path &&
                !reused.has(target.finding_index),
            );
          if (!exactNeeded && !conflictCandidate && !cleanCandidate) continue;
          const [check] = parseAdversarialResult({ checks: [value] }, [
            { finding_index, path: finding.path },
          ]);
          if (!check) continue;
          await validateAdversarialEvidence(evidenceDir, [check]);
          if (exactNeeded) byClaim.set(claimHash, check);
          if (
            check.outcome === 'conflict_found' &&
            check.counterevidence.length > 0
          ) {
            const entries = byPathConflict.get(finding.path) ?? [];
            entries.push({
              check,
              finding,
              keys: check.counterevidence.map(excerptKey),
            });
            byPathConflict.set(finding.path, entries);
          } else if (check.outcome === 'no_conflict_found') {
            const entries = byPathClean.get(finding.path) ?? [];
            entries.push({ check, finding });
            byPathClean.set(finding.path, entries);
          }
        } catch {
          // A malformed check or missing evidence makes that claim ineligible.
        }
      }
      for (const target of targets) {
        if (reused.has(target.finding_index)) continue;
        const exact = byClaim.get(target.claim_hash);
        if (exact) {
          reused.set(target.finding_index, {
            check: { ...exact, finding_index: target.finding_index },
            model,
          });
          continue;
        }
        const targetCues = riskCueTokens(target.claim);
        const targetQuotes = longQuoteTokens(target.claim);
        const existingKeys = pathCounterevidenceKeys.get(target.path);
        const conflictMatch =
          existingKeys && existingKeys.size > 0
            ? byPathConflict.get(target.path)?.find(({ finding, keys }) => {
                if (!keys.every((key) => existingKeys.has(key))) return false;
                return (
                  isSubset(targetCues, riskCueTokens(finding.claim)) &&
                  isSubset(targetQuotes, longQuoteTokens(finding.claim))
                );
              })
            : undefined;
        if (conflictMatch) {
          reused.set(target.finding_index, {
            check: {
              ...conflictMatch.check,
              finding_index: target.finding_index,
            },
            model,
          });
          continue;
        }
        const currentFinding =
          currentAssessment?.findings[target.finding_index];
        const targetNumbers = numberTokens(target.claim);
        const cleanMatch = byPathClean.get(target.path)?.find(({ finding }) => {
          if (
            currentFinding &&
            finding.risk === 'ordinary' &&
            currentFinding.risk === 'corroborate'
          )
            return false;
          return (
            isSubset(targetCues, riskCueTokens(finding.claim)) &&
            isSubset(targetQuotes, longQuoteTokens(finding.claim)) &&
            isSubset(targetNumbers, numberTokens(finding.claim)) &&
            hasSufficientTopicOverlap(target.claim, finding.claim)
          );
        });
        if (cleanMatch) {
          reused.set(target.finding_index, {
            check: { ...cleanMatch.check, finding_index: target.finding_index },
            model,
          });
        }
      }
    } catch {
      // Older or incomplete reports may have no usable adversarial results.
    }
  }
  return [...reused.values()];
}
