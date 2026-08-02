import { test, expect } from 'vitest';
import { buildPeopleTimelineOptions, buildEventsTimelineOptions } from './options';
import { today } from '../../shared/lib/dates';

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

test.each([
  ['people', buildPeopleTimelineOptions],
  ['events', buildEventsTimelineOptions],
])('%s lane: min is bounded to 2750 BCE', (_name, build) => {
  const options = build();
  expect((options.min as Date).getFullYear()).toBe(-2750);
});

test.each([
  ['people', buildPeopleTimelineOptions],
  ['events', buildEventsTimelineOptions],
])('%s lane: max matches a live today() read', (_name, build) => {
  const options = build();
  expect((options.max as Date).getFullYear()).toBe(today().year);
});

test.each([
  ['people', buildPeopleTimelineOptions],
  ['events', buildEventsTimelineOptions],
])('%s lane: zoomMin/zoomMax match the 10/250-year bounds', (_name, build) => {
  const options = build();
  expect(options.zoomMin).toBe(10 * MS_PER_YEAR);
  expect(options.zoomMax).toBe(250 * MS_PER_YEAR);
});

test.each([
  ['people', buildPeopleTimelineOptions],
  ['events', buildEventsTimelineOptions],
])('%s lane: wheel-zoom is disabled and scroll axes are both enabled', (_name, build) => {
  const options = build();
  expect(options.zoomable).toBe(false);
  expect(options.verticalScroll).toBe(true);
  expect(options.horizontalScroll).toBe(true);
});

test('people lane hides its own time axis (the events lane shows the single shared axis)', () => {
  const options = buildPeopleTimelineOptions();
  expect(options.orientation).toEqual({ axis: 'none' });
});

test('events lane does not override the default axis orientation', () => {
  const options = buildEventsTimelineOptions();
  expect(options.orientation).toBeUndefined();
});
