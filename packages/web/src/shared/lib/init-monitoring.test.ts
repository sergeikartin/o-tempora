import { afterEach, expect, test, vi } from 'vitest';
import { initMonitoring } from './init-monitoring';

const { initMock } = vi.hoisted(() => ({ initMock: vi.fn() }));
vi.mock('@sentry/react', () => ({ init: initMock }));

afterEach(() => {
  initMock.mockClear();
  vi.unstubAllEnvs();
});

test('does not load Sentry when no DSN is configured', () => {
  vi.stubEnv('VITE_GLITCHTIP_DSN', '');

  initMonitoring();

  expect(initMock).not.toHaveBeenCalled();
});

test('initializes Sentry when a DSN is configured', () => {
  vi.stubEnv('VITE_GLITCHTIP_DSN', 'https://example.invalid/1');

  initMonitoring();

  expect(initMock).toHaveBeenCalledWith(
    expect.objectContaining({
      dsn: 'https://example.invalid/1',
      sampleRate: 1,
    }),
  );
});
