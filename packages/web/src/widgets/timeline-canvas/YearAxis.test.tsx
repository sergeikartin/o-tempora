import { cleanup, render } from '@testing-library/react';
import * as d3 from 'd3';
import { test, expect, afterEach } from 'vitest';
import { YearAxis } from './YearAxis';
import { AXIS_HEIGHT, MIN_DECADE_LABEL_SPACING_PX, RULER_HEIGHT } from './options';
import { PAN_MIN_DATE } from '../../shared/config';

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

test('BCE decade/century labels are round historical numbers, not round astronomical ones', () => {
  // Astronomical multiples of 100/10 (-100, -200, -10, -20) would mislabel
  // as "101 BCE"/"201 BCE"/"11 BCE"/"21 BCE" — the true round-historical
  // ticks sit at -99/-199 (100/200 BCE) and -9/-19 (10/20 BCE) instead.
  const { container } = render(
    <YearAxis xScale={scaleFor(-1000, 1000, 20000)} visibleStartYear={-250} visibleEndYear={50} />,
  );

  const labels = Array.from(container.querySelectorAll('.year-axis-label')).map((el) => el.textContent);
  expect(labels).toContain('100 BCE');
  expect(labels).toContain('200 BCE');
  expect(labels).toContain('10 BCE');
  expect(labels).toContain('20 BCE');
  expect(labels).not.toContain('101 BCE');
  expect(labels).not.toContain('201 BCE');
  expect(labels).not.toContain('11 BCE');
  expect(labels).not.toContain('21 BCE');
});

test('the "1 BCE" era-boundary label renders (at astronomical year 0) and is treated as a century-tier label', () => {
  const { container } = render(
    <YearAxis xScale={scaleFor(-1000, 1000, 20000)} visibleStartYear={-50} visibleEndYear={50} />,
  );

  const labelFor = (text: string) =>
    Array.from(container.querySelectorAll('.year-axis-label')).find((el) => el.textContent === text);

  expect(labelFor('1 BCE')).toBeDefined();
  expect(labelFor('1 BCE')?.classList.contains('year-axis-label-century')).toBe(true);
  // No separate "1" (1 CE) tick — "1 BCE" is the sole, shared boundary tick.
  expect(labelFor('1')).toBeUndefined();
});

