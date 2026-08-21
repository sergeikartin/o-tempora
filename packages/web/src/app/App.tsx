import { Suspense, use, useCallback, useMemo, useState } from 'react';
import {
  type FilteredCounts,
  useFameScoreFilters,
} from '../features/filter-by-fame-score';
import { useOccupationDomainFilter } from '../features/filter-by-occupation-domain';
import { useRegionFilter } from '../features/filter-by-region';
import { useConflictsMilestonesFilter } from '../features/filter-conflicts-milestones';
import {
  type SelectedEntityRef,
  useSelectedEntity,
} from '../features/select-timeline-entity';
import type { DataDepthLevel } from '../shared/config';
import { trackEvent } from '../shared/lib/track-event';
import { m } from '../shared/paraglide/messages.js';
import { ErrorBoundary } from '../shared/ui';
import { AboutPanel } from '../widgets/about-panel';
import { DetailPanel, type DetailPanelEntity } from '../widgets/detail-panel';
import { Sidebar } from '../widgets/sidebar';
import { TimelineCanvas } from '../widgets/timeline-canvas';
import styles from './App.module.css';
import { localeDatasetsPromise } from './locale-datasets';
import { useMergedDatasets } from './use-merged-datasets';

export function App() {
  return (
    <>
      <h1 className={styles.srOnly}>{m.siteTitle()}</h1>
      <Suspense fallback={<div className={styles.loading} />}>
        <AppContent />
      </Suspense>
    </>
  );
}

function AppContent() {
  const tier0 = use(localeDatasetsPromise);
  const {
    datasets: {
      people: peopleData,
      conflicts: conflictsData,
      milestones: milestonesData,
    },
    isTier1Loading,
    loadTier1,
  } = useMergedDatasets(tier0);
  const {
    values: fameScoreValues,
    setValue: setFameScoreValue,
    setLevel: setFameScoreLevel,
  } = useFameScoreFilters();
  // Deep Cut's data ships in Tier 1 (CONTEXT.md's Payload Tier), a deferred
  // second chunk — picking it triggers the on-demand fallback in case the
  // idle-prefetch hasn't started yet (save-data/slow connection) or hasn't
  // finished; a no-op otherwise (docs/adr/0004-payload-tier-split-defers-
  // low-fame-data.md).
  const handleSelectDepthLevel = useCallback(
    (level: DataDepthLevel) => {
      if (level.id === 'deep-cut') loadTier1();
      setFameScoreLevel(level);
    },
    [loadTier1, setFameScoreLevel],
  );
  const { selectedDomains, toggleDomain } = useOccupationDomainFilter();
  const { selectedRegions, toggleRegion } = useRegionFilter();
  const {
    selectedValues: selectedConflictsMilestonesValues,
    toggleValue: toggleConflictsMilestonesValue,
  } = useConflictsMilestonesFilter();
  const {
    selected: selectedRef,
    select: selectEntity,
    clear: closeDetailPanel,
  } = useSelectedEntity();
  const [filteredCounts, setFilteredCounts] = useState<FilteredCounts>();
  // Mobile-only drawer state for Sidebar (App.module.css/Sidebar.module.css
  // gate its visual effect to narrow viewports, but the open/close state
  // itself is tracked unconditionally, same shape as the other cross-widget
  // state below) — opening the detail panel auto-closes it so the two
  // overlays never compete for the same space (mobile-responsive-layout
  // spec's story 5).
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  // Desktop-only sidebar collapse, toggled by the « handle in Sidebar's own
  // header — no effect on mobile, where the drawer above already covers
  // hiding the sidebar.
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const handleEntityClick = useCallback(
    (ref: SelectedEntityRef) => {
      selectEntity(ref);
      setIsFilterDrawerOpen(false);
    },
    [selectEntity],
  );

  // Looks the clicked id up in the already-in-memory datasets (dynamic-
  // tooltips spec §2's "on-demand rendering" — nothing about drawer content
  // is precomputed for the full filtered dataset) rather than threading a
  // full entity object through the click event itself.
  const selectedEntity: DetailPanelEntity | null = useMemo(() => {
    if (!selectedRef) return null;
    if (selectedRef.entityType === 'person') {
      const person = peopleData.find(
        (candidate) => candidate.id === selectedRef.id,
      );
      return person ? { entityType: 'person', entity: person } : null;
    }
    if (selectedRef.entityType === 'conflict') {
      const entry = conflictsData.find(
        (candidate) => candidate.id === selectedRef.id,
      );
      return entry ? { entityType: 'conflict', entity: entry } : null;
    }
    const milestone = milestonesData.find(
      (candidate) => candidate.id === selectedRef.id,
    );
    return milestone ? { entityType: 'milestone', entity: milestone } : null;
  }, [selectedRef, peopleData, conflictsData, milestonesData]);

  return (
    <div className={styles.layout}>
      <Sidebar
        fameScoreValues={fameScoreValues}
        onFameScoreChange={setFameScoreValue}
        onSelectDepthLevel={handleSelectDepthLevel}
        isTier1Loading={isTier1Loading}
        filteredCounts={filteredCounts}
        selectedDomains={selectedDomains}
        onToggleDomain={toggleDomain}
        selectedRegions={selectedRegions}
        onToggleRegion={toggleRegion}
        selectedConflictsMilestonesValues={selectedConflictsMilestonesValues}
        onToggleConflictsMilestonesValue={toggleConflictsMilestonesValue}
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() =>
          setIsSidebarCollapsed((collapsed) => !collapsed)
        }
        onOpenAbout={() => {
          setIsAboutOpen(true);
          trackEvent('about_open');
        }}
      />
      <main className={styles.main}>
        <ErrorBoundary
          fallback={
            <div className={styles.timelineError}>
              {m.timelineErrorFallback()}
            </div>
          }
        >
          <TimelineCanvas
            people={peopleData}
            conflicts={conflictsData}
            milestones={milestonesData}
            fameScoreValues={fameScoreValues}
            selectedDomains={selectedDomains}
            selectedRegions={selectedRegions}
            selectedConflictsMilestonesValues={
              selectedConflictsMilestonesValues
            }
            onEntityClick={handleEntityClick}
            onFilteredCountsChange={setFilteredCounts}
            isFilterDrawerOpen={isFilterDrawerOpen}
            onToggleFilterDrawer={() => setIsFilterDrawerOpen((open) => !open)}
          />
        </ErrorBoundary>
      </main>
      <DetailPanel selected={selectedEntity} onClose={closeDetailPanel} />
      <AboutPanel isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </div>
  );
}
