import { expect, test } from 'vitest';
import type { Person } from '../../types';
import {
  computeOverlap,
  type EntitySpan,
  entitySpan,
  unionYears,
} from './overlap';

const period = (
  start: EntitySpan['start'],
  end: EntitySpan['end'],
): EntitySpan => ({
  start,
  end,
  isPoint: false,
  isOngoing: false,
});
const point = (at: EntitySpan['start']): EntitySpan => ({
  start: at,
  end: at,
  isPoint: true,
  isOngoing: false,
});

const einstein = period({ year: 1879, month: 3 }, { year: 1955, month: 4 });
const jobs = period({ year: 1955, month: 2 }, { year: 2011, month: 10 });

test('two periods share the latest start to the earliest end, to the month', () => {
  expect(computeOverlap([einstein, jobs])).toEqual({
    start: { year: 1955, month: 2 },
    end: { year: 1955, month: 4 },
  });
});

test('the result does not depend on selection order', () => {
  expect(computeOverlap([jobs, einstein])).toEqual(
    computeOverlap([einstein, jobs]),
  );
});

test('periods that never coincide share nothing', () => {
  expect(
    computeOverlap([period({ year: 1700 }, { year: 1750 }), jobs]),
  ).toBeNull();
});

test('a single member has no overlap', () => {
  expect(computeOverlap([einstein])).toBeNull();
  expect(computeOverlap([])).toBeNull();
});

test('a point inside every period is the shared span', () => {
  const at = { year: 1955, month: 3 };
  expect(computeOverlap([einstein, jobs, point(at)])).toEqual({
    start: at,
    end: at,
  });
});

test('a point outside any period leaves no shared span', () => {
  expect(computeOverlap([einstein, jobs, point({ year: 1960 })])).toBeNull();
});

test('three periods share only what all three cover', () => {
  const third = period({ year: 1955, month: 3 }, { year: 1990 });
  expect(computeOverlap([einstein, jobs, third])).toEqual({
    start: { year: 1955, month: 3 },
    end: { year: 1955, month: 4 },
  });
});

test('entitySpan runs a living person to the current year', () => {
  const alive = {
    lifespan: { start: { year: 1990, month: 5 } },
  } as unknown as Person;
  expect(entitySpan(alive, 2026)).toEqual({
    start: { year: 1990, month: 5 },
    end: { year: 2026 },
    isPoint: false,
    isOngoing: true,
  });
});

test('entitySpan reads a Period, and a point as equal ends', () => {
  const war = { period: { start: { year: 1914 }, end: { year: 1918 } } };
  expect(entitySpan(war as never)).toMatchObject({
    start: { year: 1914 },
    end: { year: 1918 },
    isPoint: false,
  });
  expect(entitySpan({ at: { year: 1944, month: 6 } } as never)).toMatchObject({
    start: { year: 1944, month: 6 },
    end: { year: 1944, month: 6 },
    isPoint: true,
  });
});

test('unionYears covers every span', () => {
  expect(unionYears([einstein, jobs])).toEqual({
    startYear: 1879 + 2 / 12,
    endYear: 2011 + 9 / 12,
  });
  expect(unionYears([])).toBeNull();
});
