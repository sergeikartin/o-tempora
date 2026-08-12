import { test, expect } from 'vitest';
import { UN_REGION_TO_REGION, REGION_LABELS } from './region';
import { UN_REGIONS, REGIONS } from '../types';

test('UN_REGION_TO_REGION maps every UnRegion to a Region — no sub-region is left unmapped', () => {
  for (const subRegion of UN_REGIONS) {
    expect(REGIONS).toContain(UN_REGION_TO_REGION[subRegion]);
  }
  expect(Object.keys(UN_REGION_TO_REGION)).toHaveLength(UN_REGIONS.length);
});

test('the two approximated buckets resolve as documented', () => {
  expect(UN_REGION_TO_REGION['central-asia']).toBe('middle-east');
  expect(UN_REGION_TO_REGION['australia-and-new-zealand']).toBe('east-asia');
  expect(UN_REGION_TO_REGION.melanesia).toBe('east-asia');
  expect(UN_REGION_TO_REGION.micronesia).toBe('east-asia');
  expect(UN_REGION_TO_REGION.polynesia).toBe('east-asia');
});

test('REGION_LABELS has a display label for every Region', () => {
  for (const region of REGIONS) {
    expect(REGION_LABELS[region]).toBeTruthy();
  }
});
