import { cleanup, fireEvent, render } from '@testing-library/react';
import { test, expect, afterEach } from 'vitest';
import { TimelineCanvas } from './TimelineCanvas';
import type { Discovery, Person, War } from '../../shared/types';

afterEach(cleanup);

const fixturePeople: Person[] = [
  {
    id: 'Q868',
    name: 'Aristotle',
    startYear: -383,
    endYear: -321,
    occupationDomain: 'humanities',
    regionTags: [],
    fameScore: 317,
    description: '4th-century BCE Classical Greek philosopher and polymath',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Aristotle',
  },
];

const fixtureWars: War[] = [
  {
    id: 'Q8663',
    name: 'Korean War',
    startYear: 1950,
    endYear: 1953,
    category: 'war',
    regionTags: ['east-asia'],
    fameScore: 143,
    description: 'war between North and South Korea, 1950–1953',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Korean_War',
  },
];

const fixtureDiscoveries: Discovery[] = [
  {
    id: 'Q2736',
    name: 'association football',
    startYear: 1863,
    category: 'invention',
    regionTags: [],
    fameScore: 296,
    description: 'sport that is practiced between two teams of eleven players',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Association_football',
  },
];

test('renders all three lanes, each populated from its own dataset', () => {
  const { container } = render(
    <TimelineCanvas people={fixturePeople} wars={fixtureWars} discoveries={fixtureDiscoveries} />,
  );

  expect(container.querySelectorAll('.d3-bar')).toHaveLength(2); // Aristotle + Korean War
  expect(container.querySelectorAll('.d3-dot')).toHaveLength(1); // association football
  expect(container.querySelector('.d3-name')?.textContent).toBe('Aristotle');
});

test('the three lane sections share the same rendered width — one shared time axis', () => {
  const { container } = render(
    <TimelineCanvas people={fixturePeople} wars={fixtureWars} discoveries={fixtureDiscoveries} />,
  );

  const svgs = container.querySelectorAll('svg');
  expect(svgs).toHaveLength(3);
  const widths = Array.from(svgs).map((svg) => svg.getAttribute('width'));
  expect(new Set(widths).size).toBe(1);
});

test('the zoom-in button widens rendered bars; zoom-out narrows them back', () => {
  const { container, getByLabelText } = render(
    <TimelineCanvas people={fixturePeople} wars={fixtureWars} discoveries={fixtureDiscoveries} />,
  );

  const initialWidth = Number(container.querySelector('.d3-bar')?.getAttribute('width'));

  fireEvent.click(getByLabelText('Zoom in'));
  const zoomedInWidth = Number(container.querySelector('.d3-bar')?.getAttribute('width'));
  expect(zoomedInWidth).toBeGreaterThan(initialWidth);

  fireEvent.click(getByLabelText('Zoom out'));
  fireEvent.click(getByLabelText('Zoom out'));
  const zoomedOutWidth = Number(container.querySelector('.d3-bar')?.getAttribute('width'));
  expect(zoomedOutWidth).toBeLessThan(zoomedInWidth);
});
