import { logError } from '../shared/lib/log-error';
import { getLocale } from '../shared/paraglide/runtime.js';
import type { ConflictEntry, Milestone, Person } from '../shared/types';

export interface LocaleDatasets {
  people: Person[];
  conflicts: ConflictEntry[];
  milestones: Milestone[];
}

// A tripwire for schema drift between the pipeline's output and the frontend:
// a missing id or non-finite year would otherwise crash deep inside D3
// rendering with no clear cause.
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

// Each lane's key paired with the entityType validateEntries logs under.
const LANES = [
  { key: 'people', entityType: 'person' },
  { key: 'conflicts', entityType: 'conflict' },
  { key: 'milestones', entityType: 'milestone' },
] as const;

type LaneKey = (typeof LANES)[number]['key'];

type DatasetModule = { default: unknown };
type Importer = () => Promise<DatasetModule>;

// Each lane's dataset ships as 4 delta files per locale, one per Detail Level
// (CONTEXT.md, docs/adr/0006-detail-level-merges-data-depth-and-payload-tier.md,
// web/docs/adr/0009). Every import() must be a literal specifier so Vite
// keeps each file its own chunk, which is why this is a table of 24 literal
// imports; a missing level/locale/lane combination is a type error.
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

// Level 1 + 2 combined. Started at module scope so the fetch overlaps the
// initial render.
export const localeDatasetsPromise: Promise<LocaleDatasets> = Promise.all([
  loadLevel(1, getLocale()),
  loadLevel(2, getLocale()),
]).then(([level1, level2]) => mergeDatasets(level1, level2));

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

// On save-data or a 2G-class connection the idle-prefetch below never runs;
// level 3 then loads only through requestLevel3Load.
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

// Level 3, loaded at idle time so it never competes with level 1+2, or on
// requestLevel3Load for slow/save-data connections.
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

// No-op once level 3 is loading or loaded.
export function requestLevel3Load(): void {
  startLevel3Load?.();
  startLevel3Load = undefined;
}

let startLevel4Load: (() => void) | undefined;
let level4Requested = false;

// Level 4 never auto-starts; it loads when the user selects Deep Cut.
export const level4DatasetPromise: Promise<LocaleDatasets> = new Promise(
  (resolve) => {
    startLevel4Load = () => {
      loadLevel(4, getLocale()).then(resolve);
    };
  },
);

// Deep Cut's view is levels 1-4, so this also starts level 3. No-op past the
// first call.
export function requestLevel4Load(): void {
  requestLevel3Load();
  if (level4Requested) return;
  level4Requested = true;
  startLevel4Load?.();
}
