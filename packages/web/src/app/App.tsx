import {
  lazy,
  Suspense,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useFameScoreFilters } from '../features/filter-by-fame-score';
import { useOccupationDomainFilter } from '../features/filter-by-occupation-domain';
import { useRegionFilter } from '../features/filter-by-region';
import { useConflictsMilestonesFilter } from '../features/filter-conflicts-milestones';
import {
  type SearchResult,
  useTimelineSearch,
} from '../features/search-timeline-entities';
import {
  type EntityType,
  type SelectedEntityRef,
  useSelectedEntity,
} from '../features/select-timeline-entity';
import {
  DETAIL_LEVELS,
  type DetailLevel,
  type FameScoreLane,
  switchLanguageHref,
} from '../shared/config';
import { trackEvent } from '../shared/lib/track-event';
import { m } from '../shared/paraglide/messages.js';
import { ErrorBoundary } from '../shared/ui';
import type { DetailPanelEntity } from '../widgets/detail-panel';
import { Sidebar } from '../widgets/sidebar';
import { TimelineCanvas } from '../widgets/timeline-canvas';
import styles from './App.module.css';
import { type LocaleDatasets, localeDatasetsPromise } from './locale-datasets';
import { useDetailLevelDatasets } from './use-detail-level-datasets';

// Both paint nothing until opened; lazy-loading keeps their code out of the
// bundle that must parse and execute before the initial timeline paint.
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

// Pulled into the main CSS bundle (the component stays lazy above) so
// `.panel`'s closed transform applies before first paint. DetailPanel is
// always mounted (web/docs/adr/0006) and the prerender bakes its closed
// `<aside>` into index.html; if the CSS arrived with the lazy chunk, the
// unstyled panel would animate off-screen on every load. A bare side-effect
// import is tree-shaken away, so a class name is referenced instead.
import detailPanelStyles from '../widgets/detail-panel/ui/DetailPanel.module.css';

void detailPanelStyles.panel;

interface AppProps {
  // Set only by the build-time prerender
  // (vite-plugins/prerender-default-viewport.ts), which has the level 1+2
  // dataset resolved already and can't run main.tsx's runtime locale
  // detection. main.tsx omits it and resolves `localeDatasetsPromise`.
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

const LANE_BY_ENTITY_TYPE: Record<EntityType, FameScoreLane> = {
  person: 'people',
  conflict: 'conflicts',
  milestone: 'milestones',
};

interface FoundEntity {
  id: string;
  slug: string;
  entityType: EntityType;
  lane: FameScoreLane;
  fameScore: number;
}

function findEntity(
  datasets: LocaleDatasets,
  matches: (entity: { id: string; slug: string }) => boolean,
): FoundEntity | null {
  const entityTypes: EntityType[] = ['person', 'conflict', 'milestone'];
  for (const entityType of entityTypes) {
    const lane = LANE_BY_ENTITY_TYPE[entityType];
    const entity = (
      datasets[lane] as { id: string; slug: string; fameScore: number }[]
    ).find(matches);
    if (entity) {
      return {
        id: entity.id,
        slug: entity.slug,
        entityType,
        lane,
        fameScore: entity.fameScore,
      };
    }
  }
  return null;
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
  // Specialized/Deep Cut data ships in deferred delta files (CONTEXT.md's
  // Detail Level); picking either triggers the on-demand load if the
  // idle-prefetch hasn't started or finished, and is a no-op otherwise.
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
    selectedSlug,
    pendingLinkSlug,
    select: selectEntity,
    openLink: openEntityLink,
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
  // Set only by a search pick (a canvas click is already in view);
  // TimelineCanvas pans to it.
  const [searchJumpTarget, setSearchJumpTarget] =
    useState<SelectedEntityRef | null>(null);
  // Mobile drawer state for Sidebar (only narrow viewports show its effect).
  // Opening the detail panel closes it so the two overlays never compete.
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  // Desktop-only sidebar collapse, toggled by Sidebar's « handle.
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  // An Entity Link (`?e=<slug>`) names only a slug: look it up in what's loaded,
  // fetching level 3 and then level 4 one at a time while it's missing, then
  // open it exactly as a search pick does — raising the Detail Level only as
  // far as the entity's own Fame Score needs. A slug that no level contains
  // opens the timeline with no panel.
  useEffect(() => {
    if (!pendingLinkSlug) return;
    const found = findEntity(
      {
        people: peopleData,
        conflicts: conflictsData,
        milestones: milestonesData,
      },
      (entity) => entity.slug === pendingLinkSlug,
    );
    if (found) {
      const currentIndex = DETAIL_LEVELS.indexOf(selectedLevel);
      const neededLevel =
        DETAIL_LEVELS.slice(currentIndex).find(
          (level) => level.values[found.lane] <= found.fameScore,
        ) ?? selectedLevel;
      if (neededLevel.id !== selectedLevel.id) {
        handleSelectDetailLevel(neededLevel);
      }
      const ref: SelectedEntityRef = {
        id: found.id,
        entityType: found.entityType,
      };
      openEntityLink(ref, found.slug);
      setIsFilterDrawerOpen(false);
      setSearchJumpTarget(ref);
      return;
    }
    if (loadingLevelIds.includes('specialized')) {
      requestLevel('specialized');
    } else if (loadingLevelIds.includes('deep-cut')) {
      requestLevel('deep-cut');
    } else {
      closeDetailPanel();
    }
  }, [
    pendingLinkSlug,
    peopleData,
    conflictsData,
    milestonesData,
    loadingLevelIds,
    selectedLevel,
    requestLevel,
    handleSelectDetailLevel,
    openEntityLink,
    closeDetailPanel,
  ]);

  const handleEntityClick = useCallback(
    (ref: SelectedEntityRef) => {
      const found = findEntity(
        {
          people: peopleData,
          conflicts: conflictsData,
          milestones: milestonesData,
        },
        (entity) => entity.id === ref.id,
      );
      if (!found) return;
      selectEntity(ref, found.slug);
      setIsFilterDrawerOpen(false);
    },
    [selectEntity, peopleData, conflictsData, milestonesData],
  );

  // handleEntityClick plus a fresh jump-target object that TimelineCanvas's
  // effect watches to pan the timeline.
  const handleSelectSearchResult = useCallback(
    (result: SearchResult) => {
      const ref: SelectedEntityRef = {
        id: result.id,
        entityType: result.entityType,
      };
      selectEntity(ref, result.slug);
      setIsFilterDrawerOpen(false);
      setSearchJumpTarget(ref);
      trackEvent('search_jump', { entityType: result.entityType });
    },
    [selectEntity],
  );

  // Looks the clicked id up in the in-memory datasets rather than threading
  // a full entity through the click event.
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
        switchLanguageHref={switchLanguageHref(selectedSlug ?? pendingLinkSlug)}
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
