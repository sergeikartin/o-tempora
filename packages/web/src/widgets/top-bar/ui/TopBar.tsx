import { useCallback, useState } from 'react';
import { DetailLevelSwitch } from '../../../features/filter-by-fame-score';
import {
  SearchBar,
  type SearchResult,
} from '../../../features/search-timeline-entities';
import {
  type ConflictsMilestonesFilterValue,
  type DetailLevel,
  type DetailLevelId,
  LANDING_HREF,
} from '../../../shared/config';
import { m } from '../../../shared/paraglide/messages.js';
import type { OccupationDomain, Region } from '../../../shared/types';
import { Logo } from '../../../shared/ui';
import { FiltersPanel } from './FiltersPanel';
import styles from './TopBar.module.css';

interface TopBarProps {
  selectedLevelId: DetailLevelId;
  onSelectDetailLevel: (level: DetailLevel) => void;
  // Detail Level ids still loading their delta file (see DetailLevelSwitch).
  loadingLevelIds: DetailLevelId[];
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchResults: SearchResult[];
  onSelectSearchResult: (result: SearchResult) => void;
  selectedDomains: OccupationDomain[];
  onToggleDomain: (domain: OccupationDomain) => void;
  selectedRegions: Region[];
  onToggleRegion: (region: Region) => void;
  selectedConflictsMilestonesValues: ConflictsMilestonesFilterValue[];
  onToggleConflictsMilestonesValue: (
    value: ConflictsMilestonesFilterValue,
  ) => void;
  onOpenHelp: () => void;
}

// The strip of always-needed controls above the timeline (GLOSSARY.md's Top
// Bar): Search, Detail Level, the Filters button (with its Filters Panel) and
// Help. The row wraps via CSS alone, so the prerendered markup needs no
// viewport width.
export function TopBar({
  selectedLevelId,
  onSelectDetailLevel,
  loadingLevelIds,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  onSelectSearchResult,
  selectedDomains,
  onToggleDomain,
  selectedRegions,
  onToggleRegion,
  selectedConflictsMilestonesValues,
  onToggleConflictsMilestonesValue,
  onOpenHelp,
}: TopBarProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const closeFilters = useCallback(() => setIsFiltersOpen(false), []);
  const activeFilterCount =
    selectedDomains.length +
    selectedRegions.length +
    selectedConflictsMilestonesValues.length;

  return (
    <header className={styles.topBar}>
      <a className={styles.logo} href={LANDING_HREF}>
        <Logo />
      </a>
      <div className={styles.search}>
        <SearchBar
          query={searchQuery}
          onQueryChange={onSearchQueryChange}
          results={searchResults}
          onSelectResult={onSelectSearchResult}
        />
      </div>
      <div className={styles.detailLevel}>
        <DetailLevelSwitch
          selectedLevelId={selectedLevelId}
          onSelectLevel={onSelectDetailLevel}
          loadingLevelIds={loadingLevelIds}
        />
      </div>
      <div className={styles.filtersAnchor}>
        <button
          type="button"
          className={styles.button}
          aria-haspopup="dialog"
          aria-expanded={isFiltersOpen}
          aria-label={
            activeFilterCount > 0
              ? m.filtersActiveAriaLabel({ count: activeFilterCount })
              : undefined
          }
          onClick={() => setIsFiltersOpen((open) => !open)}
        >
          {m.filtersLabel()}
          {activeFilterCount > 0 && (
            <span className={styles.badge} aria-hidden="true">
              {activeFilterCount}
            </span>
          )}
        </button>
        {isFiltersOpen && (
          <FiltersPanel
            onClose={closeFilters}
            selectedDomains={selectedDomains}
            onToggleDomain={onToggleDomain}
            selectedRegions={selectedRegions}
            onToggleRegion={onToggleRegion}
            selectedConflictsMilestonesValues={
              selectedConflictsMilestonesValues
            }
            onToggleConflictsMilestonesValue={onToggleConflictsMilestonesValue}
          />
        )}
      </div>
      <button
        type="button"
        className={`${styles.button} ${styles.helpButton}`}
        aria-label={m.helpLabel()}
        aria-keyshortcuts="?"
        onClick={onOpenHelp}
      >
        ?
      </button>
    </header>
  );
}
