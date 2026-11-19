import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DetailLevelId } from '../shared/config';
import {
  type LocaleDatasets,
  level3DatasetPromise,
  level4DatasetPromise,
  requestLevel3Load,
  requestLevel4Load,
} from './locale-datasets';

interface DetailLevelDatasetsResult {
  datasets: LocaleDatasets;
  loadingLevelIds: DetailLevelId[];
  requestLevel: (levelId: DetailLevelId) => void;
}

function mergeDatasets(
  base: LocaleDatasets,
  extra: LocaleDatasets | null,
): LocaleDatasets {
  if (!extra) return base;
  return {
    people: base.people.concat(extra.people),
    conflicts: base.conflicts.concat(extra.conflicts),
    milestones: base.milestones.concat(extra.milestones),
  };
}

// Chunk membership controls delivery. The Fame Score filter alone controls visibility.
export function useDetailLevelDatasets(
  base: LocaleDatasets,
): DetailLevelDatasetsResult {
  const [level3, setLevel3] = useState<LocaleDatasets | null>(null);
  const [level4, setLevel4] = useState<LocaleDatasets | null>(null);

  useEffect(() => {
    let cancelled = false;
    level3DatasetPromise.then((data) => {
      if (!cancelled) setLevel3(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    level4DatasetPromise.then((data) => {
      if (!cancelled) setLevel4(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const requestLevel = useCallback((levelId: DetailLevelId) => {
    if (levelId === 'specialized') requestLevel3Load();
    if (levelId === 'deep-cut') requestLevel4Load();
  }, []);

  const datasets = useMemo(
    () => mergeDatasets(mergeDatasets(base, level3), level4),
    [base, level3, level4],
  );

  const loadingLevelIds: DetailLevelId[] = [
    ...(level3 === null ? (['specialized'] as const) : []),
    ...(level4 === null ? (['deep-cut'] as const) : []),
  ];

  return { datasets, loadingLevelIds, requestLevel };
}
