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
  // Detail Level ids whose delta file hasn't resolved yet — DetailLevelSwitch
  // shows a spinner on the active option only while its id is in this list
  // (never for legendary/mainstream, both already loaded eagerly).
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

// Merges Detail Level 3/4's delta files (CONTEXT.md, docs/adr/0006-detail-
// level-merges-data-depth-and-payload-tier.md) into the level 1+2 base once
// each resolves — either from level 3's automatic idle-prefetch or from
// requestLevel's on-demand trigger (called when the user picks Specialized/
// Deep Cut before that level is ready, or on a save-data/slow connection
// where the idle-prefetch never starts on its own). Plain concatenation is
// enough: which level an entry ships in never affects whether it renders —
// only the client-side Fame Score filter does (ADR 0003) — so the merged
// arrays are a drop-in superset of the base alone. Level 3/4 never re-fetch
// or evict once loaded, since the promises they resolve from are module-
// scope singletons.
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
