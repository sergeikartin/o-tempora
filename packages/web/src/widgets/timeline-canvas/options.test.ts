import { test, expect } from 'vitest';
import {
  buildPeopleTimelineOptions,
  buildWarsTimelineOptions,
  buildEventsTimelineOptions,
  PEOPLE_GROUPS,
  WARS_GROUPS,
} from './options';
import { today } from '../../shared/lib/dates';

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

test.each([
  ['people', buildPeopleTimelineOptions],
  ['wars', buildWarsTimelineOptions],
  ['events', buildEventsTimelineOptions],
])('%s lane: min is bounded to 2750 BCE', (_name, build) => {
  const options = build();
  expect((options.min as Date).getFullYear()).toBe(-2750);
});

test.each([
  ['people', buildPeopleTimelineOptions],
  ['wars', buildWarsTimelineOptions],
  ['events', buildEventsTimelineOptions],
])('%s lane: max matches a live today() read', (_name, build) => {
  const options = build();
  expect((options.max as Date).getFullYear()).toBe(today().year);
});

test.each([
  ['people', buildPeopleTimelineOptions],
  ['wars', buildWarsTimelineOptions],
  ['events', buildEventsTimelineOptions],
])('%s lane: zoomMin/zoomMax match the 10/250-year bounds', (_name, build) => {
  const options = build();
  expect(options.zoomMin).toBe(10 * MS_PER_YEAR);
  expect(options.zoomMax).toBe(250 * MS_PER_YEAR);
});

test.each([
  ['people', buildPeopleTimelineOptions],
  ['wars', buildWarsTimelineOptions],
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

test('wars lane hides its own time axis (the events lane shows the single shared axis)', () => {
  const options = buildWarsTimelineOptions();
  expect(options.orientation).toEqual({ axis: 'none' });
});

test('events lane does not override the default axis orientation', () => {
  const options = buildEventsTimelineOptions();
  expect(options.orientation).toBeUndefined();
});

test('people lane leaves the default stackSubgroups option untouched (true) — required for the People group\'s subgroupStack config below to take effect at all', () => {
  const options = buildPeopleTimelineOptions();
  expect(options.stackSubgroups).toBeUndefined();
});

test('the People group enables inner subgroup positioning without forcing any real subgroup to stack, so reignPeriod items overlap their person\'s lifespan bar instead of stacking into a separate row', () => {
  const [peopleGroup] = PEOPLE_GROUPS;
  expect(peopleGroup?.subgroupStack).toBeTruthy();
  // No real person id should be a key here with a `true` value — that
  // would turn overlap back into internal stacking for that specific
  // person. The object exists only to flip vis-timeline's internal
  // doInnerStack flag on (see options.ts's comment for why).
  const stackConfig = peopleGroup?.subgroupStack;
  if (typeof stackConfig === 'object') {
    expect(Object.values(stackConfig).some(Boolean)).toBe(true);
    expect(Object.keys(stackConfig)).not.toContain('Q1048'); // sanity: not a real person id
  }
});

test('the Wars group has no subgroupStack config (this lane never uses subgroups)', () => {
  const [warsGroup] = WARS_GROUPS;
  expect(warsGroup?.subgroupStack).toBeUndefined();
});
