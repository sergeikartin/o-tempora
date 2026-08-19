import { m } from '../paraglide/messages.js';
import styles from './FilterPillList.module.css';

interface FilterPillListProps<T extends string> {
  values: readonly T[];
  selected: T[];
  onToggle: (value: T) => void;
  labelOf: (value: T) => string;
  colorOf?: (value: T) => string;
  // 'stack' (default) is a full-width column, used where a swatch needs
  // room to sit flush against the label. 'wrap' is a row that wraps,
  // for pills with no swatch (e.g. Region) that pack more densely.
  layout?: 'stack' | 'wrap';
}

// One shared multi-select pill list — every session-only sidebar filter
// (Region, Occupation Domain, Conflicts & Milestones) renders the same
// toggle-chip shape; only the value set, labels, optional swatch color, and
// layout differ per taxonomy.
export function FilterPillList<T extends string>({
  values,
  selected,
  onToggle,
  labelOf,
  colorOf,
  layout = 'stack',
}: FilterPillListProps<T>) {
  const isWrap = layout === 'wrap';
  return (
    <ul
      className={[styles.list, isWrap && styles.listWrap]
        .filter(Boolean)
        .join(' ')}
    >
      {values.map((value) => {
        const isActive = selected.includes(value);
        const label = labelOf(value);
        return (
          <li key={value}>
            <button
              type="button"
              className={[
                styles.pill,
                isWrap && styles.pillWrap,
                isActive && styles.pillActive,
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={isActive}
              aria-label={m.filterByLabel({ label })}
              onClick={() => onToggle(value)}
            >
              {colorOf && (
                <span
                  className={styles.swatch}
                  style={{ backgroundColor: colorOf(value) }}
                  aria-hidden="true"
                />
              )}
              {label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
