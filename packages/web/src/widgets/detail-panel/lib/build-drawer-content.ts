import {
  CONFLICT_COLOR,
  DOMAIN_COLORS,
  MILESTONE_CATEGORY_GROUP_COLORS,
} from '../../../shared/config';
import {
  formatYearMonth,
  formatYearMonthRange,
  formatYearMonthShort,
} from '../../../shared/lib/date';
import { entitySpan } from '../../../shared/lib/entity';
import { m } from '../../../shared/paraglide/messages.js';
import {
  type ConflictEntry,
  MILESTONE_CATEGORY_TO_GROUP,
  type Milestone,
  type Person,
} from '../../../shared/types';
import type { ResolvedConnection } from './profile';

// Which of the three lane shapes a click resolved to: the union App.tsx builds
// after looking a SelectedEntityRef id up in its in-memory dataset at click
// time (nothing is precomputed).
export type DetailPanelEntity =
  | { entityType: 'person'; entity: Person }
  | { entityType: 'conflict'; entity: ConflictEntry }
  | { entityType: 'milestone'; entity: Milestone };

// Every field the panel chrome (ui/DetailPanel.tsx) renders, whatever the
// entity type. Which optional fields are populated depends on entityType (see
// buildDrawerContent below), not on the caller.
export interface DrawerContent {
  name: string;
  // Point-shaped Milestone only — People, Conflicts, and period-shaped
  // Milestones all drop this: their tagline text (Wikidata
  // schema:description) already embeds the same dates in prose form (e.g.
  // the Black Death's "1346-1353 pandemic..."), so a separate structured
  // date line was showing every date twice. A point-shaped Milestone's
  // tagline doesn't reliably embed a date, so it keeps this line.
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

function conflictEntryContent(entry: ConflictEntry): DrawerContent {
  return {
    name: entry.name,
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
    ...('period' in milestone
      ? {}
      : {
          dateLine: `${milestone.approximateDate ? 'ca. ' : ''}${formatYearMonth(milestone.at)}`,
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

// One Selection member in the panel's short list form: a thumbnail but no
// description, just enough to tell the members apart and read their dates.
export interface MemberSummary {
  id: string;
  name: string;
  // Lane color, so the list reads against the marks it names.
  color: string;
  dates: string;
  tagline: string;
  wikipediaUrl: string;
  image?: string;
  imageAttribution?: string;
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

// A Profile Connection's target as one list row; the caller decides where the
// target sits against the current Detail Level.
export function buildConnection(
  target: DetailPanelEntity,
  slug: string,
  reason: string,
  level: { levelIndex: number; isShown: boolean },
): ResolvedConnection {
  const { name, color, dates } = buildMemberSummary(target);
  return { slug, name, color, dates, reason, ...level };
}

export function buildMemberSummary(selected: DetailPanelEntity): MemberSummary {
  const { entity } = selected;
  const span = entitySpan(entity);
  const approximate =
    'approximateDate' in entity && entity.approximateDate ? 'ca. ' : '';
  const dates = span.isOngoing
    ? `${formatYearMonthShort(span.start)} – ${m.datesPresent()}`
    : `${approximate}${formatYearMonthRange(span.start, span.end)}`;
  return {
    id: entity.id,
    name: entity.name,
    color: laneColor(selected),
    dates,
    tagline: entity.tagline,
    wikipediaUrl: entity.wikipediaUrl,
    image: entity.image,
    imageAttribution: entity.imageAttribution,
  };
}
