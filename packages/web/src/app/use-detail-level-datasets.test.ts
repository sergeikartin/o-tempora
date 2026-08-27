import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import type { LocaleDatasets } from './locale-datasets';
import { useDetailLevelDatasets } from './use-detail-level-datasets';

const mocks = vi.hoisted(() => {
  let resolveLevel3: (data: LocaleDatasets) => void = () => {};
  let resolveLevel4: (data: LocaleDatasets) => void = () => {};
  const level3DatasetPromise = new Promise<LocaleDatasets>((resolve) => {
    resolveLevel3 = resolve;
  });
  const level4DatasetPromise = new Promise<LocaleDatasets>((resolve) => {
    resolveLevel4 = resolve;
  });
  return {
    level3DatasetPromise,
    level4DatasetPromise,
    resolveLevel3: (data: LocaleDatasets) => resolveLevel3(data),
    resolveLevel4: (data: LocaleDatasets) => resolveLevel4(data),
    requestLevel3Load: vi.fn(),
    requestLevel4Load: vi.fn(),
  };
});

vi.mock('./locale-datasets', () => ({
  level3DatasetPromise: mocks.level3DatasetPromise,
  level4DatasetPromise: mocks.level4DatasetPromise,
  requestLevel3Load: mocks.requestLevel3Load,
  requestLevel4Load: mocks.requestLevel4Load,
}));

const base: LocaleDatasets = {
  people: [{ id: 'p1' } as never],
  conflicts: [],
  milestones: [],
};
const level3Data: LocaleDatasets = {
  people: [{ id: 'p3' } as never],
  conflicts: [],
  milestones: [],
};
const level4Data: LocaleDatasets = {
  people: [{ id: 'p4' } as never],
  conflicts: [],
  milestones: [],
};

test('starts with only the base dataset, showing specialized and deep-cut as loading', () => {
  const { result } = renderHook(() => useDetailLevelDatasets(base));

  expect(result.current.datasets.people).toEqual([{ id: 'p1' }]);
  expect(result.current.loadingLevelIds).toEqual(['specialized', 'deep-cut']);
});

test('merges level 3 in once it resolves, dropping it from loadingLevelIds', async () => {
  const { result } = renderHook(() => useDetailLevelDatasets(base));

  await act(async () => {
    mocks.resolveLevel3(level3Data);
  });

  await waitFor(() => {
    expect(result.current.datasets.people).toEqual([
      { id: 'p1' },
      { id: 'p3' },
    ]);
  });
  expect(result.current.loadingLevelIds).toEqual(['deep-cut']);
});

test('merges level 4 in once it resolves too, leaving nothing loading', async () => {
  const { result } = renderHook(() => useDetailLevelDatasets(base));

  await act(async () => {
    mocks.resolveLevel4(level4Data);
  });

  await waitFor(() => {
    expect(result.current.datasets.people).toEqual([
      { id: 'p1' },
      { id: 'p3' },
      { id: 'p4' },
    ]);
  });
  expect(result.current.loadingLevelIds).toEqual([]);
});

test('requestLevel triggers the matching on-demand load, and is a no-op for legendary/mainstream', () => {
  const { result } = renderHook(() => useDetailLevelDatasets(base));

  act(() => result.current.requestLevel('specialized'));
  expect(mocks.requestLevel3Load).toHaveBeenCalledTimes(1);
  expect(mocks.requestLevel4Load).not.toHaveBeenCalled();

  act(() => result.current.requestLevel('deep-cut'));
  expect(mocks.requestLevel4Load).toHaveBeenCalledTimes(1);

  act(() => result.current.requestLevel('mainstream'));
  act(() => result.current.requestLevel('legendary'));
  expect(mocks.requestLevel3Load).toHaveBeenCalledTimes(1);
  expect(mocks.requestLevel4Load).toHaveBeenCalledTimes(1);
});
