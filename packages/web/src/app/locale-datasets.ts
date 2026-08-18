import { getLocale } from '../shared/paraglide/runtime.js';
import type { Milestone, Person, ConflictEntry } from '../shared/types';

export interface LocaleDatasets {
  people: Person[];
  conflicts: ConflictEntry[];
  milestones: Milestone[];
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
      people: people.default as Person[],
      conflicts: conflicts.default as ConflictEntry[],
      milestones: milestones.default as Milestone[],
    };
  },
  ru: async () => {
    const [people, conflicts, milestones] = await Promise.all([
      import('@same-sky/shared-types/src/data/people.ru.json'),
      import('@same-sky/shared-types/src/data/conflicts.ru.json'),
      import('@same-sky/shared-types/src/data/milestones.ru.json'),
    ]);
    return {
      people: people.default as Person[],
      conflicts: conflicts.default as ConflictEntry[],
      milestones: milestones.default as Milestone[],
    };
  },
};

// Module-scope, started immediately on import rather than inside an effect,
// so the dataset fetch overlaps with initial render instead of trailing it.
export const localeDatasetsPromise: Promise<LocaleDatasets> = loaders[getLocale()]();
