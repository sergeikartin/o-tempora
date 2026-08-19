import { afterEach, expect, test, vi } from 'vitest';
import { trackEvent } from './track-event';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test('trackEvent forwards to umami.track outside dev mode', () => {
  vi.stubEnv('DEV', false);
  const track = vi.fn();
  vi.stubGlobal('umami', { track });

  trackEvent('entity_view', { entityType: 'person' });

  expect(track).toHaveBeenCalledWith('entity_view', { entityType: 'person' });
});

test('trackEvent is a no-op in dev mode', () => {
  vi.stubEnv('DEV', true);
  const track = vi.fn();
  vi.stubGlobal('umami', { track });

  trackEvent('entity_view');

  expect(track).not.toHaveBeenCalled();
});

test('trackEvent is a no-op when umami is not on window', () => {
  vi.stubEnv('DEV', false);
  vi.stubGlobal('umami', undefined);

  expect(() => trackEvent('entity_view')).not.toThrow();
});
