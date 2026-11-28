import {
  DETAIL_LEVEL_FAME_SCORE_FLOORS,
  meetsFameScoreFloor,
  type SearchIndex,
} from '@o-tempora/shared-types';
import { expect, test } from 'vitest';
import { CURIOSITIES, type CuriosityMark } from './curiosities';

interface DatasetEntry {
  slug: string;
  lifespan?: { start: Month; end?: Month };
  period?: { start: Month; end?: Month };
  at?: Month;
}
type Month = { year: number; month?: number };

const modules = import.meta.glob<DatasetEntry[]>(
  '../../../../shared-types/src/data/{people,conflicts,milestones}.detail?.json',
  { eager: true, import: 'default' },
);
const dataset = new Map<string, DatasetEntry>(
  Object.values(modules)
    .flat()
    .map((entry) => [entry.slug, entry]),
);

const searchIndexes = import.meta.glob<SearchIndex>(
  '../../../../shared-types/src/data/search-index*.json',
  { import: 'default' },
);

interface ShippedProfile {
  keyMoments: { text: string }[];
  connections: { slug: string }[];
  deepFacts: { text: string }[];
}

const profiles = import.meta.glob<ShippedProfile>(
  '../../../../shared-types/src/data/profiles/{en,ru}/*.json',
  { import: 'default' },
);

// Pin a distinctive phrase in both editions so a reordered passage fails here.
const EXPECTED_ANCHOR_TARGETS: Record<string, Record<'en' | 'ru', string>> = {
  'shelley-summer': { en: 'Villa Diodati', ru: 'вилле Диодати' },
  'vermeer-leeuwenhoek': { en: 'Catharina Bolnes', ru: 'Катарины Болнес' },
  'einstein-szilard': { en: 'refrigerator', ru: 'холодильника' },
  'leonardo-michelangelo': { en: 'Battle of Cascina', ru: 'битвы при Кашине' },
  'tolstoy-gandhi': { en: 'Tolstoy Farm', ru: 'ферме Толстого' },
  'charlemagne-elephant': { en: 'Abul-Abbas', ru: 'Абуль-Аббас' },
  'curie-x-rays': { en: 'dynamo', ru: 'динамо-машины' },
};

function publishedDates(mark: CuriosityMark): { start: Month; end?: Month } {
  const entry = dataset.get(mark.slug);
  if (!entry) throw new Error(`${mark.slug} is not in the published dataset`);
  const span = entry.lifespan ?? entry.period;
  if (span) return span;
  if (entry.at) return { start: entry.at };
  throw new Error(`${mark.slug} has no dates`);
}

test('every curiosity mark matches the published dataset to the month', () => {
  for (const curiosity of CURIOSITIES) {
    for (const mark of curiosity.marks) {
      const published = publishedDates(mark);
      expect(mark.start, `${mark.slug} start`).toEqual(published.start);
      expect(mark.end, `${mark.slug} end`).toEqual(published.end);
    }
  }
});

test('curiosity ids are unique', () => {
  const ids = CURIOSITIES.map((curiosity) => curiosity.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test('each curiosity window holds the part of the story it tells', () => {
  for (const curiosity of CURIOSITIES) {
    const [from, to] = curiosity.window;
    expect(from).toBeLessThan(to);
    for (const tick of curiosity.ticks) {
      expect(tick).toBeGreaterThanOrEqual(from);
      expect(tick).toBeLessThan(to);
    }
  }
});

test('each lead is one of its curiosity’s marks', () => {
  for (const curiosity of CURIOSITIES) {
    expect(
      curiosity.marks.map((mark) => mark.slug),
      curiosity.id,
    ).toContain(curiosity.lead);
  }
});

test.each(['search-index.json', 'search-index.ru.json'])(
  'each lead is eligible at Deep Cut and listed in %s',
  async (indexFile) => {
    const load =
      searchIndexes[`../../../../shared-types/src/data/${indexFile}`];
    if (!load) throw new Error(`Missing ${indexFile}`);
    const index = await load();
    const lanes = ['people', 'conflicts', 'milestones'] as const;
    for (const { lead } of CURIOSITIES) {
      expect(
        lanes.some((lane) =>
          index[lane].some(
            (entry) =>
              entry.slug === lead &&
              meetsFameScoreFloor(
                entry,
                lane,
                DETAIL_LEVEL_FAME_SCORE_FLOORS[lane][3],
              ),
          ),
        ),
        lead,
      ).toBe(true);
    }
  },
);

test.each(['en', 'ru'] as const)(
  '%s ships every mark and links the lead passage to a companion',
  async (locale) => {
    for (const curiosity of CURIOSITIES) {
      const { kind, index } = curiosity.anchor;
      for (const mark of curiosity.marks) {
        const path = `../../../../shared-types/src/data/profiles/${locale}/${mark.slug}.json`;
        const load = profiles[path];
        expect(load, path).toBeDefined();
        if (mark.slug !== curiosity.lead || !load) continue;
        const profile = await load();
        const passages =
          kind === 'moment' ? profile.keyMoments : profile.deepFacts;
        expect(passages[index - 1]?.text, curiosity.id).toContain(
          EXPECTED_ANCHOR_TARGETS[curiosity.id]?.[locale],
        );
        expect(
          profile.connections.some((link) =>
            curiosity.marks.some(
              (m) => m.slug !== curiosity.lead && m.slug === link.slug,
            ),
          ),
          curiosity.id,
        ).toBe(true);
      }
    }
  },
);
