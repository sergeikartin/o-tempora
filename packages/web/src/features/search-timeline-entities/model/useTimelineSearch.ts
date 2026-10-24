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

// A plain structural copy of features/filter-by-fame-score's FameScoreValues
// — not imported directly, since FSD forbids one feature importing another
// at the same layer. TypeScript's structural typing means App.tsx's real
// FameScoreValues still satisfies this without a cast.
interface FameScoreValues {
  people: number;
  conflicts: number;
  milestones: number;
}

// Capped at this many results in total across all lanes (not per lane),
// ranked by Fame Score (CONTEXT.md's Search).
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

// Session-only search query state (no persistence, same shape as every
// other filter hook here) — owned by this feature since it's shared by
// widgets/top-bar (the input/dropdown) and app/ (which resolves a picked
// result into a pan + selection, mirroring features/select-timeline-entity's
// "feature owns cross-widget state" comment).
//
// Uses the same visible* pipelines as TimelineCanvas (shared/lib/entity/), so a result never surfaces an entity
// the current Detail Level, Region, Occupation Domain or Conflicts &
// Milestones filters hide from the canvas (CONTEXT.md's Search;
// web/docs/adr/0010-search-stays-inside-active-filters-and-payload-tiers.md).
// `people`/`conflicts`/`milestones` are the merged arrays passed to
// TimelineCanvas, so results reflect whichever deeper delta files have
// loaded; no load is triggered here.
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
