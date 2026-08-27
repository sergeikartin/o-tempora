import { lazy, Suspense, use, useCallback, useMemo, useState } from 'react';
import { useFameScoreFilters } from '../features/filter-by-fame-score';
import { useOccupationDomainFilter } from '../features/filter-by-occupation-domain';
import { useRegionFilter } from '../features/filter-by-region';
import { useConflictsMilestonesFilter } from '../features/filter-conflicts-milestones';
import {
  type SearchResult,
  useTimelineSearch,
} from '../features/search-timeline-entities';
import {
  type SelectedEntityRef,
  useSelectedEntity,
} from '../features/select-timeline-entity';
import type { DetailLevel } from '../shared/config';
import { trackEvent } from '../shared/lib/track-event';
import { m } from '../shared/paraglide/messages.js';
import { ErrorBoundary } from '../shared/ui';
import type { DetailPanelEntity } from '../widgets/detail-panel';
import { Sidebar } from '../widgets/sidebar';
import { TimelineCanvas } from '../widgets/timeline-canvas';
import styles from './App.module.css';
import { type LocaleDatasets, localeDatasetsPromise } from './locale-datasets';
import { useDetailLevelDatasets } from './use-detail-level-datasets';

// Both are closed/empty by default (rendered unconditionally but paint
// nothing until opened) — lazy-loading keeps their code out of the bundle
// that has to parse+execute before the initial timeline paint (LCP audit,
// .scratch/pre-launch-readiness/issues/14).
const AboutPanel = lazy(() =>
  import('../widgets/about-panel').then((mod) => ({
    default: mod.AboutPanel,
  })),
);
const DetailPanel = lazy(() =>
  import('../widgets/detail-panel').then((mod) => ({
    default: mod.DetailPanel,
  })),
);

interface AppProps {
  // Set only by the build-time prerender step (vite-plugins/prerender-
  // default-viewport.ts), which already has the resolved level 1+2 dataset in
  // hand and can't reproduce main.tsx's runtime dynamic-import/locale-
  // detection path outside a browser. main.tsx's real mount always omits
  // this, so the client keeps resolving `localeDatasetsPromise` exactly as
  // before.
  initialDatasets?: LocaleDatasets;
}

export function App({ initialDatasets }: AppProps = {}) {
  return (
    <>
      <h1 className={styles.srOnly}>{m.siteTitle()}</h1>
      <Suspense fallback={<div className={styles.loading} />}>
        <AppContent initialDatasets={initialDatasets} />
      </Suspense>
    </>
  );
}

function AppContent({ initialDatasets }: AppProps) {
  const level1And2 = initialDatasets ?? use(localeDatasetsPromise);
  const {
    datasets: {
      people: peopleData,
      conflicts: conflictsData,
      milestones: milestonesData,
    },
    loadingLevelIds,
    requestLevel,
  } = useDetailLevelDatasets(level1And2);
  const {
    values: fameScoreValues,
    level: selectedLevel,
    setLevel: setFameScoreLevel,
  } = useFameScoreFilters();
  // Specialized/Deep Cut's data ships in a deferred delta file (CONTEXT.md's
  // Detail Level) — picking either triggers the on-demand fallback in case
  // the idle-prefetch hasn't started yet (save-data/slow connection) or
  // hasn't finished; a no-op otherwise (docs/adr/0006-detail-level-merges-
  // data-depth-and-payload-tier.md).
  const handleSelectDetailLevel = useCallback(
    (level: DetailLevel) => {
      requestLevel(level.id);
      setFameScoreLevel(level);
    },
    [requestLevel, setFameScoreLevel],
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
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    results: searchResults,
  } = useTimelineSearch({
    people: peopleData,
    conflicts: conflictsData,
    milestones: milestonesData,
    fameScoreValues,
    selectedDomains,
    selectedRegions,
    selectedConflictsMilestonesValues,
  });
  // Set only by a search pick (never a canvas click, which is already in
  // view) — TimelineCanvas watches this to pan, see its own comment.
  const [searchJumpTarget, setSearchJumpTarget] =
    useState<SelectedEntityRef | null>(null);
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

  // A search pick is a superset of handleEntityClick above (same select +
  // drawer-close), plus a fresh jump-target object TimelineCanvas's effect
  // watches to pan the timeline — a canvas click never sets this since
  // what's clicked is already on screen.
  const handleSelectSearchResult = useCallback(
    (result: SearchResult) => {
      const ref: SelectedEntityRef = {
        id: result.id,
        entityType: result.entityType,
      };
      selectEntity(ref);
      setIsFilterDrawerOpen(false);
      setSearchJumpTarget(ref);
      trackEvent('search_jump', { entityType: result.entityType });
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
        selectedLevelId={selectedLevel.id}
        onSelectDetailLevel={handleSelectDetailLevel}
        loadingLevelIds={loadingLevelIds}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchResults={searchResults}
        onSelectSearchResult={handleSelectSearchResult}
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
            isFilterDrawerOpen={isFilterDrawerOpen}
            onToggleFilterDrawer={() => setIsFilterDrawerOpen((open) => !open)}
            selectedEntity={selectedRef}
            searchJumpTarget={searchJumpTarget}
          />
        </ErrorBoundary>
      </main>
      <Suspense fallback={null}>
        <DetailPanel selected={selectedEntity} onClose={closeDetailPanel} />
      </Suspense>
      <Suspense fallback={null}>
        <AboutPanel
          isOpen={isAboutOpen}
          onClose={() => setIsAboutOpen(false)}
        />
      </Suspense>
    </div>
  );
}
