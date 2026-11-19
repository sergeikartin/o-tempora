import { useMemo, useState } from 'react';
import type { ConflictsMilestonesFilterValue } from '../../../shared/config';
import {
  type EntityType,
  visibleConflicts,
  visibleMilestones,
  visiblePeople,
} from '../../../shared/lib/entity';
import type {
  ConflictEntry,
  Milestone,
  OccupationDomain,
  Person,
  Region,
} from '../../../shared/types';

// Structural match for FameScoreValues because FSD forbids same-layer feature imports.
interface FameScoreValues {
  people: number;
  conflicts: number;
  milestones: number;
}

const MAX_RESULTS = 8;

export interface SearchResult {
  id: string;
  slug: string;
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

// Use the same filters as the canvas so Search cannot surface a hidden mark.
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

  const filters = useMemo(
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

  const results = useMemo<SearchResult[]>(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];

    const matched: SearchResult[] = [
      ...filteredPeople
        .filter((person) => matchesQuery(person, trimmed))
        .map((person) => ({
          id: person.id,
          slug: person.slug,
          entityType: 'person' as const,
          name: person.name,
          tagline: person.tagline,
          fameScore: person.fameScore,
        })),
      ...filteredConflicts
        .filter((entry) => matchesQuery(entry, trimmed))
        .map((entry) => ({
          id: entry.id,
          slug: entry.slug,
          entityType: 'conflict' as const,
          name: entry.name,
          tagline: entry.tagline,
          fameScore: entry.fameScore,
        })),
      ...filteredMilestones
        .filter((milestone) => matchesQuery(milestone, trimmed))
        .map((milestone) => ({
          id: milestone.id,
          slug: milestone.slug,
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
