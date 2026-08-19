import { expect, test } from 'vitest';
import { REGIONS } from '../types';
import { REGION_LABELS } from './region';

test('REGION_LABELS has a display label for every Region', () => {
  for (const region of REGIONS) {
    expect(REGION_LABELS[region]).toBeTruthy();
  }
});
