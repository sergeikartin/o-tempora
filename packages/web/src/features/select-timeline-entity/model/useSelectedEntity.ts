import { useCallback, useState } from 'react';
import {
  ENTITY_TYPES,
  type SelectedEntityRef,
} from '../../../shared/lib/entity';
import { trackEvent } from '../../../shared/lib/track-event';

// Re-exported for every existing import site (TimelineCanvas.tsx, App.tsx)
// — the types themselves moved to shared/lib/entity/ since
// features/search-timeline-entities also needs them and FSD forbids
// same-layer features importing each other.
export type {
  EntityType,
  SelectedEntityRef,
} from '../../../shared/lib/entity';
export { ENTITY_TYPES };

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

  const select = useCallback((ref: SelectedEntityRef) => {
    setSelected(ref);
    trackEvent('entity_view', { entityType: ref.entityType });
  }, []);
  const clear = useCallback(() => setSelected(null), []);

  return { selected, select, clear };
}
