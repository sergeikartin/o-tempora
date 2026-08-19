import { logError } from '../shared/lib/log-error';
import { getLocale } from '../shared/paraglide/runtime.js';
import type { ConflictEntry, Milestone, Person } from '../shared/types';

export interface LocaleDatasets {
  people: Person[];
  conflicts: ConflictEntry[];
  milestones: Milestone[];
}

// The datasets are pipeline-generated, never hand-edited (CLAUDE.md), so
// this isn't validating user input — it's a tripwire for schema drift
// between the pipeline's output and what the frontend expects, since a
// missing id or a non-finite year would otherwise surface as a confusing
// crash deep inside D3 rendering rather than a clear, attributable error.
function primaryYear(entry: Person | ConflictEntry | Milestone): unknown {
  if ('lifespan' in entry) return entry.lifespan.start.year;
  if ('period' in entry) return entry.period.start.year;
  return entry.at.year;
}

export function validateEntries<T extends Person | ConflictEntry | Milestone>(
  entries: T[],
  entityType: string,
): T[] {
  return entries.filter((entry) => {
    if (!entry.id || !entry.name) {
      logError(new Error(`${entityType} entry missing id or name`), {
        entityType,
        entry,
      });
      return false;
    }
    const year = primaryYear(entry);
    if (typeof year !== 'number' || !Number.isFinite(year)) {
      logError(new Error(`${entityType} entry has a non-finite date`), {
        entityType,
        id: entry.id,
        year,
      });
      return false;
    }
    return true;
  });
}

// Per-locale dynamic import (docs/adr/0009) — keeps a single page load's
// payload one language's worth of data (~4MB) rather than bundling both
// people.json and people.ru.json (and their conflicts/milestones
// siblings) into every build.
const loaders: Record<'en' | 'ru', () => Promise<LocaleDatasets>> = {
  en: async () => {
    const [people, conflicts, milestones] = await Promise.all([
      import('@same-sky/shared-types/src/data/people.json'),
      import('@same-sky/shared-types/src/data/conflicts.json'),
      import('@same-sky/shared-types/src/data/milestones.json'),
    ]);
    return {
      people: validateEntries(people.default as Person[], 'person'),
      conflicts: validateEntries(
        conflicts.default as ConflictEntry[],
        'conflict',
      ),
      milestones: validateEntries(
        milestones.default as Milestone[],
        'milestone',
      ),
    };
  },
  ru: async () => {
    const [people, conflicts, milestones] = await Promise.all([
      import('@same-sky/shared-types/src/data/people.ru.json'),
      import('@same-sky/shared-types/src/data/conflicts.ru.json'),
      import('@same-sky/shared-types/src/data/milestones.ru.json'),
    ]);
    return {
      people: validateEntries(people.default as Person[], 'person'),
      conflicts: validateEntries(
        conflicts.default as ConflictEntry[],
        'conflict',
      ),
      milestones: validateEntries(
        milestones.default as Milestone[],
        'milestone',
      ),
    };
  },
};

// Module-scope, started immediately on import rather than inside an effect,
// so the dataset fetch overlaps with initial render instead of trailing it.
export const localeDatasetsPromise: Promise<LocaleDatasets> =
  loaders[getLocale()]();
