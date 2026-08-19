import { useState } from 'react';

// Generic multi-select toggle-set state, shared by every session-only
// sidebar filter (Region, Occupation Domain, Conflicts & Milestones) — one
// flat selection set where empty means unfiltered.
export function useMultiSelectFilter<T>() {
  const [selected, setSelected] = useState<T[]>([]);

  function toggle(value: T) {
    setSelected((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  }

  return { selected, toggle };
}
