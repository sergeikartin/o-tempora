import type { CheckVerdict, ProfileDraft, ProfilePatch } from './schemas.ts';

// Normalizes a blocker path such as `keyMoments[0].text` or `deepFacts.1.sourceUrl`
// to its patchable slot (`overview`, `keyMoments.0`, `deepFacts.1`, `connections.2`).
export function normalizePatchTarget(rawPath: string): string | undefined {
  const cleaned = rawPath
    .trim()
    .replace(/\[(\d+)\]/g, '.$1')
    .replace(/^\.+/, '');
  if (cleaned === 'overview' || cleaned.startsWith('overview.')) {
    return 'overview';
  }
  const match = /^(keyMoments|deepFacts|connections)\.(\d+)(?:\.|$)/.exec(
    cleaned,
  );
  if (match?.[1] && match[2]) {
    return `${match[1]}.${match[2]}`;
  }
  // Allow section-level blockers like "connections" to cover any index in that section.
  if (
    cleaned === 'keyMoments' ||
    cleaned === 'deepFacts' ||
    cleaned === 'connections'
  ) {
    return cleaned;
  }
  return undefined;
}

export interface ApplyPatchResult {
  draft: ProfileDraft;
  patchedPaths: string[];
}

function isTargetAllowed(
  target: string,
  allowedTargets: ReadonlySet<string>,
): boolean {
  if (allowedTargets.has(target)) return true;
  const section = target.split('.')[0];
  return section !== undefined && allowedTargets.has(section);
}

// Applies a field-only revision patch strictly within the paths flagged in `check.blockers`.
// Untouched passages remain verbatim identical.
export function applyProfilePatch(
  draft: ProfileDraft,
  check: CheckVerdict,
  patch: ProfilePatch,
): ApplyPatchResult {
  if (check.verdict !== 'revise' || check.blockers.length === 0) {
    throw new Error(
      `Cannot apply patch when check verdict is "${check.verdict}" with ${check.blockers.length} blockers`,
    );
  }

  const allowedTargets = new Set<string>();
  for (const blocker of check.blockers) {
    const normalized = normalizePatchTarget(blocker.path);
    if (normalized) allowedTargets.add(normalized);
  }

  const touchedPaths: string[] = [];
  const disallowed: string[] = [];

  if (patch.overview !== undefined) {
    touchedPaths.push('overview');
    if (!isTargetAllowed('overview', allowedTargets)) {
      disallowed.push('overview');
    }
  }

  const next: ProfileDraft = {
    ...draft,
    ...(patch.overview !== undefined ? { overview: patch.overview } : {}),
    keyMoments: [...draft.keyMoments],
    deepFacts: [...draft.deepFacts],
    connections: [...draft.connections],
  };

  function applySection<T>(
    section: 'keyMoments' | 'deepFacts' | 'connections',
    entries: Record<string, T | null> | undefined,
    items: T[],
  ): T[] {
    if (!entries) return items;
    const dropIndices = new Set<number>();
    const updated = [...items];

    for (const [key, value] of Object.entries(entries)) {
      const index = Number(key);
      const target = `${section}.${index}`;
      touchedPaths.push(target);
      if (!isTargetAllowed(target, allowedTargets)) {
        disallowed.push(target);
        continue;
      }
      if (!Number.isInteger(index) || index < 0 || index >= updated.length) {
        throw new Error(
          `Patch index out of range: ${target} (draft has ${updated.length} items)`,
        );
      }
      if (value === null) {
        dropIndices.add(index);
      } else {
        updated[index] = value;
      }
    }

    return updated.filter((_, index) => !dropIndices.has(index));
  }

  next.keyMoments = applySection(
    'keyMoments',
    patch.keyMoments,
    next.keyMoments,
  );
  next.deepFacts = applySection('deepFacts', patch.deepFacts, next.deepFacts);
  next.connections = applySection(
    'connections',
    patch.connections,
    next.connections,
  );

  if (disallowed.length > 0) {
    throw new Error(
      `Patch modifies unflagged path(s): ${disallowed.join(', ')}. Allowed blocker paths: ${[...allowedTargets].sort().join(', ')}`,
    );
  }

  return { draft: next, patchedPaths: touchedPaths.sort() };
}
