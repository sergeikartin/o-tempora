import type { Region, UnRegion } from '../types';
import { m } from '../paraglide/messages.js';

// Display labels for the sidebar's Region filter pills. Picked once at
// module load from the compiled locale's message catalog (docs/adr/0005) —
// same pattern as occupation-domain-colors.ts's DOMAIN_LABELS.
export const REGION_LABELS: Record<Region, string> = {
  europe: m['taxonomy.region.europe'](),
  'east-asia': m['taxonomy.region.east-asia'](),
  'south-asia': m['taxonomy.region.south-asia'](),
  'middle-east': m['taxonomy.region.middle-east'](),
  africa: m['taxonomy.region.africa'](),
  americas: m['taxonomy.region.americas'](),
};

// Complete map from People's 22-value UN sub-region tag down to the 6-value
// Region Conflicts/Milestones already use natively — every UnRegion
// resolves to exactly one Region, so no person is ever excluded from every
// Region pill just because their sub-region doesn't fit neatly (grill-
// with-docs session, 2026-08-12; see CONTEXT.md's Region/Sub-region
// entries). Two buckets are deliberate best-fit approximations rather than
// clean geographic matches: Central Asia is grouped under Middle East
// (Silk Road/Persianate proximity, nearest available bucket), and all of
// Oceania (Australia/NZ, Melanesia, Micronesia, Polynesia — 8 people in the
// Aug 2026 dataset) is grouped under East Asia for lack of any closer
// bucket among the 6. Revisiting whether Region itself should gain a 7th
// value is out of scope — see .scratch/sidebar-filters-legend/spec.md.
export const UN_REGION_TO_REGION: Record<UnRegion, Region> = {
  'northern-europe': 'europe',
  'southern-europe': 'europe',
  'eastern-europe': 'europe',
  'western-europe': 'europe',
  'eastern-asia': 'east-asia',
  'south-eastern-asia': 'east-asia',
  'australia-and-new-zealand': 'east-asia',
  melanesia: 'east-asia',
  micronesia: 'east-asia',
  polynesia: 'east-asia',
  'southern-asia': 'south-asia',
  'western-asia': 'middle-east',
  'central-asia': 'middle-east',
  'northern-africa': 'africa',
  'western-africa': 'africa',
  'middle-africa': 'africa',
  'eastern-africa': 'africa',
  'southern-africa': 'africa',
  'northern-america': 'americas',
  'central-america': 'americas',
  caribbean: 'americas',
  'south-america': 'americas',
};
