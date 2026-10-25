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
import { formatYearMonthRange } from '../shared/lib/date';
import {
  type ActiveFilters,
  computeOverlap,
  entitySpan,
  type SpannedEntity,
  spanYears,
  unionYears,
  visibleConflicts,
  visibleMilestones,
  visiblePeople,
} from '../shared/lib/entity';
import { trackEvent } from '../shared/lib/track-event';
import { m } from '../shared/paraglide/messages.js';
import { ErrorBoundary } from '../shared/ui';
import {
  buildConnection,
  type DetailPanelEntity,
  type DetailPanelMember,
  laneColor,
  type ResolvedConnection,
  SAMPLE_PROFILES,
} from '../widgets/detail-panel';
import {
  type AddToSelectionControl,
  type ArrivalFit,
  type SelectionBandsData,
  TimelineCanvas,
} from '../widgets/timeline-canvas';
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
    members,
    isFull: isSelectionFull,
    pendingLinkSlugs,
    replace: replaceSelection,
    toggle: toggleSelectionMember,
    openLink: openEntityLink,
    clear: clearSelection,
  } = useSelection();
  // The panel's "Add to comparison" arms this so the next mark picked is added
  // to the Selection rather than replacing it (the touch route to
  // Shift-click).
  const [isAdding, setIsAdding] = useState(false);
  const closeDetailPanel = useCallback(() => {
    setIsAdding(false);
    clearSelection();
  }, [clearSelection]);
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

  // An Entity Link (`?e=<slug>`, repeated) names only slugs: look them up in
  // what's loaded, fetching level 3 and then level 4 one at a time while any is
  // missing, then open them as one Selection — raising the Detail Level only as
  // far as the least famous entity's Fame Score needs — and fit the viewport to
  // them. A slug that no level contains is dropped; with none left the
  // timeline opens with no panel.
  useEffect(() => {
    if (pendingLinkSlugs.length === 0) return;
    const datasets = {
      people: peopleData,
      conflicts: conflictsData,
      milestones: milestonesData,
    };
    const found = pendingLinkSlugs.map((slug) =>
      findEntity(datasets, (entity) => entity.slug === slug),
    );
    if (found.includes(null)) {
      if (loadingLevelIds.includes('specialized')) {
        requestLevel('specialized');
        return;
      }
      if (loadingLevelIds.includes('deep-cut')) {
        requestLevel('deep-cut');
        return;
      }
    }
    const resolved = found.filter((entity) => entity !== null);
    if (resolved.length === 0) {
      closeDetailPanel();
      return;
    }
    const currentIndex = DETAIL_LEVELS.indexOf(selectedLevel);
    const neededIndex = Math.max(
      currentIndex,
      ...resolved.map((entity) => {
        const level = DETAIL_LEVELS.slice(currentIndex).find(
          (candidate) => candidate.values[entity.lane] <= entity.fameScore,
        );
        return level ? DETAIL_LEVELS.indexOf(level) : currentIndex;
      }),
    );
    const neededLevel = DETAIL_LEVELS[neededIndex];
    if (neededLevel && neededLevel.id !== selectedLevel.id) {
      handleSelectDetailLevel(neededLevel);
    }
    const opened = resolved.map(
      (entity): SelectionMember => ({
        ref: { id: entity.id, entityType: entity.entityType },
        slug: entity.slug,
      }),
    );
    const years = unionYears(
      resolved.map((entity) => entitySpan(entity.entity)),
    );
    openEntityLink(opened);
    setIsAdding(false);
    if (years) {
      setArrivalFit({ years, entities: opened.map((member) => member.ref) });
    }
  }, [
    pendingLinkSlugs,
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

  // A plain click replaces the Selection; a Shift/Ctrl/Cmd-click, or any click
  // while the panel's add mode is armed, toggles the mark in or out of it.
  const handleEntityClick = useCallback(
    (ref: SelectedEntityRef, additive: boolean) => {
      const found = findEntity(
        {
          people: peopleData,
          conflicts: conflictsData,
          milestones: milestonesData,
        },
        (entity) => entity.id === ref.id,
      );
      if (!found) return;
      const member = { ref, slug: found.slug };
      if (additive || isAdding) toggleSelectionMember(member);
      else replaceSelection(member);
      setIsAdding(false);
    },
    [
      replaceSelection,
      toggleSelectionMember,
      isAdding,
      peopleData,
      conflictsData,
      milestonesData,
    ],
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
      setIsAdding(false);
      setSearchJumpTarget(ref);
      trackEvent('search_jump', { entityType: result.entityType });
    },
    [replaceSelection],
  );

  // A Connection opens its target the way an Entity Link does: the Selection
  // becomes that entity, the Detail Level rises far enough to show it, and the
  // timeline pans to it.
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
      replaceSelection({ ref, slug });
      setIsAdding(false);
      setSearchJumpTarget(ref);
    },
    [
      peopleData,
      conflictsData,
      milestonesData,
      selectedLevel,
      handleSelectDetailLevel,
      replaceSelection,
    ],
  );

  const handleRemoveMember = useCallback(
    (id: string) => {
      const member = members.find((candidate) => candidate.ref.id === id);
      if (member) toggleSelectionMember(member);
    },
    [members, toggleSelectionMember],
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

  // Looks each member up in the in-memory datasets rather than threading full
  // entities through the click event, and derives everything the panel and the
  // canvas show about the Selection from them: the panel members (hidden when
  // Detail Level or a filter takes their mark off the canvas), the Span Bands
  // and the Overlap Band with the line that states it. The bands and the line
  // come from one computeOverlap call so they can't disagree.
  const selectionView = useMemo(() => {
    const panelMembers: DetailPanelMember[] = [];
    const spans: {
      id: string;
      name: string;
      span: ReturnType<typeof entitySpan>;
    }[] = [];
    for (const { ref, slug } of members) {
      let entity: DetailPanelEntity | null = null;
      let isHidden = false;
      if (ref.entityType === 'person') {
        const person = peopleData.find((candidate) => candidate.id === ref.id);
        if (person) {
          entity = { entityType: 'person', entity: person };
          isHidden = visiblePeople([person], filters).length === 0;
        }
      } else if (ref.entityType === 'conflict') {
        const entry = conflictsData.find(
          (candidate) => candidate.id === ref.id,
        );
        if (entry) {
          entity = { entityType: 'conflict', entity: entry };
          isHidden = visibleConflicts([entry], filters).length === 0;
        }
      } else {
        const milestone = milestonesData.find(
          (candidate) => candidate.id === ref.id,
        );
        if (milestone) {
          entity = { entityType: 'milestone', entity: milestone };
          isHidden = visibleMilestones([milestone], filters).length === 0;
        }
      }
      if (!entity) continue;
      const profile = members.length === 1 ? SAMPLE_PROFILES[slug] : undefined;
      const connections: ResolvedConnection[] = [];
      for (const connection of profile?.connections ?? []) {
        const target = findEntity(
          {
            people: peopleData,
            conflicts: conflictsData,
            milestones: milestonesData,
          },
          (candidate) => candidate.slug === connection.slug,
        );
        if (!target) continue;
        const levelIndex = levelIndexOf(target);
        connections.push(
          buildConnection(
            {
              entityType: target.entityType,
              entity: target.entity,
            } as DetailPanelEntity,
            connection.slug,
            connection.reason,
            {
              levelIndex,
              isShown: levelIndex <= DETAIL_LEVELS.indexOf(selectedLevel),
            },
          ),
        );
      }
      panelMembers.push({
        entity,
        isHidden,
        profileView: profile
          ? { profile, color: laneColor(entity), connections }
          : undefined,
      });
      spans.push({
        id: entity.entity.id,
        name: entity.entity.name,
        span: entitySpan(entity.entity),
      });
    }
    const overlap = computeOverlap(spans.map((member) => member.span));
    let overlapLine: string | null = null;
    if (spans.length >= 2) {
      overlapLine = overlap
        ? m.overlapLine({
            range: formatYearMonthRange(overlap.start, overlap.end),
          })
        : m.noSharedSpan();
    }
    const bands: SelectionBandsData = {
      spans: spans.map(({ id, span }) => ({
        id,
        ...spanYears(span),
        isPoint: span.isPoint,
      })),
      overlap: overlap ? spanYears(overlap) : null,
      description: m
        .selectionBandsDescription({
          spans: spans
            .map(
              ({ name, span }) =>
                `${name} (${formatYearMonthRange(span.start, span.end)})`,
            )
            .join('; '),
          overlap: overlapLine ?? '',
        })
        .trim(),
    };
    return { panelMembers, overlapLine, bands };
  }, [
    members,
    peopleData,
    conflictsData,
    milestonesData,
    filters,
    selectedLevel,
  ]);

  // A Profile lists targets down to Deep Cut; their data is fetched when one
  // opens so the Connections section is complete.
  const hasProfile = selectionView.panelMembers.some(
    (member) => member.profileView,
  );
  useEffect(() => {
    if (!hasProfile) return;
    requestLevel('specialized');
    requestLevel('deep-cut');
  }, [hasProfile, requestLevel]);
  const addToSelection = useMemo<AddToSelectionControl>(
    () => ({
      isAdding,
      isFull: isSelectionFull,
      onToggle: () => setIsAdding((adding) => !adding),
    }),
    [isAdding, isSelectionFull],
  );
  const selectedRefs = useMemo(
    () => members.map((member) => member.ref),
    [members],
  );

  const siblingLocaleHref = switchLanguageHref(
    pendingLinkSlugs.length > 0
      ? pendingLinkSlugs
      : members.map((member) => member.slug),
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
            selectedEntities={selectedRefs}
            selectionBands={selectionView.bands}
            addToSelection={addToSelection}
            searchJumpTarget={searchJumpTarget}
            arrivalFit={arrivalFit}
          />
        </ErrorBoundary>
      </main>
      <Suspense fallback={null}>
        <DetailPanel
          members={selectionView.panelMembers}
          overlapLine={selectionView.overlapLine}
          isAdding={isAdding}
          onRemoveMember={handleRemoveMember}
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
