import { useState } from 'react';
import { trackEvent } from './track-event';

export function useMultiSelectFilter<T extends string>(filterName: string) {
  const [selected, setSelected] = useState<T[]>([]);

  function toggle(value: T) {
    setSelected((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
    trackEvent('filter_toggle', { filter: filterName, value });
  }

  return { selected, toggle };
}
