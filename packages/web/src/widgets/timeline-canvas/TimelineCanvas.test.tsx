import { cleanup, fireEvent, render } from '@testing-library/react';
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HistoricalEvent, Person } from '../../shared/types';

interface MockInstance {
  setItems: ReturnType<typeof vi.fn>;
  setWindow: ReturnType<typeof vi.fn>;
  zoomIn: ReturnType<typeof vi.fn>;
  zoomOut: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  listeners: Record<string, (properties: { start: Date; end: Date }) => void>;
}

function createMockInstance(): MockInstance {
  const listeners: MockInstance['listeners'] = {};
  const instance: MockInstance = {
    setItems: vi.fn(),
    // Real vis-timeline re-fires this instance's own 'rangechange' listener
    // synchronously when its window is set programmatically — reproduce that
    // here so the reentrancy guard in TimelineCanvas.tsx is actually exercised.
    setWindow: vi.fn((start: Date, end: Date) => {
      instance.listeners.rangechange?.({ start, end });
    }),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn((event: string, callback: (properties: { start: Date; end: Date }) => void) => {
      listeners[event] = callback;
    }),
    listeners,
  };
  return instance;
}

let createdInstances: MockInstance[] = [];
const mockTimeline = vi.fn().mockImplementation(function MockTimeline() {
  const instance = createMockInstance();
  createdInstances.push(instance);
  return instance;
});

vi.mock('vis-timeline/standalone', () => ({
  Timeline: mockTimeline,
}));

vi.mock('vis-timeline/styles/vis-timeline-graph2d.css', () => ({}));

const { TimelineCanvas } = await import('./TimelineCanvas');
const { PEOPLE_GROUPS, EVENTS_GROUPS } = await import('./options');

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

const fixturePeople: Person[] = [
  {
    id: 'Q868',
    name: 'Aristotle',
    birthYear: -383,
    deathYear: -321,
    category: 'philosophy',
    occupationTags: ['philosophy'],
    regionTags: [],
    fameScore: 317,
    description: '4th-century BCE Classical Greek philosopher and polymath',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Aristotle',
  },
];

const fixtureEvents: HistoricalEvent[] = [
  {
    id: 'Q155',
    name: 'Brazil',
    date: 1500,
    category: 'invention',
    regionTags: ['americas'],
    fameScore: 386,
    description: 'country in South America',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/Brazil',
  },
];

beforeEach(() => {
  mockTimeline.mockClear();
  createdInstances = [];
});

afterEach(cleanup);

test('constructs one Timeline per lane, with the matching groups, zoom options, and mapped items', () => {
  render(<TimelineCanvas people={fixturePeople} events={fixtureEvents} />);

  expect(mockTimeline).toHaveBeenCalledTimes(2);
  const [, peopleItems, peopleGroups, peopleOptions] = mockTimeline.mock.calls[0] as [
    HTMLElement,
    unknown[],
    unknown,
    { zoomMin: number; zoomMax: number; zoomable: boolean },
  ];
  const [, eventsItems, eventsGroups, eventsOptions] = mockTimeline.mock.calls[1] as [
    HTMLElement,
    unknown[],
    unknown,
    { zoomMin: number; zoomMax: number; zoomable: boolean },
  ];

  expect(peopleItems).toHaveLength(0);
  expect(eventsItems).toHaveLength(0);
  expect(peopleGroups).toBe(PEOPLE_GROUPS);
  expect(eventsGroups).toBe(EVENTS_GROUPS);

  for (const options of [peopleOptions, eventsOptions]) {
    expect(options.zoomMin).toBe(10 * MS_PER_YEAR);
    expect(options.zoomMax).toBe(250 * MS_PER_YEAR);
    expect(options.zoomable).toBe(false);
  }

  const [peopleInstance, eventsInstance] = createdInstances;
  expect(peopleInstance?.setItems).toHaveBeenCalledTimes(1);
  expect((peopleInstance?.setItems.mock.calls[0]?.[0] as unknown[]).length).toBe(fixturePeople.length);
  expect(eventsInstance?.setItems).toHaveBeenCalledTimes(1);
  expect((eventsInstance?.setItems.mock.calls[0]?.[0] as unknown[]).length).toBe(fixtureEvents.length);
});

test('the zoom-in/zoom-out buttons call zoomIn/zoomOut on the events lane instance', () => {
  const { getByLabelText } = render(<TimelineCanvas people={fixturePeople} events={fixtureEvents} />);
  const [, eventsInstance] = createdInstances;

  fireEvent.click(getByLabelText('Zoom in'));
  expect(eventsInstance?.zoomIn).toHaveBeenCalledTimes(1);

  fireEvent.click(getByLabelText('Zoom out'));
  expect(eventsInstance?.zoomOut).toHaveBeenCalledTimes(1);
});

test('dragging/zooming one lane syncs the other lane to the same window, without bouncing back', () => {
  render(<TimelineCanvas people={fixturePeople} events={fixtureEvents} />);
  const [peopleInstance, eventsInstance] = createdInstances;

  const window = { start: new Date(2000, 0, 1), end: new Date(2010, 0, 1) };
  // Simulates a user drag/zoom on the people lane, which real vis-timeline
  // reports via its own 'rangechange' event.
  peopleInstance?.listeners.rangechange?.(window);

  expect(eventsInstance?.setWindow).toHaveBeenCalledWith(window.start, window.end, { animation: false });
  // The mock's setWindow re-fires the events lane's own 'rangechange' (matching
  // real vis-timeline), which the reentrancy guard must swallow rather than
  // reflecting back to the people lane.
  expect(peopleInstance?.setWindow).not.toHaveBeenCalled();
});
