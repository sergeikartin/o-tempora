import { cleanup, render } from '@testing-library/react';
import * as d3 from 'd3';
import { test, expect, afterEach } from 'vitest';
import { YearAxis } from './YearAxis';
import { AXIS_HEIGHT } from './options';

afterEach(cleanup);

function scaleFor(domainStart: number, domainEnd: number, width = 2000) {
  return d3.scaleLinear().domain([domainStart, domainEnd]).range([0, width]);
}

test('renders a major century-header row above the minor-tick row', () => {
  const { container } = render(<YearAxis xScale={scaleFor(1750, 1950)} />);

  expect(container.querySelector('g.d3-century-row')).toBeTruthy();
  expect(container.querySelector('g.d3-axis')).toBeTruthy();
});

test('the century header shows one label per century overlapping the domain, CE-styled as "N00s"', () => {
  const { container } = render(<YearAxis xScale={scaleFor(1750, 1950)} />);

  const labels = Array.from(container.querySelectorAll('.d3-century-label')).map((el) => el.textContent);
  expect(labels).toEqual(['1700s', '1800s', '1900s']);
});

test('the century header uses ordinal BCE phrasing and spans the BCE/CE boundary correctly', () => {
  const { container } = render(<YearAxis xScale={scaleFor(-150, 50)} />);

  const labels = Array.from(container.querySelectorAll('.d3-century-label')).map((el) => el.textContent);
  expect(labels).toEqual(['2nd century BCE', '1st century BCE', '1st century CE']);
});

test('minor ticks render BCE/CE-formatted labels, not plain signed integers', () => {
  const { container } = render(<YearAxis xScale={scaleFor(-150, 50)} />);

  const tickText = Array.from(container.querySelectorAll('g.d3-axis .tick text')).map((el) => el.textContent);
  expect(tickText.length).toBeGreaterThan(0);
  expect(tickText.every((text) => /\d (BCE|CE)$/.test(text ?? ''))).toBe(true);
});

test('the minor-tick row is positioned below the major header row', () => {
  const { container } = render(<YearAxis xScale={scaleFor(1750, 1950)} />);

  const minorGroup = container.querySelector('g.d3-axis');
  expect(minorGroup?.getAttribute('transform')).toContain('translate(0,');
  expect(minorGroup?.getAttribute('transform')).not.toBe('translate(0, 0)');
});

test('the svg height accommodates both rows', () => {
  const { container } = render(<YearAxis xScale={scaleFor(1750, 1950)} />);

  expect(container.querySelector('svg')?.getAttribute('height')).toBe(String(AXIS_HEIGHT));
});

function tickGapsPx(container: HTMLElement): number[] {
  const xs = Array.from(container.querySelectorAll('g.d3-axis .tick')).map((tick) => {
    const match = /translate\(([\d.]+)/.exec(tick.getAttribute('transform') ?? '');
    return Number(match?.[1]);
  });
  return xs.slice(1).map((x, i) => x - (xs[i] ?? 0));
}

// Ticket 04's "verified at a couple of representative pixelsPerYear values"
// step, captured as a real (deterministic — d3's tick algorithm has no
// randomness) regression test rather than only a code comment. Domain span
// (4776 years) is a fixed stand-in for PAN_MIN_DATE-to-today, so this test
// doesn't drift with the calendar. Representative points are the CORE/
// NOTABLE/EXHAUSTIVE band edges at a 1000px viewport.
test('minor-tick spacing at representative zoom levels oscillates around, not strictly within, the 60-80px target', () => {
  const totalYears = 4776;
  const width = 1000;
  const cases: [name: string, pixelsPerYear: number, expectedGapPx: number][] = [
    ['CORE, zoomed all the way out (500 visible years)', width / 500, 100],
    ['CORE/NOTABLE boundary (150 visible years)', width / 150, 66.66666666666666],
    ['NOTABLE/EXHAUSTIVE boundary (50 visible years)', width / 50, 100],
    ['EXHAUSTIVE, zoomed all the way in (10 visible years)', width / 10, 50],
  ];

  for (const [, pixelsPerYear, expectedGapPx] of cases) {
    const totalWidth = totalYears * pixelsPerYear;
    const scale = d3.scaleLinear().domain([0, totalYears]).range([0, totalWidth]);
    const { container, unmount } = render(<YearAxis xScale={scale} />);

    const gaps = tickGapsPx(container);
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.every((gap) => Math.abs(gap - (gaps[0] ?? 0)) < 0.01)).toBe(true); // linear scale: uniform gap
    expect(gaps[0]).toBeCloseTo(expectedGapPx);

    unmount();
  }
});
