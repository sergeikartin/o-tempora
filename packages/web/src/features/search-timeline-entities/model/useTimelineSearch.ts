import { useMemo, useState } from 'react';
import type { ConflictsMilestonesFilterValue } from '../../../shared/config';
import {
  type EntityType,
  filterByFameScore,
  filterByMilestoneCategoryGroup,
  filterByOccupationDomain,
  filterByRegion,
  filterConflictsByFilterValues,
} from '../../../shared/lib/entity';
import type {
  ConflictEntry,
  Milestone,
  OccupationDomain,
  Person,
  Region,
} from '../../../shared/types';

// A plain structural copy of features/filter-by-fame-score's FameScoreValues
// — not imported directly, since FSD forbids one feature importing another
// at the same layer. TypeScript's structural typing means App.tsx's real
// FameScoreValues still satisfies this without a cast.
interface FameScoreValues {
  people: number;
  conflicts: number;
  milestones: number;
}

// CONTEXT.md's Search entry: capped "total across all lanes, not per lane"
// (grill-with-docs session), ranked by Fame Score.
const MAX_RESULTS = 8;

export interface SearchResult {
  id: string;
  entityType: EntityType;
  name: string;
  tagline: string;
  fameScore: number;
}

interface UseTimelineSearchArgs {
  people: Person[];
  conflicts: ConflictEntry[];
  milestones: Milestone[];
  fameScoreValues: FameScoreValues;
  selectedDomains: OccupationDomain[];
  selectedRegions: Region[];
  selectedConflictsMilestonesValues: ConflictsMilestonesFilterValue[];
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

// Session-only search query state (no persistence, same shape as every
// other filter hook here) — owned by this feature since it's shared by
// widgets/sidebar (the input/dropdown) and app/ (which resolves a picked
// result into a pan + selection, mirroring features/select-timeline-entity's
// "feature owns cross-widget state" comment).
//
// Reuses the exact same filterBy*/filterConflictsByFilterValues pipeline
// TimelineCanvas applies (shared/lib/entity/) so a search result
// can never surface an entity the current Data Depth/Region/Occupation
// Domain/Conflicts & Milestones filters have hidden from the canvas — see
// CONTEXT.md's Search entry and
// docs/adr/0010-search-stays-inside-active-filters-and-payload-tiers.md.
// `people`/`conflicts`/`milestones` are expected to be the same merged
// Tier0(+Tier1) arrays already passed to TimelineCanvas, so results
// automatically reflect however much of Tier 1 has loaded so far, with no
// separate load triggered here.
export function useTimelineSearch({
  people,
  conflicts,
  milestones,
  fameScoreValues,
  selectedDomains,
  selectedRegions,
  selectedConflictsMilestonesValues,
}: UseTimelineSearchArgs) {
  const [query, setQuery] = useState('');

  const filteredPeople = useMemo(
    () =>
      filterByRegion(
        filterByOccupationDomain(
          filterByFameScore(people, fameScoreValues.people),
          selectedDomains,
        ),
        selectedRegions,
        (person) => person.regionTags,
      ),
    [people, fameScoreValues.people, selectedDomains, selectedRegions],
  );
  const filteredConflicts = useMemo(
    () =>
      filterConflictsByFilterValues(
        filterByRegion(
          filterByFameScore(conflicts, fameScoreValues.conflicts),
          selectedRegions,
          (entry) => entry.regionTags,
        ),
        selectedConflictsMilestonesValues,
      ),
    [
      conflicts,
      fameScoreValues.conflicts,
      selectedRegions,
      selectedConflictsMilestonesValues,
    ],
  );
  const filteredMilestones = useMemo(
    () =>
      filterByMilestoneCategoryGroup(
        filterByRegion(
          filterByFameScore(milestones, fameScoreValues.milestones),
          selectedRegions,
          (milestone) => milestone.regionTags,
        ),
        selectedConflictsMilestonesValues,
      ),
    [
      milestones,
      fameScoreValues.milestones,
      selectedRegions,
      selectedConflictsMilestonesValues,
    ],
  );

  const results = useMemo<SearchResult[]>(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];

    const matched: SearchResult[] = [
      ...filteredPeople
        .filter((person) => matchesQuery(person, trimmed))
        .map((person) => ({
          id: person.id,
          entityType: 'person' as const,
          name: person.name,
          tagline: person.tagline,
          fameScore: person.fameScore,
        })),
      ...filteredConflicts
        .filter((entry) => matchesQuery(entry, trimmed))
        .map((entry) => ({
          id: entry.id,
          entityType: 'conflict' as const,
          name: entry.name,
          tagline: entry.tagline,
          fameScore: entry.fameScore,
        })),
      ...filteredMilestones
        .filter((milestone) => matchesQuery(milestone, trimmed))
        .map((milestone) => ({
          id: milestone.id,
          entityType: 'milestone' as const,
          name: milestone.name,
          tagline: milestone.tagline,
          fameScore: milestone.fameScore,
        })),
    ];

    return matched
      .sort((a, b) => b.fameScore - a.fameScore)
      .slice(0, MAX_RESULTS);
  }, [query, filteredPeople, filteredConflicts, filteredMilestones]);

  return { query, setQuery, results };
}