test('a BCE century label (e.g. "100 BCE") gets the century-tier distinguishing class', () => {
  const { container } = render(
    <YearAxis xScale={scaleFor(-1000, 1000, 20000)} visibleStartYear={-150} visibleEndYear={50} />,
  );

  const labelFor = (text: string) =>
    Array.from(container.querySelectorAll('.year-axis-label')).find((el) => el.textContent === text);

  expect(labelFor('100 BCE')?.classList.contains('year-axis-label-century')).toBe(true);
  expect(labelFor('20 BCE')?.classList.contains('year-axis-label-century')).toBe(false);
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

test('a domain spanning the BCE/CE boundary renders two independently-phased ruler regions', () => {
  const { container } = render(
    <YearAxis xScale={scaleFor(-1000, 1000, 20000)} visibleStartYear={-150} visibleEndYear={50} />,
  );

  const bceRuler = container.querySelector('.year-axis-ruler-bce') as HTMLElement;
  const ceRuler = container.querySelector('.year-axis-ruler') as HTMLElement;
  expect(bceRuler).toBeTruthy();
  expect(ceRuler).toBeTruthy();
  // Widths sum to the full scrollable width, split exactly at year 0.
  expect(parseFloat(bceRuler.style.width) + parseFloat(ceRuler.style.width)).toBeCloseTo(20000);
  // The two halves use different tick phases (BCE ticks land on round
  // historical numbers like "10 BCE", not round astronomical ones).
  expect(bceRuler.style.getPropertyValue('--decade-tick-offset-px')).not.toBe(
    ceRuler.style.getPropertyValue('--decade-tick-offset-px'),
  );
});

test('a BCE decade label sits exactly on the BCE ruler region\'s own tick grid (the bug from the reference screenshot)', () => {
  // Regression: before splitting the ruler into two phases, a BCE label
  // (e.g. "10 BCE", at astronomical year -9) rendered one year's
  // pixel-width away from its nearest CSS gridline tick, which was still
  // phased on the old multiples-of-10 grid (a tick at -10, not -9). Both
  // the label's x and the BCE ruler's own box share the same origin (the
  // domain's start year, at pixel 0), so this compares them directly. The
  // BCE ruler's CSS tile phase is computed from the real app's MIN_YEAR
  // (options.ts), so this synthetic domain's start must share MIN_YEAR's
  // residue mod 10/100 for the two to line up — shifting by 1000 (itself
  // a multiple of both) keeps that residue while staying a self-contained
  // synthetic domain, so this doesn't need updating whenever PAN_MIN_DATE
  // does.
  const domainStart = PAN_MIN_DATE.year - 1000;
  const { container } = render(
    <YearAxis xScale={scaleFor(domainStart, domainStart + 2000, 20000)} visibleStartYear={-150} visibleEndYear={50} />,
  );

  const label = Array.from(container.querySelectorAll('.year-axis-label')).find(
    (el) => el.textContent === '10 BCE',
  ) as HTMLElement;
  const bceRuler = container.querySelector('.year-axis-ruler-bce') as HTMLElement;
  const decadeOffsetPx = parseFloat(bceRuler.style.getPropertyValue('--decade-tick-offset-px'));
  const decadeSpacingPx = parseFloat(bceRuler.style.getPropertyValue('--decade-tick-px'));

  const labelX = parseFloat(label.style.left);
  const distanceFromNearestTick = ((labelX - decadeOffsetPx) % decadeSpacingPx + decadeSpacingPx) % decadeSpacingPx;
  expect(distanceFromNearestTick).toBeCloseTo(0, 5);
});

test('a CE decade label sits exactly on the CE ruler region\'s own tick grid', () => {
  // Regression: the CE ruler's own local origin (x=0) is astronomical year
  // 0, not MIN_YEAR — its tick-grid phase must be computed relative to that,
  // not to MIN_YEAR (options.ts's phaseOffsetYears), or every CE tick lands
  // one year off from its round-number label (e.g. a "1900" label centered
  // over the tick actually drawn at year 1901). The domain must span year 0
  // (unlike most of this file's fixtures) so the CE ruler's own box doesn't
  // start exactly at a round-number year by coincidence of the synthetic
  // domain — the label's x (xScale-absolute) needs translating into the CE
  // ruler's own local space via the BCE ruler's rendered width, same as the
  // real component does by DOM layout.
  const xScale = scaleFor(-1000, 3000, 40000);
  const { container } = render(<YearAxis xScale={xScale} visibleStartYear={1750} visibleEndYear={1950} />);

  const label = Array.from(container.querySelectorAll('.year-axis-label')).find((el) => el.textContent === '1900') as HTMLElement;
  const bceRuler = container.querySelector('.year-axis-ruler-bce') as HTMLElement;
  const ceRuler = container.querySelector('.year-axis-ruler') as HTMLElement;
  const ceRulerLeft = parseFloat(bceRuler.style.width);
  const centuryOffsetPx = parseFloat(ceRuler.style.getPropertyValue('--century-tick-offset-px'));
  const centurySpacingPx = parseFloat(ceRuler.style.getPropertyValue('--century-tick-px'));

  const labelXInCeRuler = parseFloat(label.style.left) - ceRulerLeft;
  const distanceFromNearestTick =
    (((labelXInCeRuler - centuryOffsetPx) % centurySpacingPx) + centurySpacingPx) % centurySpacingPx;
  expect(distanceFromNearestTick).toBeCloseTo(0, 5);
});

test('the axis height fits the ruler bar plus the label row', () => {
  const { container } = render(
    <YearAxis xScale={scaleFor(1000, 3000, 20000)} visibleStartYear={1750} visibleEndYear={1950} />,
  );

  expect((container.firstElementChild as HTMLElement).style.height).toBe(`${AXIS_HEIGHT}px`);
  expect((container.querySelector('.year-axis-ruler') as HTMLElement).style.height).toBe(`${RULER_HEIGHT}px`);
});
