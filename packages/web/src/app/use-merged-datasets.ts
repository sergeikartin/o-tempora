import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type LocaleDatasets,
  requestTier1Load,
  tier1DatasetsPromise,
} from './locale-datasets';

interface MergedDatasetsResult {
  datasets: LocaleDatasets;
  isTier1Loading: boolean;
  loadTier1: () => void;
}

// Merges Payload Tier 1 (CONTEXT.md, docs/adr/0004-payload-tier-split-
// defers-low-fame-data.md) into Tier 0 once it resolves — either from the
// automatic idle-prefetch or from loadTier1's on-demand trigger (called when
// the user picks Deep Cut before Tier 1 is ready, or on a save-data/slow
// connection where the idle-prefetch never starts on its own). Plain
// concatenation is enough: which tier an entry shipped in never affects
// whether it renders — only the client-side Fame Score filter does (ADR
// 0003) — so the merged arrays are a drop-in superset of tier0 alone.
export function useMergedDatasets(tier0: LocaleDatasets): MergedDatasetsResult {
  const [tier1, setTier1] = useState<LocaleDatasets | null>(null);
  const [isTier1Loading, setIsTier1Loading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    tier1DatasetsPromise.then((data) => {
      if (!cancelled) {
        setTier1(data);
        setIsTier1Loading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadTier1 = useCallback(() => {
    requestTier1Load();
  }, []);

  const datasets = useMemo<LocaleDatasets>(() => {
    if (!tier1) return tier0;
    return {
      people: tier0.people.concat(tier1.people),
      conflicts: tier0.conflicts.concat(tier1.conflicts),
      milestones: tier0.milestones.concat(tier1.milestones),
    };
  }, [tier0, tier1]);

  return { datasets, isTier1Loading, loadTier1 };
}
