import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useProfile } from './use-profile';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const profile = {
  overview: 'o',
  keyMoments: [],
  deepFacts: [],
  connections: [],
};

test('is undefined for an entity without a Profile and never fetches', () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const { result } = renderHook(() => useProfile(null));
  expect(result.current).toBeUndefined();
  expect(fetchMock).not.toHaveBeenCalled();
});

test('loads, then holds the fetched Profile', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(profile),
  });
  vi.stubGlobal('fetch', fetchMock);
  const { result } = renderHook(() => useProfile('ok-slug'));
  expect(result.current).toEqual({ status: 'loading' });
  await waitFor(() =>
    expect(result.current).toEqual({ status: 'ready', profile }),
  );
  expect(fetchMock).toHaveBeenCalledWith('/profiles/en/ok-slug.json');
});

test('fails on a non-OK response, and retries on the next open', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({ ok: false, status: 404 })
    .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(profile) });
  vi.stubGlobal('fetch', fetchMock);
  const first = renderHook(() => useProfile('retry-slug'));
  await waitFor(() => expect(first.result.current?.status).toBe('failed'));
  first.unmount();
  await act(async () => {});

  const second = renderHook(() => useProfile('retry-slug'));
  await waitFor(() => expect(second.result.current?.status).toBe('ready'));
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
