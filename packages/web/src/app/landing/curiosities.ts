import {
  CONFLICT_COLOR,
  DOMAIN_COLORS,
  MILESTONE_CATEGORY_GROUP_COLORS,
} from '../../shared/config';
import type { ProfileAnchor } from '../../shared/lib/entity';
import { m } from '../../shared/paraglide/messages.js';
import {
  MILESTONE_CATEGORY_TO_GROUP,
  type MilestoneCategory,
  type YearMonth,
} from '../../shared/types';

// Each Curiosity is a documented connection drawn the way the timeline draws it.
// Dates mirror the published dataset to the month (curiosities.test.ts
// checks every mark against it), so the landing never claims more than the
// data does.

export type MarkKind = 'person' | 'conflict' | 'milestone';

export interface CuriosityMark {
  slug: string;
  kind: MarkKind;
  label: () => string;
  color: string;
  start: YearMonth;
  end?: YearMonth;
}

export interface Curiosity {
  id: string;
  chip: () => string;
  lede: () => string;
  caption: () => string;
  window: readonly [number, number];
  ticks: readonly number[];
  marks: readonly CuriosityMark[];
  lead: string;
  anchor: ProfileAnchor;
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

const milestone = (
  slug: string,
  category: MilestoneCategory,
  label: () => string,
  start: YearMonth,
): CuriosityMark => ({
  slug,
  kind: 'milestone',
  label,
  start,
  color: MILESTONE_CATEGORY_GROUP_COLORS[MILESTONE_CATEGORY_TO_GROUP[category]],
});

export const CURIOSITIES: readonly [Curiosity, ...Curiosity[]] = [
  {
    id: 'shelley-summer',
    chip: m['landingCase.shelley-summer.chip'],
    lede: m['landingCase.shelley-summer.lede'],
    caption: m['landingCase.shelley-summer.caption'],
    window: [1790, 1860],
    ticks: [1800, 1820, 1840],
    lead: 'mary-shelley',
    anchor: { kind: 'moment', index: 2 },
    marks: [
      person(
        'mary-shelley',
        'humanities',
        m['landingMark.mary-shelley'],
        { year: 1797, month: 8 },
        { year: 1851, month: 2 },
      ),
      milestone(
        'year-without-a-summer',
        'environment-geology',
        m['landingMark.year-without-a-summer'],
        { year: 1816 },
      ),
    ],
  },
  {
    id: 'vermeer-leeuwenhoek',
    chip: m['landingCase.vermeer-leeuwenhoek.chip'],
    lede: m['landingCase.vermeer-leeuwenhoek.lede'],
    caption: m['landingCase.vermeer-leeuwenhoek.caption'],
    window: [1620, 1735],
    ticks: [1640, 1680, 1720],
    lead: 'johannes-vermeer',
    anchor: { kind: 'fact', index: 1 },
    marks: [
      person(
        'johannes-vermeer',
        'arts',
        m['landingMark.johannes-vermeer'],
        { year: 1632, month: 10 },
        { year: 1675, month: 12 },
      ),
      person(
        'antonie-van-leeuwenhoek',
        'science-technology',
        m['landingMark.antonie-van-leeuwenhoek'],
        { year: 1632, month: 10 },
        { year: 1723, month: 8 },
      ),
    ],
  },
  {
    id: 'einstein-szilard',
    chip: m['landingCase.einstein-szilard.chip'],
    lede: m['landingCase.einstein-szilard.lede'],
    caption: m['landingCase.einstein-szilard.caption'],
    window: [1890, 1968],
    ticks: [1900, 1930, 1960],
    lead: 'albert-einstein',
    anchor: { kind: 'fact', index: 1 },
    marks: [
      person(
        'albert-einstein',
        'science-technology',
        m['landingMark.albert-einstein'],
        { year: 1879, month: 3 },
        { year: 1955, month: 4 },
      ),
      person(
        'leo-szilard',
        'science-technology',
        m['landingMark.leo-szilard'],
        { year: 1898, month: 2 },
        { year: 1964, month: 5 },
      ),
      milestone(
        'first-household-refrigerator',
        'energy-industry',
        m['landingMark.first-household-refrigerator'],
        { year: 1913 },
      ),
    ],
  },
  {
    id: 'leonardo-michelangelo',
    chip: m['landingCase.leonardo-michelangelo.chip'],
    lede: m['landingCase.leonardo-michelangelo.lede'],
    caption: m['landingCase.leonardo-michelangelo.caption'],
    window: [1440, 1575],
    ticks: [1460, 1500, 1540],
    lead: 'michelangelo',
    anchor: { kind: 'fact', index: 3 },
    marks: [
      person(
        'leonardo-da-vinci',
        'science-technology',
        m['landingMark.leonardo-da-vinci'],
        { year: 1452, month: 4 },
        { year: 1519, month: 5 },
      ),
      person(
        'michelangelo',
        'arts',
        m['landingMark.michelangelo'],
        { year: 1475, month: 3 },
        { year: 1564, month: 2 },
      ),
    ],
  },
  {
    id: 'tolstoy-gandhi',
    chip: m['landingCase.tolstoy-gandhi.chip'],
    lede: m['landingCase.tolstoy-gandhi.lede'],
    caption: m['landingCase.tolstoy-gandhi.caption'],
    window: [1820, 1960],
    ticks: [1840, 1880, 1920],
    lead: 'leo-tolstoy',
    anchor: { kind: 'moment', index: 4 },
    marks: [
      person(
        'leo-tolstoy',
        'humanities',
        m['landingMark.leo-tolstoy'],
        { year: 1828, month: 9 },
        { year: 1910, month: 11 },
      ),
      person(
        'mahatma-gandhi',
        'public-figure',
        m['landingMark.mahatma-gandhi'],
        { year: 1869, month: 10 },
        { year: 1948, month: 1 },
      ),
    ],
  },
  {
    id: 'charlemagne-elephant',
    chip: m['landingCase.charlemagne-elephant.chip'],
    lede: m['landingCase.charlemagne-elephant.lede'],
    caption: m['landingCase.charlemagne-elephant.caption'],
    window: [740, 825],
    ticks: [750, 780, 810],
    lead: 'charlemagne',
    anchor: { kind: 'fact', index: 1 },
    marks: [
      person(
        'charlemagne',
        'institutions',
        m['landingMark.charlemagne'],
        { year: 748, month: 4 },
        { year: 814, month: 1 },
      ),
      person(
        'harun-al-rashid',
        'institutions',
        m['landingMark.harun-al-rashid'],
        { year: 766, month: 3 },
        { year: 809, month: 3 },
      ),
    ],
  },
  {
    id: 'curie-x-rays',
    chip: m['landingCase.curie-x-rays.chip'],
    lede: m['landingCase.curie-x-rays.lede'],
    caption: m['landingCase.curie-x-rays.caption'],
    window: [1860, 1942],
    ticks: [1870, 1900, 1930],
    lead: 'marie-curie',
    anchor: { kind: 'fact', index: 1 },
    marks: [
      person(
        'marie-curie',
        'science-technology',
        m['landingMark.marie-curie'],
        { year: 1867, month: 11 },
        { year: 1934, month: 7 },
      ),
      milestone(
        'discovery-of-x-rays',
        'science-theory',
        m['landingMark.discovery-of-x-rays'],
        { year: 1895, month: 11 },
      ),
      conflict(
        'world-war-i',
        m['landingMark.world-war-i'],
        { year: 1914, month: 7 },
        { year: 1918, month: 11 },
      ),
    ],
  },
];
