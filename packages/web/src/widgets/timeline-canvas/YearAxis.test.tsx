import { cleanup, render } from '@testing-library/react';
import * as d3 from 'd3';
import { test, expect, afterEach } from 'vitest';
import { YearAxis } from './YearAxis';
import { AXIS_HEIGHT, MIN_DECADE_LABEL_SPACING_PX, RULER_HEIGHT } from './options';

afterEach(cleanup);

function scaleFor(domainStart: number, domainEnd: number, width = 2000) {
  return d3.scaleLinear().domain([domainStart, domainEnd]).range([0, width]);
}

function formatYearLike(year: number): string {
  return year <= 0 ? `${1 - year} BCE` : `${year}`;
}

test('the ruler bar renders as a single element (tick marks are CSS, not per-tick DOM nodes)', () => {
  const { container } = render(
    <YearAxis xScale={scaleFor(1000, 3000, 20000)} visibleStartYear={1750} visibleEndYear={1950} />,
  );

  expect(container.querySelectorAll('.year-axis-ruler')).toHaveLength(1);
});

test('the ruler bar exposes tick spacing as CSS custom properties, derived from pixels-per-year', () => {
  const { container } = render(
    <YearAxis xScale={scaleFor(0, 1000, 10000)} visibleStartYear={100} visibleEndYear={300} />,
  );

  const ruler = container.querySelector('.year-axis-ruler') as HTMLElement;
  // 10px/year here (10000px over a 1000-year domain).
  expect(ruler.style.getPropertyValue('--year-tick-px')).toBe('10px');
  expect(ruler.style.getPropertyValue('--decade-tick-px')).toBe('100px');
  expect(ruler.style.getPropertyValue('--century-tick-px')).toBe('1000px');
});

test('renders one label per decade within the visible range, none outside it', () => {
  const { container } = render(
    <YearAxis xScale={scaleFor(1000, 3000, 20000)} visibleStartYear={1750} visibleEndYear={1950} />,
  );

  const labels = Array.from(container.querySelectorAll('.year-axis-label')).map((el) => el.textContent);
  expect(labels).toHaveLength(21); // 1750, 1760, ..., 1950
  expect(labels[0]).toBe(formatYearLike(1750));
  expect(labels.at(-1)).toBe(formatYearLike(1950));
});

test('century labels (year % 100 === 0) get a distinguishing class; other decades do not', () => {
  const { container } = render(
    <YearAxis xScale={scaleFor(1000, 3000, 20000)} visibleStartYear={1750} visibleEndYear={1950} />,
  );

  const labelFor = (year: number) =>
    Array.from(container.querySelectorAll('.year-axis-label')).find((el) => el.textContent === formatYearLike(year));

  expect(labelFor(1800)?.classList.contains('year-axis-label-century')).toBe(true);
  expect(labelFor(1810)?.classList.contains('year-axis-label-century')).toBe(false);
});

test('labels render BCE-suffixed years for BCE, plain years for CE, not signed integers', () => {
  const { container } = render(
    <YearAxis xScale={scaleFor(-1000, 1000, 20000)} visibleStartYear={-150} visibleEndYear={50} />,
  );

  const labels = Array.from(container.querySelectorAll('.year-axis-label')).map((el) => el.textContent);
  expect(labels.length).toBeGreaterThan(0);
  expect(labels.every((text) => /^\d+( BCE)?$/.test(text ?? ''))).toBe(true);
  expect(labels.some((text) => text?.endsWith('BCE'))).toBe(true);
});

test('decade labels are omitted (century labels still render) once zoomed out past the readable spacing threshold', () => {
  // pixelsPerYear chosen so a decade spans less than MIN_DECADE_LABEL_SPACING_PX.
  const pixelsPerYear = (MIN_DECADE_LABEL_SPACING_PX - 1) / 10;
  const { container } = render(
    <YearAxis
      xScale={scaleFor(1000, 3000, 2000 * pixelsPerYear)}
      visibleStartYear={1750}
      visibleEndYear={1950}
    />,
  );

  const labels = Array.from(container.querySelectorAll('.year-axis-label')).map((el) => el.textContent);
  expect(labels).toContain(formatYearLike(1800)); // century — always shown
  expect(labels).not.toContain(formatYearLike(1810)); // decade — suppressed
});

test('labels stay visible at spacing above the threshold', () => {
  const pixelsPerYear = (MIN_DECADE_LABEL_SPACING_PX + 10) / 10;
  const { container } = render(
    <YearAxis
      xScale={scaleFor(1000, 3000, 2000 * pixelsPerYear)}
      visibleStartYear={1750}
      visibleEndYear={1950}
    />,
  );

  const labels = Array.from(container.querySelectorAll('.year-axis-label')).map((el) => el.textContent);
  expect(labels).toContain(formatYearLike(1810));
});

test('labels never render past the scale\'s own domain, even when visibleEndYear is buffered past it', () => {
  // TimelineCanvas buffers visibleEndYear past the viewport edge for smooth
  // tick pop-in (VIEWPORT_BUFFER_RATIO) — d3 scales extrapolate past their
  // domain by default, so near the timeline's real right edge that buffered
  // year can legitimately exceed the domain's max (e.g. today's year). A
  // label positioned past the domain max sits past the scrollable content's
  // real width, and since nothing clips horizontal overflow here, it
  // silently grows the ancestor scroll container's scrollWidth — letting a
  // user scroll past "today" into blank space.
  const { container } = render(
    <YearAxis xScale={scaleFor(1000, 2026, 20000)} visibleStartYear={1950} visibleEndYear={2040} />,
  );

  const labels = Array.from(container.querySelectorAll('.year-axis-label')).map((el) => el.textContent);
  expect(labels).not.toContain(formatYearLike(2030));
  expect(labels).not.toContain(formatYearLike(2040));
});

test('the axis height fits the ruler bar plus the label row', () => {
  const { container } = render(
    <YearAxis xScale={scaleFor(1000, 3000, 20000)} visibleStartYear={1750} visibleEndYear={1950} />,
  );

  expect((container.firstElementChild as HTMLElement).style.height).toBe(`${AXIS_HEIGHT}px`);
  expect((container.querySelector('.year-axis-ruler') as HTMLElement).style.height).toBe(`${RULER_HEIGHT}px`);
});
