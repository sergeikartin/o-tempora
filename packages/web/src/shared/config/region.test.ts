import { test, expect } from 'vitest';
import { REGION_LABELS } from './region';
import { REGIONS } from '../types';

test('REGION_LABELS has a display label for every Region', () => {
  for (const region of REGIONS) {
    expect(REGION_LABELS[region]).toBeTruthy();
  }
});
