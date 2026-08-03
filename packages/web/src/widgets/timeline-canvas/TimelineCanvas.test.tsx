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
const { PEOPLE_GROUPS, WARS_GROUPS, EVENTS_GROUPS } = await import('./options');

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
  {
    id: 'Q8676',
    name: 'American Civil War',
    date: 1861,
    endDate: 1865,
    category: 'war',
    regionTags: ['americas'],
    fameScore: 400,
    description: 'civil war in the United States',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/American_Civil_War',
  },
];

beforeEach(() => {
  mockTimeline.mockClear();
  createdInstances = [];
});

afterEach(cleanup);

test('constructs one Timeline per lane, with the matching groups, zoom options, and mapped items', () => {
  render(<TimelineCanvas people={fixturePeople} events={fixtureEvents} />);

  expect(mockTimeline).toHaveBeenCalledTimes(3);
  const [, peopleItems, peopleGroups, peopleOptions] = mockTimeline.mock.calls[0] as [
    HTMLElement,
    unknown[],
    unknown,
    { zoomMin: number; zoomMax: number; zoomable: boolean },
  ];
  const [, warsItems, warsGroups, warsOptions] = mockTimeline.mock.calls[1] as [
    HTMLElement,
    unknown[],
    unknown,
    { zoomMin: number; zoomMax: number; zoomable: boolean },
  ];
  const [, eventsItems, eventsGroups, eventsOptions] = mockTimeline.mock.calls[2] as [
    HTMLElement,
    unknown[],
    unknown,
    { zoomMin: number; zoomMax: number; zoomable: boolean },
  ];

  expect(peopleItems).toHaveLength(0);
  expect(warsItems).toHaveLength(0);
  expect(eventsItems).toHaveLength(0);
  expect(peopleGroups).toBe(PEOPLE_GROUPS);
  expect(warsGroups).toBe(WARS_GROUPS);
  expect(eventsGroups).toBe(EVENTS_GROUPS);

  for (const options of [peopleOptions, warsOptions, eventsOptions]) {
    expect(options.zoomMin).toBe(10 * MS_PER_YEAR);
    expect(options.zoomMax).toBe(250 * MS_PER_YEAR);
    expect(options.zoomable).toBe(false);
  }

  const [peopleInstance, warsInstance, eventsInstance] = createdInstances;
  expect(peopleInstance?.setItems).toHaveBeenCalledTimes(1);
  expect((peopleInstance?.setItems.mock.calls[0]?.[0] as unknown[]).length).toBe(fixturePeople.length);
  // Wars lane gets only the non-invention entry (1 of 2 fixtureEvents).
  expect(warsInstance?.setItems).toHaveBeenCalledTimes(1);
  expect((warsInstance?.setItems.mock.calls[0]?.[0] as unknown[]).length).toBe(1);
  // Events lane gets only the invention entry (1 of 2 fixtureEvents).
  expect(eventsInstance?.setItems).toHaveBeenCalledTimes(1);
  expect((eventsInstance?.setItems.mock.calls[0]?.[0] as unknown[]).length).toBe(1);
});

test('the zoom-in/zoom-out buttons call zoomIn/zoomOut on the events lane instance', () => {
  const { getByLabelText } = render(<TimelineCanvas people={fixturePeople} events={fixtureEvents} />);
  const [, , eventsInstance] = createdInstances;

  fireEvent.click(getByLabelText('Zoom in'));
  expect(eventsInstance?.zoomIn).toHaveBeenCalledTimes(1);

  fireEvent.click(getByLabelText('Zoom out'));
  expect(eventsInstance?.zoomOut).toHaveBeenCalledTimes(1);
});

test('dragging/zooming one lane syncs the other two lanes to the same window, without bouncing back', () => {
  render(<TimelineCanvas people={fixturePeople} events={fixtureEvents} />);
  const [peopleInstance, warsInstance, eventsInstance] = createdInstances;

  const window = { start: new Date(2000, 0, 1), end: new Date(2010, 0, 1) };
  // Simulates a user drag/zoom on the people lane, which real vis-timeline
  // reports via its own 'rangechange' event.
  peopleInstance?.listeners.rangechange?.(window);

  expect(warsInstance?.setWindow).toHaveBeenCalledWith(window.start, window.end, { animation: false });
  expect(eventsInstance?.setWindow).toHaveBeenCalledWith(window.start, window.end, { animation: false });
  // The mock's setWindow re-fires each target's own 'rangechange' (matching
  // real vis-timeline), which the shared reentrancy guard must swallow
  // rather than reflecting back to the people lane or cross-bouncing
  // between wars and events.
  expect(peopleInstance?.setWindow).not.toHaveBeenCalled();
});
