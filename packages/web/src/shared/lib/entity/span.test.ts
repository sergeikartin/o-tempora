import { expect, test } from 'vitest';
import type { Person } from '../../types';
import { entitySpan } from './span';

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
