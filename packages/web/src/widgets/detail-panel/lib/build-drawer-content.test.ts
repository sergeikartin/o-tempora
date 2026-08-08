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
  description: 'French military commander and emperor',
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
  description: 'war on the Korean peninsula',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Korean_War',
};

const ongoingWar: War = { ...koreanWar, id: 'Q2', name: 'Ongoing War', period: { start: { year: 2022 }, end: undefined } };

const battle: WarEvent = {
  id: 'Q46341',
  name: 'Battle of Gettysburg',
  at: { year: 1863, month: 7 },
  category: 'war',
  regionTags: ['americas'],
  fameScore: 250,
  description: 'major battle of the American Civil War',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Battle_of_Gettysburg',
};

const printingPress: Discovery = {
  id: 'Q11042',
  name: 'Printing press',
  at: { year: 1440 },
  category: 'communication',
  regionTags: ['europe'],
  fameScore: 386,
  description: 'device for applying pressure to transfer ink onto paper',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Printing_press',
  image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Printing_press.jpg',
};

test('person: dateLine spans birth-death month/year, image/imageAttribution pass through', () => {
  const content = buildDrawerContent({ entityType: 'person', entity: napoleon });
  expect(content.name).toBe('Napoleon');
  expect(content.dateLine).toBe('August 1769 – May 1821');
  expect(content.description).toBe('French military commander and emperor');
  expect(content.wikipediaUrl).toBe('https://en.wikipedia.org/wiki/Napoleon');
  expect(content.image).toBe('https://commons.wikimedia.org/wiki/Special:FilePath/Napoleon.jpg');
  expect(content.imageAttribution).toBe('Jacques-Louis David, via Wikimedia Commons');
});

test('person: dateLine says "present" for a living person (no lifespan.end)', () => {
  const content = buildDrawerContent({ entityType: 'person', entity: livingPerson });
  expect(content.dateLine).toBe('1950 – present');
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

test('War: dateLine spans period.start – period.end', () => {
  const content = buildDrawerContent({ entityType: 'war', entity: koreanWar });
  expect(content.dateLine).toBe('June 1950 – July 1953');
});

test('War: dateLine says "present" for an ongoing war (no period.end)', () => {
  const content = buildDrawerContent({ entityType: 'war', entity: ongoingWar });
  expect(content.dateLine).toBe('2022 – present');
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

test('WarEvent: dateLine is a single point (at), not a range', () => {
  const content = buildDrawerContent({ entityType: 'war', entity: battle });
  expect(content.dateLine).toBe('July 1863');
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
