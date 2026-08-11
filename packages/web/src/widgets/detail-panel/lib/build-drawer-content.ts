import type { Discovery, Person, WarsAndConflictsEntry } from '../../../shared/types';
import { formatYearMonth } from '../../../shared/lib/format-year';

// Discriminates which of the three lane shapes a click resolved to — the
// same union App.tsx builds after looking a SelectedEntityRef id up in its
// in-memory dataset (dynamic-tooltips spec §2, "on-demand rendering": the
// drawer looks up the full entity by id only at click time, nothing
// precomputed).
export type DetailPanelEntity =
  | { entityType: 'person'; entity: Person }
  | { entityType: 'war'; entity: WarsAndConflictsEntry }
  | { entityType: 'discovery'; entity: Discovery };

// Every field the drawer chrome (ui/DetailPanel.tsx) needs to render,
// regardless of entity type — spec §3's "all four entity shapes render into
// the same drawer chrome" table. Which optional fields end up populated
// depends on entityType (see buildDrawerContent below), not on the caller.
export interface DrawerContent {
  name: string;
  dateLine: string;
  tagline: string;
  // Wikipedia lead-paragraph prose — absent whenever no English Wikipedia
  // article resolved for this entity. Independent of tagline, never a
  // fallback for it; the panel renders the tagline subtitle alone when
  // this is absent, no empty/placeholder body section.
  description?: string;
  wikipediaUrl: string;
  image?: string;
  imageAttribution?: string;
  // Person only.
  reignLines?: string[];
}

function rangeDateLine(start: { year: number; month?: number }, end: { year: number; month?: number } | undefined): string {
  return `${formatYearMonth(start)} – ${end ? formatYearMonth(end) : 'present'}`;
}

function personContent(person: Person): DrawerContent {
  return {
    name: person.name,
    dateLine: rangeDateLine(person.lifespan.start, person.lifespan.end),
    tagline: person.tagline,
    description: person.description,
    wikipediaUrl: person.wikipediaUrl,
    image: person.image,
    imageAttribution: person.imageAttribution,
    reignLines: person.reignPeriods?.map((reign) => {
      const title = reign.title ?? 'Reign';
      return `${title}: ${rangeDateLine(reign.start, reign.end)}`;
    }),
  };
}

function warEntryContent(entry: WarsAndConflictsEntry): DrawerContent {
  const isWar = 'period' in entry;
  const dateLine = isWar ? rangeDateLine(entry.period.start, entry.period.end) : formatYearMonth(entry.at);

  return {
    name: entry.name,
    dateLine,
    tagline: entry.tagline,
    description: entry.description,
    wikipediaUrl: entry.wikipediaUrl,
    image: entry.image,
    imageAttribution: entry.imageAttribution,
  };
}

function discoveryContent(discovery: Discovery): DrawerContent {
  return {
    name: discovery.name,
    dateLine: formatYearMonth(discovery.at),
    tagline: discovery.tagline,
    description: discovery.description,
    wikipediaUrl: discovery.wikipediaUrl,
    image: discovery.image,
    imageAttribution: discovery.imageAttribution,
  };
}

export function buildDrawerContent(selected: DetailPanelEntity): DrawerContent {
  switch (selected.entityType) {
    case 'person':
      return personContent(selected.entity);
    case 'war':
      return warEntryContent(selected.entity);
    case 'discovery':
      return discoveryContent(selected.entity);
  }
}
