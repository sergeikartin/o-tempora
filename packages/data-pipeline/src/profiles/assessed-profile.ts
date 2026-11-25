import { type ModelProfile, parseModelProfile } from './model-profile.js';
import { passages } from './passages.js';
import { asArray, asRecord, asString } from './values.js';
import {
  type Assessment,
  hash,
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

function parseDropIndices(
  value: unknown,
  length: number,
  field: string,
): Set<number> {
  if (value === undefined) return new Set();
  const dropped = new Set<number>();
  for (const item of asArray(value, field)) {
    if (
      typeof item !== 'number' ||
      !Number.isInteger(item) ||
      item < 0 ||
      item >= length ||
      dropped.has(item)
    ) {
      throw new Error(`${field}: invalid or duplicate index ${String(item)}`);
    }
    dropped.add(item);
  }
  return dropped;
}

function indexMap(length: number, dropped: ReadonlySet<number>) {
  const map = new Map<number, number>();
  let next = 0;
  for (let i = 0; i < length; i++) {
    if (!dropped.has(i)) map.set(i, next++);
  }
  return map;
}

function remapPath(
  path: string,
  deepFactMap: ReadonlyMap<number, number>,
  connectionMap: ReadonlyMap<number, number>,
): string | undefined {
  const df = /^deep_facts\.(\d+)(?=\.)/.exec(path);
  if (df) {
    const next = deepFactMap.get(Number(df[1]));
    return next === undefined
      ? undefined
      : `deep_facts.${next}${path.slice(df[0].length)}`;
  }
  const conn = /^connections\.(\d+)(?=\.)/.exec(path);
  if (conn) {
    const next = connectionMap.get(Number(conn[1]));
    return next === undefined
      ? undefined
      : `connections.${next}${path.slice(conn[0].length)}`;
  }
  return path;
}

export function isRepairPatch(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    record.patches !== undefined ||
    (record.overview === undefined &&
      (record.drop_deep_facts !== undefined ||
        record.drop_connections !== undefined ||
        record.subject_dates !== undefined))
  );
}

export function applyRepairPatch(
  currentProfile: ModelProfile,
  currentAssessment: Assessment,
  value: unknown,
): { profile: ModelProfile; assessment: Assessment; repairedPaths: string[] } {
  const root = asRecord(value, 'repair patch');
  const rawPatches =
    root.patches === undefined
      ? {}
      : asRecord(root.patches, 'repair patch.patches');
  const validPaths = new Set(passages(currentProfile).map((item) => item.path));
  const dropDeepFacts = parseDropIndices(
    root.drop_deep_facts,
    currentProfile.deep_facts.length,
    'drop_deep_facts',
  );
  const dropConnections = parseDropIndices(
    root.drop_connections,
    currentProfile.connections.length,
    'drop_connections',
  );
  const deepFactMap = indexMap(currentProfile.deep_facts.length, dropDeepFacts);
  const connectionMap = indexMap(
    currentProfile.connections.length,
    dropConnections,
  );

  const nextProfile: ModelProfile = structuredClone(currentProfile);
  const patchedFindings = new Map<string, Record<string, unknown>[]>();
  const touchedRawPaths = new Set<string>();

  for (const [patchPath, patchValue] of Object.entries(rawPatches)) {
    if (!validPaths.has(patchPath))
      throw new Error(`repair patch: unknown passage path ${patchPath}`);
    const dfMatch = /^deep_facts\.(\d+)\.text$/.exec(patchPath);
    if (dfMatch && dropDeepFacts.has(Number(dfMatch[1])))
      throw new Error(`repair patch: cannot patch dropped ${patchPath}`);
    const connMatch = /^connections\.(\d+)\.connection$/.exec(patchPath);
    if (connMatch && dropConnections.has(Number(connMatch[1])))
      throw new Error(`repair patch: cannot patch dropped ${patchPath}`);

    const patch = asRecord(patchValue, `patches.${patchPath}`);
    const text = asString(patch.text, `patches.${patchPath}.text`);
    const findings = asArray(
      patch.findings,
      `patches.${patchPath}.findings`,
    ).map((item) => ({
      ...asRecord(item, `patches.${patchPath}.finding`),
      path: patchPath,
    }));
    patchedFindings.set(patchPath, findings);
    touchedRawPaths.add(patchPath);

    if (patchPath === 'overview') {
      nextProfile.overview = text;
    } else if (patchPath.startsWith('key_moments.')) {
      const match = /^key_moments\.(\d+)\.(date|title|text)$/.exec(patchPath);
      const index = Number(match?.[1]);
      const field = match?.[2] as 'date' | 'title' | 'text';
      const moment = nextProfile.key_moments[index];
      if (!moment) throw new Error(`repair patch: missing ${patchPath}`);
      moment[field] = text;
      if (patch.source !== undefined) {
        if (field !== 'text')
          throw new Error(
            `repair patch: source belongs on key_moments.${index}.text`,
          );
        moment.source = asString(patch.source, `patches.${patchPath}.source`);
      }
    } else if (dfMatch) {
      const fact = nextProfile.deep_facts[Number(dfMatch[1])];
      if (!fact) throw new Error(`repair patch: missing ${patchPath}`);
      fact.text = text;
      if (patch.source !== undefined)
        fact.source = asString(patch.source, `patches.${patchPath}.source`);
      if (patch.type !== undefined)
        fact.type = patch.type as ModelProfile['deep_facts'][number]['type'];
      if (patch.is_legend !== undefined) {
        if (typeof patch.is_legend !== 'boolean')
          throw new Error(`patches.${patchPath}.is_legend: expected boolean`);
        fact.is_legend = patch.is_legend;
      }
      if (patch.confidence !== undefined)
        fact.confidence =
          patch.confidence as ModelProfile['deep_facts'][number]['confidence'];
    } else if (connMatch) {
      const connection = nextProfile.connections[Number(connMatch[1])];
      if (!connection) throw new Error(`repair patch: missing ${patchPath}`);
      connection.connection = text;
      if (patch.importance !== undefined)
        connection.importance =
          patch.importance as ModelProfile['connections'][number]['importance'];
    }
  }

  nextProfile.deep_facts = nextProfile.deep_facts.filter(
    (_, index) => !dropDeepFacts.has(index),
  );
  nextProfile.connections = nextProfile.connections.filter(
    (_, index) => !dropConnections.has(index),
  );
  const profile = parseModelProfile(nextProfile, 'repaired Profile');

  const findingsByOldPath = new Map<string, Record<string, unknown>[]>();
  for (const finding of currentAssessment.findings) {
    const list = findingsByOldPath.get(finding.path) ?? [];
    list.push({ ...finding });
    findingsByOldPath.set(finding.path, list);
  }
  const mergedFindings: Record<string, unknown>[] = [];
  for (const item of passages(currentProfile)) {
    const mapped = remapPath(item.path, deepFactMap, connectionMap);
    if (mapped === undefined) continue;
    const sourceFindings =
      patchedFindings.get(item.path) ?? findingsByOldPath.get(item.path) ?? [];
    for (const finding of sourceFindings) {
      mergedFindings.push({ ...finding, path: mapped });
    }
  }

  const subject_dates =
    root.subject_dates !== undefined
      ? root.subject_dates
      : currentAssessment.subject_dates.flatMap((entry) => {
          const mapped = remapPath(entry.path, deepFactMap, connectionMap);
          return mapped === undefined ? [] : [{ ...entry, path: mapped }];
        });

  const assessment = parseAssessment({
    covered: passages(profile).map((item) => item.path),
    uncovered: root.uncovered ?? [],
    issues: root.issues ?? [],
    coherent: root.coherent ?? true,
    subject_dates,
    findings: mergedFindings,
  });

  const repairedPaths = [...touchedRawPaths]
    .map((item) => remapPath(item, deepFactMap, connectionMap))
    .filter((item): item is string => item !== undefined)
    .sort();

  return { profile, assessment, repairedPaths };
}

