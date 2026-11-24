import { type ModelProfile, parseModelProfile } from './model-profile.js';
import { asArray, asRecord, asString } from './values.js';
import {
  type Assessment,
  parseAssessment,
  profileHash,
  strings,
} from './verification/policy.js';

export function extractAssessedProfile(value: unknown) {
  const root = asRecord(value, 'assessed Profile');
  const covered: string[] = [];
  const findings: Record<string, unknown>[] = [];

  function passage(value: unknown, path: string) {
    const field = asRecord(value, path);
    const text = asString(field.text, `${path}.text`);
    covered.push(path);
    for (const finding of asArray(field.findings, `${path}.findings`)) {
      findings.push({ ...asRecord(finding, `${path}.finding`), path });
    }
    return text;
  }

  const profile = parseModelProfile(
    {
      ...root,
      overview: passage(root.overview, 'overview'),
      key_moments: asArray(root.key_moments, 'key_moments').map(
        (value, index) => {
          const at = `key_moments.${index}`;
          const moment = asRecord(value, at);
          return {
            ...moment,
            date: passage(moment.date, `${at}.date`),
            title: passage(moment.title, `${at}.title`),
            text: passage(moment.text, `${at}.text`),
          };
        },
      ),
      deep_facts: asArray(root.deep_facts, 'deep_facts').map((value, index) => {
        const at = `deep_facts.${index}`;
        const fact = asRecord(value, at);
        return { ...fact, text: passage(fact.text, `${at}.text`) };
      }),
      connections: asArray(root.connections, 'connections').map(
        (value, index) => {
          const at = `connections.${index}`;
          const connection = asRecord(value, at);
          return {
            ...connection,
            connection: passage(connection.connection, `${at}.connection`),
          };
        },
      ),
    },
    'assessed Profile',
  );
  const assessment = parseAssessment({ ...root, covered, findings });
  return { profile, assessment };
}

export function readPendingAssessment(record: Record<string, unknown>) {
  const pending = asRecord(record.meta, 'meta').pending_assessment;
  if (pending === undefined) return;
  const fields = asRecord(pending, 'pending assessment');
  if (fields.profile_hash !== profileHash(record)) return;
  return {
    assessment: parseAssessment(fields.assessment),
    model: asString(fields.model, 'pending assessment model'),
  };
}

export function finalizedAssessment(
  assessment: Assessment,
  profile: ModelProfile,
  draftConnectionUrls?: unknown,
  keptIndices?: readonly number[],
): Assessment {
  if (!keptIndices && draftConnectionUrls === undefined) return assessment;
  const indexes = new Map<number, number>();
  if (keptIndices) {
    for (const [finalIndex, originalIndex] of keptIndices.entries())
      indexes.set(originalIndex, finalIndex);
  } else {
    const draft = strings(draftConnectionUrls, 'connection_urls');
    let next = 0;
    for (const [finalIndex, connection] of profile.connections.entries()) {
      const draftIndex = draft.indexOf(connection.wikipedia_url, next);
      if (draftIndex === -1)
        throw new Error(
          'Research Connection order does not match the finalized Profile',
        );
      indexes.set(draftIndex, finalIndex);
      next = draftIndex + 1;
    }
  }

  function remap(value: string): string[] {
    const match = /^connections\.(\d+)(?=\.)/.exec(value);
    if (!match) return [value];
    const index = indexes.get(Number(match[1]));
    return index === undefined
      ? []
      : [`connections.${index}${value.slice(match[0].length)}`];
  }

  return {
    ...assessment,
    findings: assessment.findings.flatMap((finding) =>
      remap(finding.path).map((path) => ({ ...finding, path })),
    ),
    subject_dates: assessment.subject_dates.flatMap((entry) =>
      remap(entry.path).map((path) => ({ ...entry, path })),
    ),
    covered: assessment.covered.flatMap(remap),
    uncovered: assessment.uncovered.flatMap(remap),
    issues: assessment.issues.flatMap(remap),
  };
}
