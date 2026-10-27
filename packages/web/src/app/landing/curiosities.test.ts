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

interface ShippedProfile {
  keyMoments: { date: string }[];
  deepFacts: { text: string }[];
}

// Only reviewed Profiles ship, so this is empty until the first batch is
// promoted.
const profileModules = import.meta.glob<ShippedProfile>(
  '../../../../shared-types/src/data/profiles/en/*.json',
  { eager: true, import: 'default' },
);
const shippedProfiles = new Map<string, ShippedProfile>(
  Object.entries(profileModules).map(([path, profile]) => [
    path.replace(/^.*\//, '').replace(/\.json$/, ''),
    profile,
  ]),
);

// What each anchored Curiosity's anchor must still point at: a Key Moment's
// date, or a phrase of a Deep Fact. A regenerated Profile that moves it fails
// here instead of silently accenting the wrong item.
const EXPECTED_ANCHOR_TARGETS: Record<string, string> = {};

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

test('each lead is one of its curiosity’s marks', () => {
  for (const curiosity of CURIOSITIES) {
    expect(
      curiosity.marks.map((mark) => mark.slug),
      curiosity.id,
    ).toContain(curiosity.lead);
  }
});

test('an anchor points at the expected item of its lead’s shipped Profile', () => {
  for (const curiosity of CURIOSITIES) {
    if (!curiosity.anchor) continue;
    const { kind, index } = curiosity.anchor;
    const profile = shippedProfiles.get(curiosity.lead);
    expect(
      profile,
      `${curiosity.id} anchor needs a shipped Profile`,
    ).toBeDefined();
    const expected = EXPECTED_ANCHOR_TARGETS[curiosity.id];
    expect(
      expected,
      `${curiosity.id} anchor needs an expected target`,
    ).toBeDefined();
    const actual =
      kind === 'moment'
        ? profile?.keyMoments[index - 1]?.date
        : profile?.deepFacts[index - 1]?.text;
    expect(actual, curiosity.id).toContain(expected);
  }
});
