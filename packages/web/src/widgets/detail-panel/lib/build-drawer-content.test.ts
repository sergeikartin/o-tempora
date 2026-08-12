import { test, expect } from 'vitest';
import { buildDrawerContent } from './build-drawer-content';
import type { Milestone, Person, Conflict, ConflictEvent } from '../../../shared/types';

const napoleon: Person = {
  id: '69880',
  name: 'Napoleon',
  lifespan: { start: { year: 1769, month: 8 }, end: { year: 1821, month: 5 } },
  occupationDomain: 'institutions',
  regionTags: ['western-europe'],
  fameScore: 100,
  tagline: 'French military commander and emperor',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Napoleon',
  image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Napoleon.jpg',
  imageAttribution: 'Jacques-Louis David, via Wikimedia Commons',
};

const koreanWar: Conflict = {
  id: 'Q8214',
  name: 'Korean War',
  period: { start: { year: 1950, month: 6 }, end: { year: 1953, month: 7 } },
  category: 'war',
  regionTags: ['east-asia'],
  fameScore: 350,
  tagline: 'war on the Korean peninsula',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Korean_War',
};

const battle: ConflictEvent = {
  id: 'Q46341',
  name: 'Battle of Gettysburg',
  at: { year: 1863, month: 7 },
  category: 'war',
  regionTags: ['americas'],
  fameScore: 250,
  tagline: 'major battle of the American Civil War',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Battle_of_Gettysburg',
};

const printingPress: Milestone = {
  id: 'Q11042',
  name: 'Printing press',
  at: { year: 1440 },
  category: 'communication',
  regionTags: ['europe'],
  fameScore: 386,
  tagline: 'device for applying pressure to transfer ink onto paper',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Printing_press',
  image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Printing_press.jpg',
};

test('person: name/tagline/image/imageAttribution pass through, no dateLine (tagline already carries dates)', () => {
  const content = buildDrawerContent({ entityType: 'person', entity: napoleon });
  expect(content.name).toBe('Napoleon');
  expect(content.dateLine).toBeUndefined();
  expect(content.tagline).toBe('French military commander and emperor');
  expect(content.wikipediaUrl).toBe('https://en.wikipedia.org/wiki/Napoleon');
  expect(content.image).toBe('https://commons.wikimedia.org/wiki/Special:FilePath/Napoleon.jpg');
  expect(content.imageAttribution).toBe('Jacques-Louis David, via Wikimedia Commons');
});

test('person: description passes through when present', () => {
  const withDescription: Person = {
    ...napoleon,
    description: 'Napoleon Bonaparte was a French military commander and political leader.',
  };
  const content = buildDrawerContent({ entityType: 'person', entity: withDescription });
  expect(content.description).toBe('Napoleon Bonaparte was a French military commander and political leader.');
});

test('person: description is undefined when absent (no Wikipedia article resolved)', () => {
  const content = buildDrawerContent({ entityType: 'person', entity: napoleon });
  expect(content.description).toBeUndefined();
});

test('Conflict: no dateLine (tagline already carries dates)', () => {
  const content = buildDrawerContent({ entityType: 'conflict', entity: koreanWar });
  expect(content.dateLine).toBeUndefined();
});

test('Conflict: image/imageAttribution pass through when present', () => {
  const conflictWithImage: Conflict = { ...koreanWar, image: 'https://example.com/x.jpg', imageAttribution: 'x' };
  const content = buildDrawerContent({ entityType: 'conflict', entity: conflictWithImage });
  expect(content.image).toBe('https://example.com/x.jpg');
  expect(content.imageAttribution).toBe('x');
});

test('Conflict: image/imageAttribution are undefined when absent', () => {
  const content = buildDrawerContent({ entityType: 'conflict', entity: koreanWar });
  expect(content.image).toBeUndefined();
  expect(content.imageAttribution).toBeUndefined();
});

test('Conflict: description passes through when present', () => {
  const conflictWithDescription: Conflict = { ...koreanWar, description: 'A war fought on the Korean peninsula.' };
  const content = buildDrawerContent({ entityType: 'conflict', entity: conflictWithDescription });
  expect(content.description).toBe('A war fought on the Korean peninsula.');
});

test('Conflict: description is undefined when absent (no Wikipedia article resolved)', () => {
  const content = buildDrawerContent({ entityType: 'conflict', entity: koreanWar });
  expect(content.description).toBeUndefined();
});

test('ConflictEvent: no dateLine (tagline already carries dates)', () => {
  const content = buildDrawerContent({ entityType: 'conflict', entity: battle });
  expect(content.dateLine).toBeUndefined();
});

test('Milestone: dateLine is at.year only (year precision)', () => {
  const content = buildDrawerContent({ entityType: 'milestone', entity: printingPress });
  expect(content.dateLine).toBe('1440');
});

const blackDeath: Milestone = {
  id: 'Q42005',
  name: 'Black Death',
  period: { start: { year: 1346 }, end: { year: 1353 } },
  category: 'medicine-health',
  regionTags: ['europe'],
  fameScore: 84,
  tagline: '1346-1353 pandemic in Eurasia and North Africa',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Black_Death',
};

test('Milestone: no dateLine for a period-shaped milestone (tagline already carries the range)', () => {
  const content = buildDrawerContent({ entityType: 'milestone', entity: blackDeath });
  expect(content.dateLine).toBeUndefined();
});

test('Milestone: image passes through', () => {
  const content = buildDrawerContent({ entityType: 'milestone', entity: printingPress });
  expect(content.image).toBe('https://commons.wikimedia.org/wiki/Special:FilePath/Printing_press.jpg');
});

test('Milestone: description passes through when present', () => {
  const withDescription: Milestone = {
    ...printingPress,
    description: 'A device for transferring text or images onto paper via ink.',
  };
  const content = buildDrawerContent({ entityType: 'milestone', entity: withDescription });
  expect(content.description).toBe('A device for transferring text or images onto paper via ink.');
});

test('Milestone: description is undefined when absent (no Wikipedia article resolved)', () => {
  const content = buildDrawerContent({ entityType: 'milestone', entity: printingPress });
  expect(content.description).toBeUndefined();
});
