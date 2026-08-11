import { test, expect } from 'vitest';
import { buildDrawerContent } from './build-drawer-content';
import type { Discovery, Person, War, WarEvent } from '../../../shared/types';

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
  reignPeriods: [
    { title: 'Emperor of the French', start: { year: 1804, month: 5 }, end: { year: 1814, month: 4 } },
    { title: 'Emperor of the French', start: { year: 1815, month: 3 }, end: { year: 1815, month: 6 } },
  ],
};

const livingPerson: Person = {
  ...napoleon,
  id: 'Q1',
  name: 'Someone Alive',
  lifespan: { start: { year: 1950 }, end: undefined },
  reignPeriods: undefined,
  image: undefined,
  imageAttribution: undefined,
};

const koreanWar: War = {
  id: 'Q8214',
  name: 'Korean War',
  period: { start: { year: 1950, month: 6 }, end: { year: 1953, month: 7 } },
  category: 'war',
  regionTags: ['east-asia'],
  fameScore: 350,
  tagline: 'war on the Korean peninsula',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Korean_War',
};

const battle: WarEvent = {
  id: 'Q46341',
  name: 'Battle of Gettysburg',
  at: { year: 1863, month: 7 },
  category: 'war',
  regionTags: ['americas'],
  fameScore: 250,
  tagline: 'major battle of the American Civil War',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Battle_of_Gettysburg',
};

const printingPress: Discovery = {
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

test('person: reignLines built one-per-period, "title: start – end", ordered as given', () => {
  const content = buildDrawerContent({ entityType: 'person', entity: napoleon });
  expect(content.reignLines).toEqual([
    'Emperor of the French: May 1804 – April 1814',
    'Emperor of the French: March 1815 – June 1815',
  ]);
});

test('person: reignLines is undefined when reignPeriods is absent', () => {
  const content = buildDrawerContent({ entityType: 'person', entity: livingPerson });
  expect(content.reignLines).toBeUndefined();
});

test('person: reignPeriod with no title falls back to "Reign"', () => {
  const content = buildDrawerContent({
    entityType: 'person',
    entity: { ...napoleon, reignPeriods: [{ start: { year: 1804 }, end: { year: 1814 } }] },
  });
  expect(content.reignLines).toEqual(['Reign: 1804 – 1814']);
});

test('person: reignPeriod with no end says "present"', () => {
  const content = buildDrawerContent({
    entityType: 'person',
    entity: { ...napoleon, reignPeriods: [{ title: 'King', start: { year: 1804 }, end: undefined }] },
  });
  expect(content.reignLines).toEqual(['King: 1804 – present']);
});

test('War: no dateLine (tagline already carries dates)', () => {
  const content = buildDrawerContent({ entityType: 'war', entity: koreanWar });
  expect(content.dateLine).toBeUndefined();
});

test('War: image/imageAttribution pass through when present', () => {
  const warWithImage: War = { ...koreanWar, image: 'https://example.com/x.jpg', imageAttribution: 'x' };
  const content = buildDrawerContent({ entityType: 'war', entity: warWithImage });
  expect(content.image).toBe('https://example.com/x.jpg');
  expect(content.imageAttribution).toBe('x');
});

test('War: image/imageAttribution are undefined when absent', () => {
  const content = buildDrawerContent({ entityType: 'war', entity: koreanWar });
  expect(content.image).toBeUndefined();
  expect(content.imageAttribution).toBeUndefined();
});

test('War: description passes through when present', () => {
  const warWithDescription: War = { ...koreanWar, description: 'A war fought on the Korean peninsula.' };
  const content = buildDrawerContent({ entityType: 'war', entity: warWithDescription });
  expect(content.description).toBe('A war fought on the Korean peninsula.');
});

test('War: description is undefined when absent (no Wikipedia article resolved)', () => {
  const content = buildDrawerContent({ entityType: 'war', entity: koreanWar });
  expect(content.description).toBeUndefined();
});

test('WarEvent: no dateLine (tagline already carries dates)', () => {
  const content = buildDrawerContent({ entityType: 'war', entity: battle });
  expect(content.dateLine).toBeUndefined();
});

test('WarEvent: never carries reignLines (not a Person)', () => {
  const content = buildDrawerContent({ entityType: 'war', entity: battle });
  expect(content.reignLines).toBeUndefined();
});

test('Discovery: dateLine is at.year only (year precision)', () => {
  const content = buildDrawerContent({ entityType: 'discovery', entity: printingPress });
  expect(content.dateLine).toBe('1440');
});

test('Discovery: image passes through, no reignLines', () => {
  const content = buildDrawerContent({ entityType: 'discovery', entity: printingPress });
  expect(content.image).toBe('https://commons.wikimedia.org/wiki/Special:FilePath/Printing_press.jpg');
  expect(content.reignLines).toBeUndefined();
});

test('Discovery: description passes through when present', () => {
  const withDescription: Discovery = {
    ...printingPress,
    description: 'A device for transferring text or images onto paper via ink.',
  };
  const content = buildDrawerContent({ entityType: 'discovery', entity: withDescription });
  expect(content.description).toBe('A device for transferring text or images onto paper via ink.');
});

test('Discovery: description is undefined when absent (no Wikipedia article resolved)', () => {
  const content = buildDrawerContent({ entityType: 'discovery', entity: printingPress });
  expect(content.description).toBeUndefined();
});
