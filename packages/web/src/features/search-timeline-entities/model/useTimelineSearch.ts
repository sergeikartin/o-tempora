import { useMemo } from 'react';
import {
  type ConflictsMilestonesFilterValue,
  DETAIL_LEVELS,
  type DetailLevelId,
  type FameScoreLane,
} from '../../../shared/config';
import {
  type EntityType,
  visibleConflicts,
  visibleMilestones,
  visiblePeople,
} from '../../../shared/lib/entity';
import type {
  OccupationDomain,
  Region,
  SearchIndex,
} from '../../../shared/types';

const MAX_RESULTS = 8;
const DEEPEST_LEVEL = DETAIL_LEVELS[3];
const EMPTY_INDEX: SearchIndex = { people: [], conflicts: [], milestones: [] };

export interface SearchResult {
  id: string;
  slug: string;
  entityType: EntityType;
  name: string;
  tagline: string;
  fameScore: number;
  detailLevel: DetailLevelId;
}

interface UseTimelineSearchArgs {
  query: string;
  index: SearchIndex | null;
  selectedDomains: OccupationDomain[];
  selectedRegions: Region[];
  selectedConflictsMilestonesValues: ConflictsMilestonesFilterValue[];
}

function matchLane(
  entries: SearchIndex['conflicts'],
  query: string,
  entityType: EntityType,
  lane: FameScoreLane,
): SearchResult[] {
  return entries
    .filter((entry) => matchesQuery(entry, query))
    .map((entry) => {
      const { id, slug, name, tagline, fameScore } = entry;
      const level = DETAIL_LEVELS.find(
        (candidate) => fameScore >= candidate.values[lane],
      );
      return {
        id,
        slug,
        name,
        tagline,
        fameScore,
        entityType,
        detailLevel: (level ?? DEEPEST_LEVEL).id,
      };
    });
}

function matchesQuery(
  entity: { name: string; tagline: string },
  query: string,
): boolean {
  return (
    entity.name.toLowerCase().includes(query) ||
    entity.tagline.toLowerCase().includes(query)
  );
}

// Search uses the canvas filters with the widest supported Fame Score range.
export function useTimelineSearch({
  query,
  index,
  selectedDomains,
  selectedRegions,
  selectedConflictsMilestonesValues,
}: UseTimelineSearchArgs) {
  const { people, conflicts, milestones } = index ?? EMPTY_INDEX;

  const filters = useMemo(
    () => ({
      fameScoreValues: DEEPEST_LEVEL.values,
      selectedDomains,
      selectedRegions,
      selectedConflictsMilestonesValues,
    }),
    [selectedDomains, selectedRegions, selectedConflictsMilestonesValues],
  );
  const filteredPeople = useMemo(
    () => visiblePeople(people, filters),
    [people, filters],
  );
  const filteredConflicts = useMemo(
    () => visibleConflicts(conflicts, filters),
    [conflicts, filters],
  );
  const filteredMilestones = useMemo(
    () => visibleMilestones(milestones, filters),
    [milestones, filters],
  );

  return useMemo<SearchResult[]>(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];

    const matched: SearchResult[] = [
      ...matchLane(filteredPeople, trimmed, 'person', 'people'),
      ...matchLane(filteredConflicts, trimmed, 'conflict', 'conflicts'),
      ...matchLane(filteredMilestones, trimmed, 'milestone', 'milestones'),
    ];

    return matched
      .sort((a, b) => b.fameScore - a.fameScore)
      .slice(0, MAX_RESULTS);
  }, [query, filteredPeople, filteredConflicts, filteredMilestones]);
}
