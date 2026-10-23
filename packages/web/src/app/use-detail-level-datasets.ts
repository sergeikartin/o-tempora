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
  // Detail Level ids whose delta file hasn't resolved yet; never includes
  // legendary/mainstream, which load eagerly.
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

// Concatenates Detail Level 3/4's delta files (CONTEXT.md, docs/adr/0006-detail-
// level-merges-data-depth-and-payload-tier.md) onto the level 1+2 base once
// each resolves. Which level an entry ships in never affects whether it
// renders; only the Fame Score filter does (web/docs/adr/0003). Loaded
// levels are never re-fetched or evicted: they resolve from module-scope
// promises.
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
