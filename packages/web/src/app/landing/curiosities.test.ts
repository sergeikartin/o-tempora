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
      if (mark.end) expect(mark.end, `${mark.slug} end`).toEqual(published.end);
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