export function extractRepairResult(
  currentProfile: ModelProfile,
  currentAssessment: Assessment,
  value: unknown,
): { profile: ModelProfile; assessment: Assessment; repairedPaths: string[] } {
  if (isRepairPatch(value)) {
    return applyRepairPatch(currentProfile, currentAssessment, value);
  }
  const { profile, assessment } = extractAssessedProfile(value);
  const oldText = new Map(
    passages(currentProfile).map((item) => [item.path, item.text]),
  );
  const oldFindings = new Map<string, unknown[]>();
  for (const finding of currentAssessment.findings) {
    const list = oldFindings.get(finding.path) ?? [];
    list.push(finding);
    oldFindings.set(finding.path, list);
  }
  const newFindings = new Map<string, unknown[]>();
  for (const finding of assessment.findings) {
    const list = newFindings.get(finding.path) ?? [];
    list.push(finding);
    newFindings.set(finding.path, list);
  }
  const repairedPaths: string[] = [];
  for (const item of passages(profile)) {
    if (
      oldText.get(item.path) !== item.text ||
      hash(oldFindings.get(item.path) ?? []) !==
        hash(newFindings.get(item.path) ?? [])
    ) {
      repairedPaths.push(item.path);
    }
  }
  return { profile, assessment, repairedPaths };
}

export function flaggedRepairPaths(
  profile: ModelProfile,
  assessment: Assessment,
  blockers: readonly string[],
): { paths: string[]; global: boolean } {
  const valid = new Set(passages(profile).map((item) => item.path));
  const paths = new Set<string>();
  let global = false;
  for (const blocker of blockers) {
    const prefix = blocker.split(':', 1)[0]?.trim() ?? '';
    if (valid.has(prefix)) {
      paths.add(prefix);
      continue;
    }
    const evidenceMatch = /^evidence\.([a-f0-9]{64})$/.exec(prefix);
    if (evidenceMatch) {
      const sourceId = evidenceMatch[1];
      let matched = false;
      for (const finding of assessment.findings) {
        const all = [...finding.evidence, ...(finding.counterevidence ?? [])];
        if (all.some((item) => item.source === sourceId)) {
          paths.add(finding.path);
          matched = true;
        }
      }
      if (!matched) global = true;
      continue;
    }
    global = true;
  }
  return { paths: [...paths].sort(), global };
}

export function readPendingAssessment(record: Record<string, unknown>) {
  const pending = asRecord(record.meta, 'meta').pending_assessment;
  if (pending === undefined) return;
  const fields = asRecord(pending, 'pending assessment');
  if (fields.profile_hash !== profileHash(record)) return;
  return {
    assessment: parseAssessment(fields.assessment),
    model: asString(fields.model, 'pending assessment model'),
    ...(fields.repaired_paths !== undefined
      ? { repairedPaths: strings(fields.repaired_paths, 'repaired_paths') }
      : {}),
    ...(fields.prior_blockers !== undefined
      ? { priorBlockers: strings(fields.prior_blockers, 'prior_blockers') }
      : {}),
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
