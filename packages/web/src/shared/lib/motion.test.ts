import { expect, test } from 'vitest';
import { motionDurationMs } from './motion';

test('motionDurationMs reads a ms-suffixed custom property from :root', () => {
  document.documentElement.style.setProperty(
    '--motion-duration-test-ms',
    '250ms',
  );
  expect(motionDurationMs('--motion-duration-test-ms')).toBe(250);
});

test('motionDurationMs reads an s-suffixed custom property as milliseconds', () => {
  document.documentElement.style.setProperty(
    '--motion-duration-test-s',
    '0.3s',
  );
  expect(motionDurationMs('--motion-duration-test-s')).toBe(300);
});

test('motionDurationMs caches the first read, ignoring a later value change', () => {
  document.documentElement.style.setProperty(
    '--motion-duration-test-cache',
    '100ms',
  );
  expect(motionDurationMs('--motion-duration-test-cache')).toBe(100);

  document.documentElement.style.setProperty(
    '--motion-duration-test-cache',
    '900ms',
  );
  expect(motionDurationMs('--motion-duration-test-cache')).toBe(100);
});

test('motionDurationMs falls back to 0 for an undefined custom property', () => {
  expect(motionDurationMs('--motion-duration-test-missing')).toBe(0);
});
