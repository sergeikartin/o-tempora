import { CONFLICT_COLOR, DOMAIN_COLORS } from '../../shared/config';
import type { ProfileAnchor } from '../../shared/lib/entity';
import { m } from '../../shared/paraglide/messages.js';
import type { YearMonth } from '../../shared/types';

// Each Curiosity is a hand-picked overlap drawn the way the timeline draws it.
// Dates mirror the published dataset to the month (curiosities.test.ts
// checks every mark against it), so the landing never claims more than the
// data does.

export type MarkKind = 'person' | 'conflict';

export interface CuriosityMark {
  slug: string;
  kind: MarkKind;
  label: () => string;
  color: string;
  start: YearMonth;
  end: YearMonth;
}

export interface CuriosityBand {
  from: YearMonth;
  to: YearMonth;
  kind: 'overlap' | 'conflict';
}

export interface Curiosity {
  id: string;
  chip: () => string;
  lede: () => string;
  caption: () => string;
  window: readonly [number, number];
  ticks: readonly number[];
  marks: readonly CuriosityMark[];
  band?: CuriosityBand;
  lead: string;
  /**
   * The lead's Key Moment or Deep Fact the link scrolls to. Set only once the
   * lead's Profile ships (curiosities.test.ts pins it to the shipped text).
   */
  anchor?: ProfileAnchor;
}

const person = (
  slug: string,
  domain: keyof typeof DOMAIN_COLORS,
  label: () => string,
  start: YearMonth,
  end: YearMonth,
): CuriosityMark => ({
  slug,
  kind: 'person',
  label,
  color: DOMAIN_COLORS[domain],
  start,
  end,
});

const conflict = (
  slug: string,
  label: () => string,
  start: YearMonth,
  end: YearMonth,
): CuriosityMark => ({
  slug,
  kind: 'conflict',
  label,
  color: CONFLICT_COLOR,
  start,
  end,
});

