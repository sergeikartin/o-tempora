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

// A reignPeriod item shares its `subgroup` with its person's own lifespan
// item (see map-to-items.ts) so it overlaps that person's row instead of
// stacking into a separate one. Verified against vis-timeline@8.5.2's
// actual stacking source (standalone/umd/vis-timeline-graph2d.js): items
// sharing a subgroup only skip the library's default full-collision
// stacking and go through its per-subgroup "each item same top" placement
// when a *Group's* `subgroupStack` config sets its internal `doInnerStack`
// flag true — the confusingly-similarly-named `TimelineOptions.stackSubgroups`
// (top-level) only gates whether that per-group config is honored, it does
// nothing on its own. Within that placement, a subgroup only gets
// separated back out (via `substack`) if ITS OWN `subgroupStack` entry is
// `true` — the default (absent) is `false`, i.e. overlap. So a single
// dummy key here (never a real person id) flips doInnerStack on globally
// for this group without opting any real person's subgroup back into
// separated stacking.
const ENABLE_PEOPLE_SUBGROUP_OVERLAP: Record<string, boolean> = { '__enable-subgroup-overlap__': true };

export const PEOPLE_GROUPS: DataGroup[] = [
  { id: 'people', content: 'People', subgroupStack: ENABLE_PEOPLE_SUBGROUP_OVERLAP },
];
export const WARS_GROUPS: DataGroup[] = [{ id: 'wars', content: 'Wars & Conflicts' }];
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
    // stackSubgroups is left at its default (true) deliberately — see
    // PEOPLE_GROUPS's comment. It has to stay true for the People group's
    // subgroupStack config to be consulted at all.
  };
}

export function buildWarsTimelineOptions(): TimelineOptions {
  return {
    ...buildSharedOptions(),
    // Same axis reasoning as the People lane above.
    orientation: { axis: 'none' },
  };
}

export function buildEventsTimelineOptions(): TimelineOptions {
  return buildSharedOptions();
}
