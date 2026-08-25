import { useId, useState } from 'react';
import type { EntityType } from '../../../shared/lib/entity';
import { m } from '../../../shared/paraglide/messages.js';
import { splitOnMatch } from '../lib/highlight-match';
import type { SearchResult } from '../model/useTimelineSearch';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  results: SearchResult[];
  onSelectResult: (result: SearchResult) => void;
}

const ENTITY_TYPE_LABEL: Record<EntityType, () => string> = {
  person: m.searchEntityTypePerson,
  conflict: m.searchEntityTypeConflict,
  milestone: m.searchEntityTypeMilestone,
};

// New input pattern for this app (grill-with-docs session, resolving
// .scratch/pre-launch-readiness/issues/15-search-bar.md) — a live typeahead
// over the same filtered entity pool TimelineCanvas renders (see
// useTimelineSearch). Picking a result clears the query (CONTEXT.md's
// Search entry: "Search... nothing more" — it's a jump-to, not a persisted
// filter) rather than leaving stale text implying the view is still
// narrowed by it.
export function SearchBar({
  query,
  onQueryChange,
  results,
  onSelectResult,
}: SearchBarProps) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = useId();
  const isOpen = query.trim().length > 0;

  function selectResult(result: SearchResult) {
    onSelectResult(result);
    onQueryChange('');
    setActiveIndex(-1);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      if (!isOpen) return;
      event.preventDefault();
      event.stopPropagation();
      onQueryChange('');
      setActiveIndex(-1);
      return;
    }
    if (!isOpen || results.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(
        (current) => (current - 1 + results.length) % results.length,
      );
    } else if (event.key === 'Enter') {
      const result = results[activeIndex];
      if (!result) return;
      event.preventDefault();
      selectResult(result);
    }
  }

  return (
    <div className={styles.container}>
      <input
        type="text"
        className={styles.input}
        value={query}
        onChange={(event) => {
          onQueryChange(event.target.value);
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        placeholder={m.searchPlaceholder()}
        aria-label={m.searchInputAriaLabel()}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-activedescendant={
          activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
        }
        autoComplete="off"
      />
      {isOpen && (
        // div, not ul/li: role="listbox"/"option" on semantic list elements
        // trips this repo's a11y lint (non-interactive element, interactive
        // role) — a div carries no implicit role of its own to conflict with.
        <div
          id={listId}
          className={styles.dropdown}
          role="listbox"
          aria-label={m.searchResultsAriaLabel()}
        >
          {results.length === 0 && (
            <div className={styles.empty}>{m.searchNoResults()}</div>
          )}
          {results.map((result, index) => {
            const nameSplit = splitOnMatch(result.name, query);
            const isActive = index === activeIndex;
            return (
              <div
                key={`${result.entityType}-${result.id}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={isActive}
                // Not in tab order — the input keeps real keyboard focus the
                // whole time (aria-activedescendant above points at whichever
                // option is active), same combobox-listbox pattern as e.g. a
                // native <select>'s options never taking focus themselves.
                tabIndex={-1}
              >
                <button
                  type="button"
                  className={[styles.result, isActive && styles.resultActive]
                    .filter(Boolean)
                    .join(' ')}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectResult(result)}
                >
                  <span className={styles.badge}>
                    {ENTITY_TYPE_LABEL[result.entityType]()}
                  </span>
                  <span className={styles.name}>
                    {nameSplit ? (
                      <>
                        {nameSplit.before}
                        <strong>{nameSplit.match}</strong>
                        {nameSplit.after}
                      </>
                    ) : (
                      result.name
                    )}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
