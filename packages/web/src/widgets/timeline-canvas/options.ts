import type { DataGroup, TimelineOptions } from 'vis-timeline/standalone';
import { toLegacyDate, today } from '../../shared/lib/dates';
import {
  ZOOM_MIN_YEARS,
  ZOOM_MAX_YEARS,
  DEFAULT_VIEWPORT_START,
  DEFAULT_VIEWPORT_END,
  PAN_MIN_DATE,
} from '../../shared/config/viewport';

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

export const PEOPLE_GROUPS: DataGroup[] = [{ id: 'people', content: 'People' }];
export const EVENTS_GROUPS: DataGroup[] = [{ id: 'events', content: 'Events & Inventions' }];

// Shared zoom/pan bounds and interaction behavior for both lane instances.
// Each lane is its own vis-timeline Timeline instance (see TimelineCanvas.tsx)
// kept in sync on the time axis, rather than one Timeline with two groups —
// a single instance has exactly one global vertical scroll position shared
// across all groups, so it can't give People and Events independent
// fixed-height scroll regions.
function buildSharedOptions(): TimelineOptions {
  return {
    stack: true,
    zoomMin: ZOOM_MIN_YEARS * MS_PER_YEAR,
    zoomMax: ZOOM_MAX_YEARS * MS_PER_YEAR,
    min: toLegacyDate(PAN_MIN_DATE),
    max: toLegacyDate(today()),
    start: toLegacyDate(DEFAULT_VIEWPORT_START),
    end: toLegacyDate(DEFAULT_VIEWPORT_END),
    height: '100%',
    // Wheel-zoom is replaced by dedicated +/- buttons (Timeline.zoomIn/Out,
    // called directly, are unaffected by zoomable:false). A plain vertical
    // wheel gesture instead scrolls the lane's stacked content
    // (verticalScroll), while a horizontal wheel gesture pans through time
    // (horizontalScroll) — drag-to-pan is a separate, always-on interaction.
    zoomable: false,
    verticalScroll: true,
    horizontalScroll: true,
  };
}

export function buildPeopleTimelineOptions(): TimelineOptions {
  return {
    ...buildSharedOptions(),
    // The single shared time axis renders on the events lane instead (see
    // buildEventsTimelineOptions) — showing it twice would be redundant.
    orientation: { axis: 'none' },
  };
}

export function buildEventsTimelineOptions(): TimelineOptions {
  return buildSharedOptions();
}
