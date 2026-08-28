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
type DetailLevelIndex = 1 | 2 | 3 | 4;

// Every lane's own key alongside the entityType string validateEntries logs
// under — the one place this pairing is written down, instead of once per
// loader.
const LANES = [
  { key: 'people', entityType: 'person' },
  { key: 'conflicts', entityType: 'conflict' },
  { key: 'milestones', entityType: 'milestone' },
] as const;

type LaneKey = (typeof LANES)[number]['key'];

type DatasetModule = { default: unknown };
type Importer = () => Promise<DatasetModule>;

// Detail Level (CONTEXT.md, docs/adr/0006-detail-level-merges-data-depth-
// and-payload-tier.md): each lane's dataset ships as 4 pipeline-generated
// delta files per locale (docs/adr/0009), one per Detail Level. Every
// import() below must stay a literal specifier — Vite needs that to keep
// each file its own chunk, so a deeper level and the other locale never end
// up inside level 1/2's eager chunk — which is why this is a lookup table of
// 24 literal imports rather than one templated path. A level/locale/lane
// combination missing from this table is a TypeScript error, not a runtime
// gap.
const IMPORTERS: Record<
  DetailLevelIndex,
  Record<Locale, Record<LaneKey, Importer>>
> = {
  1: {
    en: {
      people: () =>
        import('@o-tempora/shared-types/src/data/people.detail1.json'),
      conflicts: () =>
        import('@o-tempora/shared-types/src/data/conflicts.detail1.json'),
      milestones: () =>
        import('@o-tempora/shared-types/src/data/milestones.detail1.json'),
    },
    ru: {
      people: () =>
        import('@o-tempora/shared-types/src/data/people.detail1.ru.json'),
      conflicts: () =>
        import('@o-tempora/shared-types/src/data/conflicts.detail1.ru.json'),
      milestones: () =>
        import('@o-tempora/shared-types/src/data/milestones.detail1.ru.json'),
    },
  },
  2: {
    en: {
      people: () =>
        import('@o-tempora/shared-types/src/data/people.detail2.json'),
      conflicts: () =>
        import('@o-tempora/shared-types/src/data/conflicts.detail2.json'),
      milestones: () =>
        import('@o-tempora/shared-types/src/data/milestones.detail2.json'),
    },
    ru: {
      people: () =>
        import('@o-tempora/shared-types/src/data/people.detail2.ru.json'),
      conflicts: () =>
        import('@o-tempora/shared-types/src/data/conflicts.detail2.ru.json'),
      milestones: () =>
        import('@o-tempora/shared-types/src/data/milestones.detail2.ru.json'),
    },
  },
  3: {
    en: {
      people: () =>
        import('@o-tempora/shared-types/src/data/people.detail3.json'),
      conflicts: () =>
        import('@o-tempora/shared-types/src/data/conflicts.detail3.json'),
      milestones: () =>
        import('@o-tempora/shared-types/src/data/milestones.detail3.json'),
    },
    ru: {
      people: () =>
        import('@o-tempora/shared-types/src/data/people.detail3.ru.json'),
      conflicts: () =>
        import('@o-tempora/shared-types/src/data/conflicts.detail3.ru.json'),
      milestones: () =>
        import('@o-tempora/shared-types/src/data/milestones.detail3.ru.json'),
    },
  },
  4: {
    en: {
      people: () =>
        import('@o-tempora/shared-types/src/data/people.detail4.json'),
      conflicts: () =>
        import('@o-tempora/shared-types/src/data/conflicts.detail4.json'),
      milestones: () =>
        import('@o-tempora/shared-types/src/data/milestones.detail4.json'),
    },
    ru: {
      people: () =>
        import('@o-tempora/shared-types/src/data/people.detail4.ru.json'),
      conflicts: () =>
        import('@o-tempora/shared-types/src/data/conflicts.detail4.ru.json'),
      milestones: () =>
        import('@o-tempora/shared-types/src/data/milestones.detail4.ru.json'),
    },
  },
};

async function loadLevel(
  level: DetailLevelIndex,
  locale: Locale,
): Promise<LocaleDatasets> {
  const importers = IMPORTERS[level][locale];
  const entries = await Promise.all(
    LANES.map(async ({ key, entityType }) => {
      const module = await importers[key]();
      const validated = validateEntries(
        module.default as (Person | ConflictEntry | Milestone)[],
        entityType,
      );
      return [key, validated] as const;
    }),
  );
  return Object.fromEntries(entries) as unknown as LocaleDatasets;
}

function mergeDatasets(a: LocaleDatasets, b: LocaleDatasets): LocaleDatasets {
  return {
    people: a.people.concat(b.people),
    conflicts: a.conflicts.concat(b.conflicts),
    milestones: a.milestones.concat(b.milestones),
  };
}

// Module-scope, started immediately on import rather than inside an effect,
// so the fetch overlaps with initial render instead of trailing it. Level 1
// + level 2 combined — byte-identical cost to today's eager Mainstream/tier0
// load, since level 2's floor equals it exactly.
export const localeDatasetsPromise: Promise<LocaleDatasets> = Promise.all([
  loadLevel(1, getLocale()),
  loadLevel(2, getLocale()),
]).then(([level1, level2]) => mergeDatasets(level1, level2));

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

// Save-data or a 2G-class connection means the idle-prefetch below never
// runs automatically — level 3 instead loads only on demand, triggered by
// requestLevel3Load (also called by requestLevel4Load below, since level
// 4's cumulative view needs level 3's data too).
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

let startLevel3Load: (() => void) | undefined;

// Resolves once level 3 has loaded — automatically, deferred to idle time,
// so it never competes with level 1+2's render-critical load above, unless
// the connection looks slow/save-data, in which case nothing runs until
// requestLevel3Load is called explicitly.
export const level3DatasetPromise: Promise<LocaleDatasets> = new Promise(
  (resolve) => {
    const run = () => {
      loadLevel(3, getLocale()).then(resolve);
    };
    if (typeof window === 'undefined') {
      run();
      return;
    }
    if (isSaveDataOrSlowConnection()) {
      startLevel3Load = run;
      return;
    }
    const schedule =
      window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 2000));
    schedule(run, { timeout: 4000 });
  },
);

// On-demand fallback for save-data/slow connections, where the automatic
// idle-prefetch above never starts on its own — a no-op once level 3 is
// already loading or loaded.
export function requestLevel3Load(): void {
  startLevel3Load?.();
  startLevel3Load = undefined;
}

let startLevel4Load: (() => void) | undefined;
let level4Requested = false;

// Level 4 never auto-starts, regardless of connection — strictly on demand,
// once the user actually selects Deep Cut (requestLevel4Load below).
export const level4DatasetPromise: Promise<LocaleDatasets> = new Promise(
  (resolve) => {
    startLevel4Load = () => {
      loadLevel(4, getLocale()).then(resolve);
    };
  },
);

// Deep Cut's cumulative view is level 1+2+3+4, so selecting it must also
// make sure level 3 is (or starts) loading, not just level 4 itself — a
// no-op past the first call, or once level 3 is already loading/loaded.
export function requestLevel4Load(): void {
  requestLevel3Load();
  if (level4Requested) return;
  level4Requested = true;
  startLevel4Load?.();
}
