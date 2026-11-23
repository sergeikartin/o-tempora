import { lazy, Suspense, use, useEffect, useMemo, useState } from 'react';
import { useOccupationDomainFilter } from '../features/filter-by-occupation-domain';
import { useRegionFilter } from '../features/filter-by-region';
import { useConflictsMilestonesFilter } from '../features/filter-conflicts-milestones';
import { useTimelineSearch } from '../features/search-timeline-entities';
import { DETAIL_LEVELS, type FameScoreLane } from '../shared/config';
import {
  type ActiveFilters,
  entitySpan,
  spanYears,
  visibleConflicts,
  visibleMilestones,
  visiblePeople,
} from '../shared/lib/entity';
import { trackEvent } from '../shared/lib/track-event';
import { m } from '../shared/paraglide/messages.js';
import { ErrorBoundary } from '../shared/ui';
import {
  type DetailPanelEntity,
  type DetailPanelMember,
  laneColor,
  type ProfileViewState,
  type ResolvedConnection,
  useProfile,
} from '../widgets/detail-panel';
import { TimelineCanvas } from '../widgets/timeline-canvas';
import { TopBar } from '../widgets/top-bar';
import styles from './App.module.css';
import { type LocaleDatasets, localeDatasetsPromise } from './locale-datasets';
import { useSelectionNavigation } from './use-selection-navigation';

// Both paint nothing until opened; lazy-loading keeps their code out of the
// bundle that must parse and execute before the initial timeline paint.
const AboutPanel = lazy(() =>
  import('../widgets/about-panel').then((mod) => ({
    default: mod.AboutPanel,
  })),
);
const HelpPanel = lazy(() =>
  import('../widgets/help-panel').then((mod) => ({
    default: mod.HelpPanel,
  })),
);
const DetailPanel = lazy(() =>
  import('../widgets/detail-panel').then((mod) => ({
    default: mod.DetailPanel,
  })),
);

// The prerender includes the closed detail panel. Its CSS must be in the main bundle
// to keep it offscreen on first paint. Referencing a class prevents tree shaking.
import detailPanelStyles from '../widgets/detail-panel/ui/DetailPanel.module.css';

void detailPanelStyles.panel;

interface AppProps {
  // Only the prerender supplies datasets directly. It cannot use runtime locale detection.
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

const LANE_FALLBACK_COLOR: Record<FameScoreLane, string> = {
  people: 'var(--color-domain-public-figure)',
  conflicts: 'var(--color-conflict)',
  milestones: 'var(--color-text-secondary)',
};

function isEntityHidden(selection: DetailPanelEntity, filters: ActiveFilters) {
  switch (selection.entityType) {
    case 'person':
      return visiblePeople([selection.entity], filters).length === 0;
    case 'conflict':
      return visibleConflicts([selection.entity], filters).length === 0;
    case 'milestone':
      return visibleMilestones([selection.entity], filters).length === 0;
  }
}

function AppContent({ initialDatasets }: AppProps) {
  const level1And2 = initialDatasets ?? use(localeDatasetsPromise);
  const navigation = useSelectionNavigation(level1And2);
  const { datasets, detailLevel, fameScoreValues, selectedEntity } = navigation;
  const {
    people: peopleData,
    conflicts: conflictsData,
    milestones: milestonesData,
  } = datasets;
  const { selectedDomains, toggleDomain } = useOccupationDomainFilter();
  const { selectedRegions, toggleRegion } = useRegionFilter();
  const {
    selectedValues: selectedConflictsMilestonesValues,
    toggleValue: toggleConflictsMilestonesValue,
  } = useConflictsMilestonesFilter();
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
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== '?' || event.ctrlKey || event.metaKey || event.altKey)
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      )
        return;
      if (document.querySelector('[aria-modal="true"]')) return;
      setIsHelpOpen(true);
      trackEvent('help_open', { via: 'key' });
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filters = useMemo<ActiveFilters>(
    () => ({
      fameScoreValues,
      selectedDomains,
      selectedRegions,
      selectedConflictsMilestonesValues,
    }),
    [
      fameScoreValues,
      selectedDomains,
      selectedRegions,
      selectedConflictsMilestonesValues,
    ],
  );

  const profileState = useProfile(
    selectedEntity?.entity.hasProfile ? selectedEntity.entity.slug : null,
  );
  const { anchor, findBySlug } = navigation;

  const panelMember = useMemo<DetailPanelMember | null>(() => {
    if (!selectedEntity) return null;
    let profileView: ProfileViewState | undefined;
    if (profileState?.status === 'ready') {
      const { connections: shipped, ...profile } = profileState.profile;
      const connections: ResolvedConnection[] = shipped.map((connection) => {
        const target = findBySlug(connection.slug);
        const levelIndex = connection.detailLevel - 1;
        return {
          slug: connection.slug,
          name: connection.name,
          reason: connection.reason,
          color: target
            ? laneColor(target)
            : LANE_FALLBACK_COLOR[connection.lane],
          levelIndex,
          isShown: levelIndex <= DETAIL_LEVELS.indexOf(detailLevel),
        };
      });
      profileView = {
        status: 'ready',
        profile,
        color: laneColor(selectedEntity),
        connections,
      };
    } else {
      profileView = profileState;
    }
    return {
      entity: selectedEntity,
      isHidden: isEntityHidden(selectedEntity, filters),
      profileView,
      anchor: anchor ?? undefined,
    };
  }, [selectedEntity, profileState, findBySlug, detailLevel, anchor, filters]);

  const selectedSpan = useMemo(
    () =>
      selectedEntity ? spanYears(entitySpan(selectedEntity.entity)) : null,
    [selectedEntity],
  );

  return (
    <div className={styles.layout}>
      <TopBar
        selectedLevelId={detailLevel.id}
        onSelectDetailLevel={navigation.selectDetailLevel}
        loadingLevelIds={navigation.loadingLevelIds}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchResults={searchResults}
        onSelectSearchResult={navigation.openSearchResult}
        selectedDomains={selectedDomains}
        onToggleDomain={toggleDomain}
        selectedRegions={selectedRegions}
        onToggleRegion={toggleRegion}
        selectedConflictsMilestonesValues={selectedConflictsMilestonesValues}
        onToggleConflictsMilestonesValue={toggleConflictsMilestonesValue}
        switchLanguageHref={navigation.siblingLocaleHref}
        onOpenHelp={() => {
          setIsHelpOpen(true);
          trackEvent('help_open', { via: 'link' });
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
            onEntityClick={navigation.openMark}
            selectedEntity={navigation.selectedRef}
            selectedSpan={selectedSpan}
            searchJumpTarget={navigation.panTarget}
            arrivalFit={navigation.arrivalFit}
          />
        </ErrorBoundary>
      </main>
      <Suspense fallback={null}>
        <DetailPanel
          member={panelMember}
          onOpenConnection={navigation.openConnection}
          onClose={navigation.close}
        />
      </Suspense>
      <Suspense fallback={null}>
        <HelpPanel
          isOpen={isHelpOpen}
          onClose={() => setIsHelpOpen(false)}
          onOpenAbout={() => {
            setIsHelpOpen(false);
            setIsAboutOpen(true);
            trackEvent('about_open');
          }}
        />
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
