import { test, expect, vi, afterEach } from 'vitest';
import { logError } from './log-error';

const captureException = vi.fn();
vi.mock('@sentry/react', () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}));

afterEach(() => {
  vi.restoreAllMocks();
  captureException.mockClear();
});

test('logError logs to the console', () => {
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const error = new Error('boom');

  logError(error, { entityType: 'person' });

  expect(consoleSpy).toHaveBeenCalledWith(error, { entityType: 'person' });
});

test('logError forwards to Sentry with the given context as extra data', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const error = new Error('boom');

  logError(error, { id: 'Q1' });

  expect(captureException).toHaveBeenCalledWith(error, { extra: { id: 'Q1' } });
});

test('logError forwards to Sentry without an extra key when no context is given', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const error = new Error('boom');

  logError(error);

  expect(captureException).toHaveBeenCalledWith(error, undefined);
});
