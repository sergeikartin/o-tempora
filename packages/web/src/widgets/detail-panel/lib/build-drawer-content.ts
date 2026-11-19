import {
  CONFLICT_COLOR,
  DOMAIN_COLORS,
  MILESTONE_CATEGORY_GROUP_COLORS,
} from '../../../shared/config';
import {
  formatYearMonth,
  formatYearMonthRange,
} from '../../../shared/lib/date';
import {
  type ConflictEntry,
  MILESTONE_CATEGORY_TO_GROUP,
  type Milestone,
  type Person,
} from '../../../shared/types';

export type DetailPanelEntity =
  | { entityType: 'person'; entity: Person }
  | { entityType: 'conflict'; entity: ConflictEntry }
  | { entityType: 'milestone'; entity: Milestone };

export interface DrawerContent {
  name: string;
  // Point milestones always show a date. Estimated conflict and period dates
  // also need a structured label because taglines can omit the qualifier.
  dateLine?: string;
  tagline: string;
  // Wikipedia lead-paragraph prose — absent whenever no English Wikipedia
  // article resolved for this entity. Independent of tagline, never a
  // fallback for it; the panel renders the tagline subtitle alone when
  // this is absent, no empty/placeholder body section.
  description?: string;
  wikipediaUrl: string;
  image?: string;
  imageAttribution?: string;
}

function personContent(person: Person): DrawerContent {
  return {
    name: person.name,
    tagline: person.tagline,
    description: person.description,
    wikipediaUrl: person.wikipediaUrl,
    image: person.image,
    imageAttribution: person.imageAttribution,
  };
}

function approximateDateLine(
  entry: ConflictEntry | Milestone,
): string | undefined {
  if ('at' in entry)
    return entry.at.approximate ? formatYearMonth(entry.at) : undefined;
  const { start, end } = entry.period;
  if (!start.approximate && !end?.approximate) return undefined;
  return end ? formatYearMonthRange(start, end) : formatYearMonth(start);
}

function conflictEntryContent(entry: ConflictEntry): DrawerContent {
  return {
    name: entry.name,
    dateLine: approximateDateLine(entry),
    tagline: entry.tagline,
    description: entry.description,
    wikipediaUrl: entry.wikipediaUrl,
    image: entry.image,
    imageAttribution: entry.imageAttribution,
  };
}

function milestoneContent(milestone: Milestone): DrawerContent {
  return {
    name: milestone.name,
    dateLine:
      'period' in milestone
        ? approximateDateLine(milestone)
        : formatYearMonth({
            ...milestone.at,
            approximate: milestone.at.approximate ?? milestone.approximateDate,
          }),
    tagline: milestone.tagline,
    description: milestone.description,
    wikipediaUrl: milestone.wikipediaUrl,
    image: milestone.image,
    imageAttribution: milestone.imageAttribution,
  };
}

export function buildDrawerContent(selected: DetailPanelEntity): DrawerContent {
  switch (selected.entityType) {
    case 'person':
      return personContent(selected.entity);
    case 'conflict':
      return conflictEntryContent(selected.entity);
    case 'milestone':
      return milestoneContent(selected.entity);
  }
}

export function laneColor(selected: DetailPanelEntity): string {
  switch (selected.entityType) {
    case 'person':
      return DOMAIN_COLORS[selected.entity.occupationDomain];
    case 'conflict':
      return CONFLICT_COLOR;
    case 'milestone':
      return MILESTONE_CATEGORY_GROUP_COLORS[
        MILESTONE_CATEGORY_TO_GROUP[selected.entity.category]
      ];
  }
}