export const CURIOSITIES: readonly [Curiosity, ...Curiosity[]] = [
  {
    id: 'einstein-jobs',
    chip: () => m['landingCase.einstein-jobs.chip'](),
    lede: () => m['landingCase.einstein-jobs.lede'](),
    caption: () => m['landingCase.einstein-jobs.caption'](),
    window: [1954.5, 1955.75],
    ticks: [1955],
    lead: 'albert-einstein',
    marks: [
      person(
        'albert-einstein',
        'science-technology',
        () => m['landingMark.albert-einstein'](),
        { year: 1879, month: 3 },
        { year: 1955, month: 4 },
      ),
      person(
        'steve-jobs',
        'arts',
        () => m['landingMark.steve-jobs'](),
        { year: 1955, month: 2 },
        { year: 2011, month: 10 },
      ),
    ],
    band: {
      from: { year: 1955, month: 2 },
      to: { year: 1955, month: 4 },
      kind: 'overlap',
    },
  },
  {
    id: 'monet-monroe',
    chip: () => m['landingCase.monet-monroe.chip'](),
    lede: () => m['landingCase.monet-monroe.lede'](),
    caption: () => m['landingCase.monet-monroe.caption'](),
    window: [1925.5, 1927.5],
    ticks: [1926, 1927],
    lead: 'claude-monet',
    marks: [
      person(
        'claude-monet',
        'arts',
        () => m['landingMark.claude-monet'](),
        { year: 1840, month: 11 },
        { year: 1926, month: 12 },
      ),
      person(
        'elizabeth-ii',
        'institutions',
        () => m['landingMark.elizabeth-ii'](),
        { year: 1926, month: 4 },
        { year: 2022, month: 9 },
      ),
      person(
        'marilyn-monroe',
        'arts',
        () => m['landingMark.marilyn-monroe'](),
        { year: 1926, month: 6 },
        { year: 1962, month: 8 },
      ),
    ],
    band: {
      from: { year: 1926, month: 4 },
      to: { year: 1926, month: 12 },
      kind: 'overlap',
    },
  },
  {
    id: 'ali-hawking',
    chip: () => m['landingCase.ali-hawking.chip'](),
    lede: () => m['landingCase.ali-hawking.lede'](),
    caption: () => m['landingCase.ali-hawking.caption'](),
    window: [1941.5, 1943],
    ticks: [1942],
    lead: 'muhammad-ali',
    marks: [
      person(
        'muhammad-ali',
        'sports',
        () => m['landingMark.muhammad-ali'](),
        { year: 1942, month: 1 },
        { year: 2016, month: 6 },
      ),
      person(
        'stephen-hawking',
        'science-technology',
        () => m['landingMark.stephen-hawking'](),
        { year: 1942, month: 1 },
        { year: 2018, month: 3 },
      ),
      person(
        'aretha-franklin',
        'arts',
        () => m['landingMark.aretha-franklin'](),
        { year: 1942, month: 3 },
        { year: 2018, month: 8 },
      ),
      person(
        'jimi-hendrix',
        'arts',
        () => m['landingMark.jimi-hendrix'](),
        { year: 1942, month: 11 },
        { year: 1970, month: 9 },
      ),
    ],
  },
  {
    id: 'class-of-1940',
    chip: () => m['landingCase.class-of-1940.chip'](),
    lede: () => m['landingCase.class-of-1940.lede'](),
    caption: () => m['landingCase.class-of-1940.caption'](),
    window: [1939.5, 1941.5],
    ticks: [1940, 1941],
    lead: 'pele',
    marks: [
      person(
        'pele',
        'sports',
        () => m['landingMark.pele'](),
        { year: 1940, month: 10 },
        { year: 2022, month: 12 },
      ),
      person(
        'john-lennon',
        'arts',
        () => m['landingMark.john-lennon'](),
        { year: 1940, month: 10 },
        { year: 1980, month: 12 },
      ),
      person(
        'bruce-lee',
        'arts',
        () => m['landingMark.bruce-lee'](),
        { year: 1940, month: 11 },
        { year: 1973, month: 7 },
      ),
    ],
  },
  {
    id: 'year-1564',
    chip: () => m['landingCase.year-1564.chip'](),
    lede: () => m['landingCase.year-1564.lede'](),
    caption: () => m['landingCase.year-1564.caption'](),
    window: [1563.5, 1565],
    ticks: [1564],
    lead: 'galileo-galilei',
    marks: [
      person(
        'michelangelo',
        'arts',
        () => m['landingMark.michelangelo'](),
        { year: 1475, month: 3 },
        { year: 1564, month: 2 },
      ),
      person(
        'galileo-galilei',
        'science-technology',
        () => m['landingMark.galileo-galilei'](),
        { year: 1564, month: 2 },
        { year: 1642, month: 1 },
      ),
      person(
        'william-shakespeare',
        'humanities',
        () => m['landingMark.william-shakespeare'](),
        { year: 1564, month: 4 },
        { year: 1616, month: 4 },
      ),
    ],
  },
  {
    id: 'jefferson-adams',
    chip: () => m['landingCase.jefferson-adams.chip'](),
    lede: () => m['landingCase.jefferson-adams.lede'](),
    caption: () => m['landingCase.jefferson-adams.caption'](),
    window: [1825.5, 1827],
    ticks: [1826],
    lead: 'thomas-jefferson',
    marks: [
      person(
        'john-adams',
        'institutions',
        () => m['landingMark.john-adams'](),
        { year: 1735, month: 10 },
        { year: 1826, month: 7 },
      ),
      person(
        'thomas-jefferson',
        'institutions',
        () => m['landingMark.thomas-jefferson'](),
        { year: 1743, month: 4 },
        { year: 1826, month: 7 },
      ),
    ],
  },
  {
    id: 'kaiser',
    chip: () => m['landingCase.kaiser.chip'](),
    lede: () => m['landingCase.kaiser.lede'](),
    caption: () => m['landingCase.kaiser.caption'](),
    window: [1910, 1946],
    ticks: [1910, 1920, 1930, 1940],
    lead: 'world-war-i',
    marks: [
      person(
        'wilhelm-ii',
        'institutions',
        () => m['landingMark.wilhelm-ii'](),
        { year: 1859, month: 1 },
        { year: 1941, month: 6 },
      ),
      conflict(
        'world-war-i',
        () => m['landingMark.world-war-i'](),
        { year: 1914, month: 7 },
        { year: 1918, month: 11 },
      ),
      conflict(
        'world-war-ii',
        () => m['landingMark.world-war-ii'](),
        { year: 1939, month: 9 },
        { year: 1945, month: 9 },
      ),
    ],
    band: {
      from: { year: 1939, month: 9 },
      to: { year: 1941, month: 6 },
      kind: 'conflict',
    },
  },
  {
    id: 'victoria-napoleon',
    chip: () => m['landingCase.victoria-napoleon.chip'](),
    lede: () => m['landingCase.victoria-napoleon.lede'](),
    caption: () => m['landingCase.victoria-napoleon.caption'](),
    window: [1818, 1823],
    ticks: [1819, 1820, 1821, 1822],
    lead: 'napoleon',
    marks: [
      person(
        'napoleon',
        'institutions',
        () => m['landingMark.napoleon'](),
        { year: 1769, month: 8 },
        { year: 1821, month: 5 },
      ),
      person(
        'victoria',
        'institutions',
        () => m['landingMark.victoria'](),
        { year: 1819, month: 5 },
        { year: 1901, month: 1 },
      ),
    ],
    band: {
      from: { year: 1819, month: 5 },
      to: { year: 1821, month: 5 },
      kind: 'overlap',
    },
  },
  {
    id: 'joan-vlad',
    chip: () => m['landingCase.joan-vlad.chip'](),
    lede: () => m['landingCase.joan-vlad.lede'](),
    caption: () => m['landingCase.joan-vlad.caption'](),
    window: [1400, 1460],
    ticks: [1400, 1420, 1440],
    lead: 'joan-of-arc',
    marks: [
      person(
        'joan-of-arc',
        'institutions',
        () => m['landingMark.joan-of-arc'](),
        { year: 1412 },
        { year: 1431, month: 5 },
      ),
      person(
        'vlad-the-impaler',
        'public-figure',
        () => m['landingMark.vlad-the-impaler'](),
        { year: 1431, month: 11 },
        { year: 1476, month: 1 },
      ),
      conflict(
        'hundred-years-war',
        () => m['landingMark.hundred-years-war'](),
        { year: 1337, month: 6 },
        { year: 1453, month: 10 },
      ),
    ],
  },
];
