import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFameScoreFilters } from '../features/filter-by-fame-score';
import type { SearchResult } from '../features/search-timeline-entities';
import { useSelection } from '../features/select-timeline-entity';
import {
  DETAIL_LEVELS,
  type DetailLevel,
  type FameScoreLane,
  switchLanguageHref,
} from '../shared/config';
import {
  type EntityType,
  entitySpan,
  type SelectedEntityRef,
  type SelectionMember,
  spanYears,
} from '../shared/lib/entity';
import { trackEvent } from '../shared/lib/track-event';
import type { DetailPanelEntity } from '../widgets/detail-panel';
import type { ArrivalFit } from '../widgets/timeline-canvas';
import type { LocaleDatasets } from './locale-datasets';
import { useDetailLevelDatasets } from './use-detail-level-datasets';

const LANE_BY_ENTITY_TYPE: Record<EntityType, FameScoreLane> = {
  person: 'people',
  conflict: 'conflicts',
  milestone: 'milestones',
};

function findEntity(
  datasets: LocaleDatasets,
  query: { slug: string } | SelectedEntityRef,
): DetailPanelEntity | null {
  const entityType = 'slug' in query ? undefined : query.entityType;
  const matches = (entity: { id: string; slug: string }) =>
    'slug' in query ? entity.slug === query.slug : entity.id === query.id;
  if (!entityType || entityType === 'person') {
    const entity = datasets.people.find(matches);
    if (entity) return { entityType: 'person', entity };
  }
  if (!entityType || entityType === 'conflict') {
    const entity = datasets.conflicts.find(matches);
    if (entity) return { entityType: 'conflict', entity };
  }
  if (!entityType || entityType === 'milestone') {
    const entity = datasets.milestones.find(matches);
    if (entity) return { entityType: 'milestone', entity };
  }
  return null;
}

type ViewportMove =
  | { kind: 'pan'; target: SelectedEntityRef }
  | { kind: 'fit'; target: ArrivalFit };

export function useSelectionNavigation(base: LocaleDatasets) {
  const { datasets, loadingLevelIds, requestLevel } =
    useDetailLevelDatasets(base);
  const { values: fameScoreValues, level, setLevel } = useFameScoreFilters();
  const {
    member,
    anchor,
    pending,
    replace,
    follow,
    openLink,
    clear,
    requestConnection,
    cancelPending,
  } = useSelection();
  const [move, setMove] = useState<ViewportMove | null>(null);

  const selectDetailLevel = useCallback(
    (nextLevel: DetailLevel) => {
      requestLevel(nextLevel.id);
      setLevel(nextLevel);
    },
    [requestLevel, setLevel],
  );
  const findBySlug = useCallback(
    (slug: string) => findEntity(datasets, { slug }),
    [datasets],
  );
  const selectedEntity = useMemo(
    () => (member ? findEntity(datasets, member.ref) : null),
    [datasets, member],
  );

  useEffect(() => {
    if (!pending) return;
    const target = findBySlug(pending.slug);
    if (!target) {
      const nextLevel = loadingLevelIds[0];
      if (nextLevel) requestLevel(nextLevel);
      else if (pending.via === 'link') clear();
      else cancelPending();
      return;
    }
    const lane = LANE_BY_ENTITY_TYPE[target.entityType];
    const needed = DETAIL_LEVELS.slice(DETAIL_LEVELS.indexOf(level)).find(
      (candidate) => candidate.values[lane] <= target.entity.fameScore,
    );
    if (needed && needed !== level) selectDetailLevel(needed);

    const selection: SelectionMember = {
      ref: { id: target.entity.id, entityType: target.entityType },
      slug: target.entity.slug,
    };
    if (pending.via === 'link') {
      openLink(selection);
      setMove({
        kind: 'fit',
        target: {
          years: spanYears(entitySpan(target.entity)),
          entity: selection.ref,
        },
      });
    } else {
      follow(selection);
      setMove({ kind: 'pan', target: selection.ref });
    }
  }, [
    pending,
    findBySlug,
    loadingLevelIds,
    requestLevel,
    level,
    selectDetailLevel,
    openLink,
    follow,
    clear,
    cancelPending,
  ]);

  // Warm Connection targets for responsive hops and accurate Lane colors.
  // Pending hops resolve independently if the data has yet to arrive.
  const hasProfile = Boolean(selectedEntity?.entity.hasProfile);
  useEffect(() => {
    if (!hasProfile) return;
    requestLevel('specialized');
    requestLevel('deep-cut');
  }, [hasProfile, requestLevel]);

  const openMark = useCallback(
    (ref: SelectedEntityRef) => {
      const target = findEntity(datasets, ref);
      if (target) replace({ ref, slug: target.entity.slug });
    },
    [datasets, replace],
  );

  const openSearchResult = useCallback(
    ({ id, entityType, slug }: SearchResult) => {
      const ref = { id, entityType };
      replace({ ref, slug });
      setMove({ kind: 'pan', target: ref });
      trackEvent('search_jump', { entityType });
    },
    [replace],
  );

  return {
    datasets,
    detailLevel: level,
    fameScoreValues,
    loadingLevelIds,
    selectDetailLevel,
    selectedEntity,
    selectedRef: member?.ref ?? null,
    anchor,
    findBySlug,
    siblingLocaleHref: switchLanguageHref(
      (pending?.via === 'link' ? pending.slug : member?.slug) ?? null,
    ),
    openMark,
    openSearchResult,
    openConnection: requestConnection,
    close: clear,
    panTarget: move?.kind === 'pan' ? move.target : null,
    arrivalFit: move?.kind === 'fit' ? move.target : null,
  };
}
