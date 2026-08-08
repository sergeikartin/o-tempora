import { useCallback, useState } from 'react';

export const ENTITY_TYPES = ['person', 'war', 'discovery'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

// Identifies a clicked mark without its full data — TimelineCanvas's
// delegated click listener resolves only this much from the DOM
// (data-entity-id/data-entity-type), leaving the actual entity lookup to
// whoever owns the full in-memory datasets (app/App.tsx).
export interface SelectedEntityRef {
  id: string;
  entityType: EntityType;
}

// Session-only selection state (no persistence) for the click-to-open
// detail drawer (.scratch/dynamic-tooltips/spec.md §2) — owned here since
// it's shared by widgets/timeline-canvas (the click source) and
// widgets/detail-panel (the drawer), same "feature owns cross-widget state"
// pattern features/filter-by-fame-score already uses. select/clear are
// stable function identities (useCallback) since both are threaded as an
// effect dependency downstream — TimelineCanvas's delegated click listener
// and DetailPanel's document-level dismiss listeners — and a fresh
// identity on every unrelated App render would tear down and re-add those
// listeners far more often than the selection itself actually changes.
export function useSelectedEntity() {
  const [selected, setSelected] = useState<SelectedEntityRef | null>(null);

  const select = useCallback((ref: SelectedEntityRef) => setSelected(ref), []);
  const clear = useCallback(() => setSelected(null), []);

  return { selected, select, clear };
}
