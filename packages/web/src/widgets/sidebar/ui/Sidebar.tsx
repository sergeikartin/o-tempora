import { useEffect, useRef } from 'react';
import { DetailLevelSwitch } from '../../../features/filter-by-fame-score';
import { OccupationDomainFilters } from '../../../features/filter-by-occupation-domain';
import { RegionFilters } from '../../../features/filter-by-region';
import { ConflictsMilestonesFilters } from '../../../features/filter-conflicts-milestones';
import {
  SearchBar,
  type SearchResult,
} from '../../../features/search-timeline-entities';
import type {
  ConflictsMilestonesFilterValue,
  DetailLevel,
  DetailLevelId,
} from '../../../shared/config';
import { useIsMobileViewport } from '../../../shared/lib/viewport';
import { m } from '../../../shared/paraglide/messages.js';
import type { OccupationDomain, Region } from '../../../shared/types';
import { Logo } from '../../../shared/ui';
import styles from './Sidebar.module.css';

interface SidebarProps {
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
  // Drawer open/close state; mobile-only (Sidebar.module.css's mobile
  // breakpoint block). The toggle button lives in TimelineCanvas; App.tsx
  // owns the state both widgets share.
  isOpen: boolean;
  onClose: () => void;
  // Desktop-only collapse, toggled by the « handle in the sidebar header.
  // Collapsed, the sidebar reserves no layout width and only the handle
  // remains. No effect on mobile, where isOpen/onClose covers hiding it.
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenAbout: () => void;
  // Sibling-locale home, already carrying the open Entity Link (if any).
  switchLanguageHref: string;
}

// Always visible alongside TimelineCanvas: search, the Detail Level switch,
// People (Occupation Domain pills), Conflicts & Milestones (one multi-select
// pill list: Conflicts plus the 2 Milestone Category Groups, see
// docs/adr/0002-milestone-category-group-conflicts-blanket-toggle.md), and a
// Region filter narrowing all three lanes.
export function Sidebar({
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
  isOpen,
  onClose,
  isCollapsed,
  onToggleCollapse,
  onOpenAbout,
  switchLanguageHref,
}: SidebarProps) {
  const isMobileViewport = useIsMobileViewport();
  // isCollapsed only applies on desktop: a value left over from a desktop
  // session must not hide the mobile drawer's content (TimelineCanvas gates
  // the handle the same way).
  const collapsed = isCollapsed && !isMobileViewport;
  // The closed mobile drawer is off-canvas via translateX, not display:none,
  // so without inert its controls stay tabbable and screen-reader-visible.
  // Mobile only: the desktop column (isOpen is always false there) must stay
  // interactive. `collapsed` needs no inert: its content is unmounted, and
  // inerting the aside would disable the collapse handle too.
  const isInert = isMobileViewport && !isOpen;

  const asideRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // The mobile drawer acts as a modal behind a full-screen backdrop: move
  // focus in on open, trap Tab/Shift+Tab inside the backdrop+aside, and
  // restore focus to the toggle button on close.
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!isMobileViewport) return;
    if (isOpen) {
      previouslyFocusedRef.current =
        document.activeElement as HTMLElement | null;
      closeButtonRef.current?.focus();
    } else {
      previouslyFocusedRef.current?.focus();
      previouslyFocusedRef.current = null;
    }
  }, [isOpen, isMobileViewport]);

  useEffect(() => {
    if (!isMobileViewport || !isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !asideRef.current) return;
      const focusable = asideRef.current.querySelectorAll<HTMLElement>(
        'button, a[href], input, [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isMobileViewport, onClose]);

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className={styles.backdrop}
          aria-label={m.closeAriaLabel()}
          onClick={onClose}
        />
      )}
      <aside
        ref={asideRef}
        className={[
          styles.sidebar,
          isOpen && styles.open,
          collapsed && styles.collapsed,
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label={m.filtersAriaLabel()}
        inert={isInert}
      >
        {!isMobileViewport && (
          <div className={styles.collapseHeader}>
            {!collapsed && <Logo />}
            <button
              type="button"
              className={styles.collapseButton}
              aria-label={
                collapsed
                  ? m.expandFiltersAriaLabel()
                  : m.collapseFiltersAriaLabel()
              }
              aria-expanded={!collapsed}
              onClick={onToggleCollapse}
            >
              {collapsed ? '»' : '«'}
            </button>
          </div>
        )}
        {!collapsed && (
          <div className={styles.content}>
            <div className={styles.scrollArea}>
              {isMobileViewport && (
                <div className={styles.header}>
                  <Logo />
                  <button
                    ref={closeButtonRef}
                    type="button"
                    className={styles.closeButton}
                    aria-label={m.closeFiltersAriaLabel()}
                    onClick={onClose}
                  >
                    ×
                  </button>
                </div>
              )}
              <div className={styles.section}>
                <SearchBar
                  query={searchQuery}
                  onQueryChange={onSearchQueryChange}
                  results={searchResults}
                  onSelectResult={onSelectSearchResult}
                />
              </div>
              <section className={styles.section}>
                <h2 className={styles.heading}>{m.detailLevelHeading()}</h2>
                <DetailLevelSwitch
                  selectedLevelId={selectedLevelId}
                  onSelectLevel={onSelectDetailLevel}
                  loadingLevelIds={loadingLevelIds}
                />
              </section>
              <section className={styles.section}>
                <h2 className={styles.heading}>{m.occupationHeading()}</h2>
                <OccupationDomainFilters
                  selectedDomains={selectedDomains}
                  onToggleDomain={onToggleDomain}
                />
              </section>
              <section className={styles.section}>
                <h2 className={styles.heading}>
                  {m.conflictsMilestonesHeading()}
                </h2>
                <ConflictsMilestonesFilters
                  selectedValues={selectedConflictsMilestonesValues}
                  onToggleValue={onToggleConflictsMilestonesValue}
                />
              </section>
              <section className={styles.section}>
                <h2 className={styles.heading}>{m.regionHeading()}</h2>
                <RegionFilters
                  selectedRegions={selectedRegions}
                  onToggleRegion={onToggleRegion}
                />
              </section>
            </div>
            <div className={styles.footer}>
              <button
                type="button"
                className={styles.footerLink}
                onClick={onOpenAbout}
              >
                {m.aboutLabel()}
              </button>
              <a className={styles.footerLink} href={switchLanguageHref}>
                {m.switchLanguageLabel()}
              </a>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
