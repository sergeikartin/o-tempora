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

type Locale = 'en' | 'ru';

// Payload Tier (CONTEXT.md, docs/adr/0004-payload-tier-split-defers-low-fame-
// data.md): each lane's dataset ships as two pipeline-generated files, Tier 0
// (what a default-state page load needs) and Tier 1 (the deferred
// remainder). Tier 0 loaders mirror the pre-split per-locale dynamic import
// (docs/adr/0009) exactly; Tier 1 loaders are the same shape, read
// separately below once actually needed.
const tier0Loaders: Record<Locale, () => Promise<LocaleDatasets>> = {
  en: async () => {
    const [people, conflicts, milestones] = await Promise.all([
      import('@same-sky/shared-types/src/data/people.tier0.json'),
      import('@same-sky/shared-types/src/data/conflicts.tier0.json'),
      import('@same-sky/shared-types/src/data/milestones.tier0.json'),
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
      import('@same-sky/shared-types/src/data/people.tier0.ru.json'),
      import('@same-sky/shared-types/src/data/conflicts.tier0.ru.json'),
      import('@same-sky/shared-types/src/data/milestones.tier0.ru.json'),
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

const tier1Loaders: Record<Locale, () => Promise<LocaleDatasets>> = {
  en: async () => {
    const [people, conflicts, milestones] = await Promise.all([
      import('@same-sky/shared-types/src/data/people.tier1.json'),
      import('@same-sky/shared-types/src/data/conflicts.tier1.json'),
      import('@same-sky/shared-types/src/data/milestones.tier1.json'),
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
      import('@same-sky/shared-types/src/data/people.tier1.ru.json'),
      import('@same-sky/shared-types/src/data/conflicts.tier1.ru.json'),
      import('@same-sky/shared-types/src/data/milestones.tier1.ru.json'),
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
  tier0Loaders[getLocale()]();

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

// Save-data or a 2G-class connection means the idle-prefetch below never
// runs automatically — Tier 1 instead loads only on demand, triggered by
// requestTier1Load (features/filter-by-fame-score's Deep Cut control calls
// it when the user actually asks for the deeper data).
function isSaveDataOrSlowConnection(): boolean {
  const connection = (
    navigator as Navigator & { connection?: NetworkInformation }
  ).connection;
  if (!connection) return false;
  return (
    connection.saveData === true ||
    connection.effectiveType === 'slow-2g' ||
    connection.effectiveType === '2g'
  );
}

let startTier1Load: (() => void) | undefined;

// Resolves once Tier 1 has loaded — automatically, deferred to idle time, so
// it never competes with Tier 0's render-critical load above, unless the
// connection looks slow/save-data, in which case nothing runs until
// requestTier1Load is called explicitly.
export const tier1DatasetsPromise: Promise<LocaleDatasets> = new Promise(
  (resolve) => {
    const run = () => {
      tier1Loaders[getLocale()]().then(resolve);
    };
    if (typeof window === 'undefined') {
      run();
      return;
    }
    if (isSaveDataOrSlowConnection()) {
      startTier1Load = run;
      return;
    }
    const schedule =
      window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 2000));
    schedule(run, { timeout: 4000 });
  },
);

// On-demand fallback for save-data/slow connections, where the automatic
// idle-prefetch above never starts on its own — a no-op once Tier 1 is
// already loading or loaded.
export function requestTier1Load(): void {
  startTier1Load?.();
  startTier1Load = undefined;
}
