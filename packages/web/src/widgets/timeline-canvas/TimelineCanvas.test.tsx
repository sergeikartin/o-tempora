import { cleanup, fireEvent, render } from '@testing-library/react';
import { test, expect, afterEach } from 'vitest';
import { TimelineCanvas } from './TimelineCanvas';
import type { Discovery, Person, WarsAndConflictsEntry } from '../../shared/types';

afterEach(cleanup);

const aristotle: Person = {
  id: 'Q868',
  name: 'Aristotle',
  lifespan: { start: { year: -383 }, end: { year: -321 } },
  occupationDomain: 'humanities',
  regionTags: [],
  fameScore: 317,
  description: '4th-century BCE Classical Greek philosopher and polymath',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Aristotle',
};

const fixturePeople: Person[] = [aristotle];

const fixtureWars: WarsAndConflictsEntry[] = [
  {
    id: 'Q8663',
    name: 'Korean War',
    period: { start: { year: 1950 }, end: { year: 1953 } },
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
    at: { year: 1863 },
    category: 'everyday-technology',
    regionTags: [],
    fameScore: 296,
    description: 'sport that is practiced between two teams of eleven players',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Association_football',
  },
];

const defaultFameScoreValues = { people: 90, wars: 100, discoveries: 200 };

test('renders all three lanes, each populated from its own dataset', () => {
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      wars={fixtureWars}
      discoveries={fixtureDiscoveries}
      fameScoreValues={defaultFameScoreValues}
    />,
  );

  // Both People's lifespans and Wars & Conflicts' ranges are Periods and
  // share the literal `.d3-line` marker class — two total (Aristotle + the
  // Korean War) — so this counts each lane's own <svg> (rendered in People,
  // Wars & Conflicts, Events & Inventions order) rather than the whole page.
  const svgs = Array.from(container.querySelectorAll('svg'));
  expect(svgs).toHaveLength(3);
  const [peopleSvg, warsSvg] = svgs as [SVGSVGElement, SVGSVGElement, SVGSVGElement];
  expect(peopleSvg.querySelectorAll('.d3-line')).toHaveLength(1); // Aristotle
  expect(warsSvg.querySelectorAll('.d3-line')).toHaveLength(1); // Korean War
  expect(container.querySelectorAll('.d3-dot')).toHaveLength(1); // association football
  expect(container.querySelector('.d3-name')?.textContent).toBe('Aristotle');
});

test('the three lane sections and the year axis share the same rendered width', () => {
  const { container } = render(
    <TimelineCanvas
      people={fixturePeople}
      wars={fixtureWars}
      discoveries={fixtureDiscoveries}
      fameScoreValues={defaultFameScoreValues}
    />,
  );

  const svgs = container.querySelectorAll('svg');
  expect(svgs).toHaveLength(3); // People, Wars & Conflicts, Events & Inventions — YearAxis is plain HTML/CSS, no svg
  const svgWidthsPx = Array.from(svgs).map((svg) => Number(svg.getAttribute('width')));
  const axisWidthPx = parseFloat(
    ((container.querySelector('.year-axis-ruler')?.parentElement as HTMLElement)?.style.width ?? '').replace('px', ''),
  );
  expect(new Set([...svgWidthsPx, axisWidthPx]).size).toBe(1);
});

function personLineWidth(container: HTMLElement): number {
  const [peopleSvg] = Array.from(container.querySelectorAll('svg')) as [SVGSVGElement];
  const line = peopleSvg.querySelector('.d3-line');
  return Number(line?.getAttribute('x2')) - Number(line?.getAttribute('x1'));
}

test('the zoom-in button widens rendered lines; zoom-out narrows them back', () => {
  const { container, getByLabelText } = render(
    <TimelineCanvas
      people={fixturePeople}
      wars={fixtureWars}
      discoveries={fixtureDiscoveries}
      fameScoreValues={defaultFameScoreValues}
    />,
  );

  const initialWidth = personLineWidth(container);

  fireEvent.click(getByLabelText('Zoom in'));
  const zoomedInWidth = personLineWidth(container);
  expect(zoomedInWidth).toBeGreaterThan(initialWidth);

  fireEvent.click(getByLabelText('Zoom out'));
  fireEvent.click(getByLabelText('Zoom out'));
  const zoomedOutWidth = personLineWidth(container);
  expect(zoomedOutWidth).toBeLessThan(zoomedInWidth);
});

test('zooming does not change which entities are rendered — density is gated by fameScoreValues, not pixelsPerYear', () => {
  const lowFamePerson: Person = {
    ...aristotle,
    id: 'Q-low-fame',
    name: 'Low Fame Person',
    fameScore: 76, // below the 90 people floor in defaultFameScoreValues
  };

  const { container, getByLabelText } = render(
    <TimelineCanvas
      people={[lowFamePerson]}
      wars={[]}
      discoveries={[]}
      fameScoreValues={defaultFameScoreValues}
    />,
  );

  expect(container.querySelectorAll('.d3-line')).toHaveLength(0);

  for (let i = 0; i < 5; i++) {
    fireEvent.click(getByLabelText('Zoom in'));
  }

  expect(container.querySelectorAll('.d3-line')).toHaveLength(0);
});

test('a person below fameScoreValues.people is excluded; raising it reveals them', () => {
  const lowFamePerson: Person = {
    ...aristotle,
    id: 'Q-low-fame',
    name: 'Low Fame Person',
    fameScore: 76,
  };

  const { container, rerender } = render(
    <TimelineCanvas
      people={[lowFamePerson]}
      wars={[]}
      discoveries={[]}
      fameScoreValues={defaultFameScoreValues}
    />,
  );
  expect(container.querySelectorAll('.d3-line')).toHaveLength(0);

  rerender(
    <TimelineCanvas
      people={[lowFamePerson]}
      wars={[]}
      discoveries={[]}
      fameScoreValues={{ ...defaultFameScoreValues, people: 75 }}
    />,
  );
  expect(container.querySelectorAll('.d3-line')).toHaveLength(1);
});
