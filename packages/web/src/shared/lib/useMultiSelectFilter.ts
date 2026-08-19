import { useState } from 'react';
import { trackEvent } from './track-event';

// Generic multi-select toggle-set state, shared by every session-only
// sidebar filter (Region, Occupation Domain, Conflicts & Milestones) — one
// flat selection set where empty means unfiltered. `filterName` tags the
// tracked event so all three filters funnel through one event name instead
// of three, keeping Umami's per-event-name quota usage down.
export function useMultiSelectFilter<T extends string>(filterName: string) {
  const [selected, setSelected] = useState<T[]>([]);

  function toggle(value: T) {
    setSelected((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
    trackEvent('filter_toggle', { filter: filterName, value });
  }

  return { selected, toggle };
}
