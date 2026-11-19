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
  type SelectionMember,
  useSelection,
} from '../features/select-timeline-entity';
import {
  DETAIL_LEVELS,
  type DetailLevel,
  type FameScoreLane,
  switchLanguageHref,
} from '../shared/config';
import {
  type ActiveFilters,
  entitySpan,
  type SpannedEntity,
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
import { type ArrivalFit, TimelineCanvas } from '../widgets/timeline-canvas';
import { TopBar } from '../widgets/top-bar';
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

// A Connection's mark color until its target's data has loaded.
const LANE_FALLBACK_COLOR: Record<FameScoreLane, string> = {
  people: 'var(--color-domain-public-figure)',
  conflicts: 'var(--color-conflict)',
  milestones: 'var(--color-text-secondary)',
};

interface FoundEntity {
  id: string;
  slug: string;
  entityType: EntityType;
  lane: FameScoreLane;
  fameScore: number;
  entity: SpannedEntity;
}

function findEntity(
  datasets: LocaleDatasets,
  matches: (entity: { id: string; slug: string }) => boolean,
): FoundEntity | null {
  const entityTypes: EntityType[] = ['person', 'conflict', 'milestone'];
  for (const entityType of entityTypes) {
    const lane = LANE_BY_ENTITY_TYPE[entityType];
    const entity = (
      datasets[lane] as (SpannedEntity & {
        id: string;
        slug: string;
        fameScore: number;
      })[]
    ).find(matches);
    if (entity) {
      return {
        id: entity.id,
        slug: entity.slug,
        entityType,
        lane,
        fameScore: entity.fameScore,
        entity,
      };
    }
  }
  return null;
}

// Index into DETAIL_LEVELS of the lowest level whose floor lets the entity in.
function levelIndexOf(found: FoundEntity): number {
  const index = DETAIL_LEVELS.findIndex(
    (level) => level.values[found.lane] <= found.fameScore,
  );
  return index === -1 ? DETAIL_LEVELS.length - 1 : index;
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
  // Specialized/Deep Cut data ships in deferred delta files (GLOSSARY.md's
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
    member,
    anchor,
    pendingLinkSlug,
    replace: replaceSelection,
    follow: followConnection,
    openLink: openEntityLink,
    clear: closeDetailPanel,
  } = useSelection();
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
  // Set only when an Entity Link opens; TimelineCanvas fits the viewport to it.
  const [arrivalFit, setArrivalFit] = useState<ArrivalFit | null>(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // `?` opens Help from anywhere outside a text field, never over another
  // open modal.
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

  // An Entity Link (`?e=<slug>`) names only a slug: look it up in what's
  // loaded, fetching level 3 and then level 4 one at a time while it is
  // missing, then open it — raising the Detail Level only as far as its Fame
  // Score needs — and fit the viewport to it. A slug that no level contains
  // is dropped and the timeline opens with no panel.
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
    if (!found) {
      if (loadingLevelIds.includes('specialized')) {
        requestLevel('specialized');
        return;
      }
      if (loadingLevelIds.includes('deep-cut')) {
        requestLevel('deep-cut');
        return;
      }
      closeDetailPanel();
      return;
    }
    const currentIndex = DETAIL_LEVELS.indexOf(selectedLevel);
    const neededLevel = DETAIL_LEVELS.slice(currentIndex).find(
      (candidate) => candidate.values[found.lane] <= found.fameScore,
    );
    if (neededLevel && neededLevel.id !== selectedLevel.id) {
      handleSelectDetailLevel(neededLevel);
    }
    const opened: SelectionMember = {
      ref: { id: found.id, entityType: found.entityType },
      slug: found.slug,
    };
    openEntityLink(opened);
    setArrivalFit({
      years: spanYears(entitySpan(found.entity)),
      entity: opened.ref,
    });
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

  // A click replaces the Selection.
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
      replaceSelection({ ref, slug: found.slug });
    },
    [replaceSelection, peopleData, conflictsData, milestonesData],
  );

  // A search pick replaces the Selection like a plain click, plus a fresh
  // jump-target object that TimelineCanvas's effect watches to pan the
  // timeline.
  const handleSelectSearchResult = useCallback(
    (result: SearchResult) => {
      const ref: SelectedEntityRef = {
        id: result.id,
        entityType: result.entityType,
      };
      replaceSelection({ ref, slug: result.slug });
      setSearchJumpTarget(ref);
      trackEvent('search_jump', { entityType: result.entityType });
    },
    [replaceSelection],
  );

  // A Connection opens its target the way an Entity Link does: the Selection
  // becomes that entity (a new history entry), the Detail Level rises far
  // enough to show it, and the timeline pans to it. Filters never gate it.
  const handleOpenConnection = useCallback(
    (slug: string) => {
      const found = findEntity(
        {
          people: peopleData,
          conflicts: conflictsData,
          milestones: milestonesData,
        },
        (entity) => entity.slug === slug,
      );
      if (!found) return;
      const neededLevel = DETAIL_LEVELS[levelIndexOf(found)];
      if (
        neededLevel &&
        DETAIL_LEVELS.indexOf(neededLevel) >
          DETAIL_LEVELS.indexOf(selectedLevel)
      ) {
        handleSelectDetailLevel(neededLevel);
      }
      const ref: SelectedEntityRef = {
        id: found.id,
        entityType: found.entityType,
      };
      followConnection({ ref, slug });
      setSearchJumpTarget(ref);
    },
    [
      peopleData,
      conflictsData,
      milestonesData,
      selectedLevel,
      handleSelectDetailLevel,
      followConnection,
    ],
  );

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

  const lanes = useMemo(
    () => ({
      people: peopleData,
      conflicts: conflictsData,
      milestones: milestonesData,
    }),
    [peopleData, conflictsData, milestonesData],
  );

  // Looks the Selection up in the in-memory datasets rather than threading full
  // entities through the click event, and derives what the panel and the canvas
  // show about it: the panel member (hidden when Detail Level or a filter takes
  // its mark off the canvas) and the span the Focus Range names.
  const selected = useMemo<{
    entity: DetailPanelEntity;
    isHidden: boolean;
    hasProfile: boolean;
  } | null>(() => {
    if (!member) return null;
    const { ref } = member;
    if (ref.entityType === 'person') {
      const person = lanes.people.find((candidate) => candidate.id === ref.id);
      if (!person) return null;
      return {
        entity: { entityType: 'person', entity: person },
        isHidden: visiblePeople([person], filters).length === 0,
        hasProfile: Boolean(person.hasProfile),
      };
    }
    if (ref.entityType === 'conflict') {
      const entry = lanes.conflicts.find(
        (candidate) => candidate.id === ref.id,
      );
      if (!entry) return null;
      return {
        entity: { entityType: 'conflict', entity: entry },
        isHidden: visibleConflicts([entry], filters).length === 0,
        hasProfile: Boolean(entry.hasProfile),
      };
    }
    const milestone = lanes.milestones.find(
      (candidate) => candidate.id === ref.id,
    );
    if (!milestone) return null;
    return {
      entity: { entityType: 'milestone', entity: milestone },
      isHidden: visibleMilestones([milestone], filters).length === 0,
      hasProfile: Boolean(milestone.hasProfile),
    };
  }, [member, lanes, filters]);

  // The shipped Profile is fetched only when the row says one exists.
  const profileState = useProfile(
    selected?.hasProfile && member ? member.slug : null,
  );

  const panelMember = useMemo<DetailPanelMember | null>(() => {
    if (!selected) return null;
    let profileView: ProfileViewState | undefined;
    if (profileState?.status === 'ready') {
      const { connections: shipped, ...profile } = profileState.profile;
      const connections: ResolvedConnection[] = shipped.map((connection) => {
        const target = findEntity(
          lanes,
          (candidate) => candidate.slug === connection.slug,
        );
        const levelIndex = connection.detailLevel - 1;
        return {
          slug: connection.slug,
          name: connection.name,
          reason: connection.reason,
          color: target
            ? laneColor({
                entityType: target.entityType,
                entity: target.entity,
              } as DetailPanelEntity)
            : LANE_FALLBACK_COLOR[connection.lane],
          levelIndex,
          isShown: levelIndex <= DETAIL_LEVELS.indexOf(selectedLevel),
        };
      });
      profileView = {
        status: 'ready',
        profile,
        color: laneColor(selected.entity),
        connections,
      };
    } else {
      profileView = profileState;
    }
    return {
      entity: selected.entity,
      isHidden: selected.isHidden,
      profileView,
      anchor: anchor ?? undefined,
    };
  }, [selected, profileState, lanes, selectedLevel, anchor]);

  const selectedSpan = useMemo(
    () => (selected ? spanYears(entitySpan(selected.entity.entity)) : null),
    [selected],
  );

  // A Profile lists targets down to Deep Cut; their data is fetched when one
  // opens so the Connections section is complete.
  const hasProfile = selected?.hasProfile ?? false;
  useEffect(() => {
    if (!hasProfile) return;
    requestLevel('specialized');
    requestLevel('deep-cut');
  }, [hasProfile, requestLevel]);

  const siblingLocaleHref = switchLanguageHref(
    pendingLinkSlug ?? member?.slug ?? null,
  );

  return (
    <div className={styles.layout}>
      <TopBar
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
            onEntityClick={handleEntityClick}
            selectedEntity={member?.ref ?? null}
            selectedSpan={selectedSpan}
            searchJumpTarget={searchJumpTarget}
            arrivalFit={arrivalFit}
          />
        </ErrorBoundary>
      </main>
      <Suspense fallback={null}>
        <DetailPanel
          member={panelMember}
          onOpenConnection={handleOpenConnection}
          onClose={closeDetailPanel}
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
          switchLanguageHref={siblingLocaleHref}
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
