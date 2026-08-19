import { formatYearMonth } from '../../../shared/lib/format-year';
import type { ConflictEntry, Milestone, Person } from '../../../shared/types';

// Discriminates which of the three lane shapes a click resolved to — the
// same union App.tsx builds after looking a SelectedEntityRef id up in its
// in-memory dataset (dynamic-tooltips spec §2, "on-demand rendering": the
// drawer looks up the full entity by id only at click time, nothing
// precomputed).
export type DetailPanelEntity =
  | { entityType: 'person'; entity: Person }
  | { entityType: 'conflict'; entity: ConflictEntry }
  | { entityType: 'milestone'; entity: Milestone };

// Every field the drawer chrome (ui/DetailPanel.tsx) needs to render,
// regardless of entity type — spec §3's "all four entity shapes render into
// the same drawer chrome" table. Which optional fields end up populated
// depends on entityType (see buildDrawerContent below), not on the caller.
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
      : { dateLine: formatYearMonth(milestone.at) }),
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
