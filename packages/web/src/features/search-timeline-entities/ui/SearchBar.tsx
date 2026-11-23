import { useId, useState } from 'react';
import { DETAIL_LEVELS, type DetailLevelId } from '../../../shared/config';
import type { EntityType } from '../../../shared/lib/entity';
import { m } from '../../../shared/paraglide/messages.js';
import { splitOnMatch } from '../lib/highlight-match';
import type { SearchResult } from '../model/useTimelineSearch';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  results: SearchResult[];
  selectedLevelId: DetailLevelId;
  status?: 'loading' | 'ready' | 'unavailable' | 'opening' | 'open-failed';
  onSelectResult: (result: SearchResult) => void;
}

const ENTITY_TYPE_LABEL: Record<EntityType, () => string> = {
  person: m.searchEntityTypePerson,
  conflict: m.searchEntityTypeConflict,
  milestone: m.searchEntityTypeMilestone,
};

const STATUS_MESSAGE = {
  loading: m.searchLoading,
  unavailable: m.searchUnavailable,
  opening: m.searchOpening,
  'open-failed': m.searchOpenFailed,
};

export function SearchBar({
  query,
  onQueryChange,
  results,
  selectedLevelId,
  status = 'ready',
  onSelectResult,
}: SearchBarProps) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = useId();
  const isOpen = query.trim().length > 0;
  const selectedLevelIndex = DETAIL_LEVELS.findIndex(
    ({ id }) => id === selectedLevelId,
  );
  const statusMessage =
    status === 'ready'
      ? isOpen && results.length === 0
        ? m.searchNoResults()
        : null
      : STATUS_MESSAGE[status]();

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
        aria-controls={isOpen ? listId : undefined}
        aria-activedescendant={
          activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
        }
        autoComplete="off"
      />
      {(isOpen || statusMessage) && (
        <div className={styles.dropdown}>
          {statusMessage && (
            <div role="status" className={styles.status}>
              {statusMessage}
            </div>
          )}
          {isOpen && (
            <div
              id={listId}
              role="listbox"
              aria-label={m.searchResultsAriaLabel()}
              aria-busy={status === 'loading'}
            >
              {results.map((result, index) => {
                const nameSplit = splitOnMatch(result.name, query);
                const isActive = index === activeIndex;
                const levelIndex = DETAIL_LEVELS.findIndex(
                  ({ id }) => id === result.detailLevel,
                );
                const deeper =
                  levelIndex > selectedLevelIndex
                    ? DETAIL_LEVELS[levelIndex]
                    : undefined;
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
                      className={[
                        styles.result,
                        isActive && styles.resultActive,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectResult(result)}
                    >
                      <span className={styles.badge}>
                        {ENTITY_TYPE_LABEL[result.entityType]()}
                      </span>
                      <span className={styles.resultText}>
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
                        {deeper && (
                          <span className={styles.level}>
                            {m.entityAppearsAtLevel({ level: deeper.label })}
                          </span>
                        )}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
