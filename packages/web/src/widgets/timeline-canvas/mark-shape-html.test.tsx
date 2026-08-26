import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import type { Conflict, ConflictEvent, Person } from '../../shared/types';
import { ConflictsMilestonesLane } from './ConflictsMilestonesLane';
import cmStyles from './ConflictsMilestonesLane.module.css';
import {
  buildPersonLayout,
  buildRangeAndPointLayout,
  computeRowAssignment,
} from './map-to-items';
import {
  renderPeopleMarkupHtml,
  renderPointsMarkupHtml,
  renderRangesMarkupHtml,
} from './mark-shape-html';
import { buildXScale } from './options';
import { PeopleLane } from './PeopleLane';
import peopleStyles from './PeopleLane.module.css';

afterEach(cleanup);

// fameScore is irrelevant here — renderPeopleMarkupHtml/renderRangesMarkupHtml/
// renderPointsMarkupHtml take an already-filtered layout, unlike
// PeopleLane's/ConflictsMilestonesLane's own callers (TimelineCanvas), which
// filter before passing `people`/`conflicts`/`milestones` down.
const aristotle: Person = {
  id: 'Q868',
  name: 'Aristotle',
  lifespan: { start: { year: -383 }, end: { year: -321 } },
  occupationDomain: 'humanities',
  regionTags: [],
  fameScore: 317,
  tagline: '4th-century BCE Classical Greek philosopher and polymath',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Aristotle',
};

const koreanWar: Conflict = {
  id: 'Q8214',
  name: 'Korean War',
  period: { start: { year: 1950 }, end: { year: 1953 } },
  category: 'war',
  regionTags: ['eastern-asia'],
  fameScore: 350,
  tagline: 'war on the Korean peninsula',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Korean_War',
};

const battleOfMegiddo: ConflictEvent = {
  id: 'Q217799',
  name: 'Battle of Megiddo',
  at: { year: -1457 },
  category: 'war',
  regionTags: ['western-asia'],
  fameScore: 120,
  tagline: 'ancient battle',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Battle_of_Megiddo',
};

function parseFragment(html: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = html;
  return container;
}

// Compares shape only — tag, literal marker classes, and which attrs are set
// — never CSS-Module hashed classes (a fresh jsdom render can legitimately
// hash differently) or `style` (opacity/transition-only, irrelevant to a
// mark's static shape). Recurses into children so a wrapped label's
// `<g class="d3-name-zoom">` counts too.
function markShape(el: Element): unknown {
  return {
    tag: el.tagName.toLowerCase(),
    classes: Array.from(el.classList)
      .filter((c) => !c.startsWith('_'))
      .sort(),
    attrs: Array.from(el.attributes)
      .map((a) => a.name)
      .filter((name) => name !== 'style' && name !== 'class')
      .sort(),
    children: Array.from(el.children).map(markShape),
  };
}

test('renderPeopleMarkupHtml/renderRangesMarkupHtml/renderPointsMarkupHtml contain real content, not an empty shell', () => {
  const { scale } = buildXScale(2);
  const { personRowFor, eventsRowFor } = computeRowAssignment(
    [aristotle],
    [koreanWar],
    [],
  );
  const personLayout = buildPersonLayout([aristotle], scale, personRowFor);
  const { rangeLayout } = buildRangeAndPointLayout(
    [koreanWar],
    [],
    scale,
    eventsRowFor,
  );

  expect(renderPeopleMarkupHtml(personLayout, peopleStyles)).toContain(
    'Aristotle',
  );
  expect(renderRangesMarkupHtml(rangeLayout, cmStyles)).toContain('Korean War');
});

describe('structural equivalence with the live D3 join (same shared MarkShape descriptor)', () => {
  test('a person mark matches PeopleLane', () => {
    const people = [aristotle];
    const { scale } = buildXScale(2);
    const { personRowFor } = computeRowAssignment(people, [], []);
    const layout = buildPersonLayout(people, scale, personRowFor);

    const templated = parseFragment(
      renderPeopleMarkupHtml(layout, peopleStyles),
    ).querySelector('.d3-person');
    expect(templated).toBeTruthy();

    const { container } = render(
      <PeopleLane people={people} xScale={scale} personRowFor={personRowFor} />,
    );
    const live = container.querySelector('.d3-person');
    expect(live).toBeTruthy();

    expect(markShape(templated as Element)).toEqual(markShape(live as Element));
    expect(templated?.querySelector('.d3-name')?.textContent).toBe(
      live?.querySelector('.d3-name')?.textContent,
    );
  });

  test('a range mark (a Conflict period) matches ConflictsMilestonesLane', () => {
    const conflicts = [koreanWar];
    const { scale } = buildXScale(2);
    const { eventsRowFor } = computeRowAssignment([], conflicts, []);
    const { rangeLayout } = buildRangeAndPointLayout(
      conflicts,
      [],
      scale,
      eventsRowFor,
    );

    const templated = parseFragment(
      renderRangesMarkupHtml(rangeLayout, cmStyles),
    ).querySelector('.d3-range');
    expect(templated).toBeTruthy();

    const { container } = render(
      <ConflictsMilestonesLane
        conflicts={conflicts}
        milestones={[]}
        xScale={scale}
        eventsRowFor={eventsRowFor}
      />,
    );
    const live = container.querySelector('.d3-range');
    expect(live).toBeTruthy();

    expect(markShape(templated as Element)).toEqual(markShape(live as Element));
    expect(templated?.querySelector('.d3-range-name')?.textContent).toBe(
      live?.querySelector('.d3-range-name')?.textContent,
    );
  });

  test('a point mark (a ConflictEvent) matches ConflictsMilestonesLane', () => {
    const conflicts = [battleOfMegiddo];
    const { scale } = buildXScale(2);
    const { eventsRowFor } = computeRowAssignment([], conflicts, []);
    const { pointLayout } = buildRangeAndPointLayout(
      conflicts,
      [],
      scale,
      eventsRowFor,
    );

    const templated = parseFragment(
      renderPointsMarkupHtml(pointLayout, cmStyles),
    ).querySelector('.d3-point-group');
    expect(templated).toBeTruthy();

    const { container } = render(
      <ConflictsMilestonesLane
        conflicts={conflicts}
        milestones={[]}
        xScale={scale}
        eventsRowFor={eventsRowFor}
      />,
    );
    const live = container.querySelector('.d3-point-group');
    expect(live).toBeTruthy();

    expect(markShape(templated as Element)).toEqual(markShape(live as Element));
    expect(templated?.querySelector('.d3-point-name')?.textContent).toBe(
      live?.querySelector('.d3-point-name')?.textContent,
    );
  });
});
