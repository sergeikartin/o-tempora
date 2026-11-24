import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { readSnapshot } from './evidence-cache.js';
import { asArray, asRecord, asString } from './values.js';
import {
  type AdversarialCheck,
  type AdversarialTarget,
  parseAdversarialResult,
} from './verification/adversarial.js';
import {
  type Assessment,
  checkEvidence,
  hash,
  parseAssessment,
  profileHash,
} from './verification/policy.js';
import { reportPathFor } from './verification/runner.js';

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
) {
  const ids = new Set(
    checks.flatMap((check) =>
      check.counterevidence.map(({ source }) => source),
    ),
  );
  const snapshots = await Promise.all(
    [...ids].map((id) => readSnapshot(directory, id)),
  );
  const errors = checkEvidence(
    {
      findings: checks.map(({ path, counterevidence }) => ({
        path,
        evidence: [],
        counterevidence,
      })),
    },
    snapshots,
  );
  if (errors.length) throw new Error(errors.join('\n'));
}

export async function reusableAdversarialChecks({
  filePath,
  profilesDir,
  qid,
  targets,
}: {
  filePath: string;
  profilesDir: string;
  qid: string;
  targets: readonly AdversarialTarget[];
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
      const assessment = parseAssessment(report.assessment);
      const adversarial = asRecord(
        report.adversarial,
        'saved adversarial result',
      );
      const model = asString(adversarial.model, 'adversarial model');
      if (!model.trim()) continue;
      const byClaim = new Map<string, AdversarialCheck>();
      for (const value of asArray(adversarial.checks, 'adversarial checks')) {
        try {
          const { finding_index } = asRecord(value, 'saved adversarial check');
          if (typeof finding_index !== 'number') continue;
          const finding = assessment.findings[finding_index];
          if (!finding) continue;
          const claimHash = hash({ path: finding.path, claim: finding.claim });
          if (
            byClaim.has(claimHash) ||
            !targets.some(
              (target) =>
                target.claim_hash === claimHash &&
                !reused.has(target.finding_index),
            )
          )
            continue;
          const [check] = parseAdversarialResult({ checks: [value] }, [
            { finding_index, path: finding.path },
          ]);
          if (!check) continue;
          await validateAdversarialEvidence(evidenceDir, [check]);
          byClaim.set(claimHash, check);
        } catch {
          // A malformed check or missing evidence makes that claim ineligible.
        }
      }
      for (const target of targets) {
        const check = byClaim.get(target.claim_hash);
        if (check && !reused.has(target.finding_index))
          reused.set(target.finding_index, {
            check: { ...check, finding_index: target.finding_index },
            model,
          });
      }
    } catch {
      // Older or incomplete reports may have no usable adversarial results.
    }
  }
  return [...reused.values()];
}
