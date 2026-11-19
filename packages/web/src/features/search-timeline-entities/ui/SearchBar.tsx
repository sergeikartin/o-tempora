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

// Live typeahead over the same filtered entity pool TimelineCanvas renders
// (see useTimelineSearch). Picking a result clears the query: Search is a
// jump-to, not a persisted filter (GLOSSARY.md's Search).
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
        // div, not ul/li: listbox/option roles on list elements trip the a11y lint.
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
                // Not in tab order: the input keeps focus and points at the
                // active option via aria-activedescendant.
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
