import type { Region } from '../types';
import { m } from '../paraglide/messages.js';

// Display labels for the sidebar's Region filter pills. Picked once at
// module load from the compiled locale's message catalog (docs/adr/0005) —
// same pattern as occupation-domain-colors.ts's DOMAIN_LABELS.
export const REGION_LABELS: Record<Region, string> = {
  'northern-europe': m['taxonomy.region.northern-europe'](),
  'southern-europe': m['taxonomy.region.southern-europe'](),
  'eastern-europe': m['taxonomy.region.eastern-europe'](),
  'western-europe': m['taxonomy.region.western-europe'](),
  'eastern-asia': m['taxonomy.region.eastern-asia'](),
  'south-eastern-asia': m['taxonomy.region.south-eastern-asia'](),
  'southern-asia': m['taxonomy.region.southern-asia'](),
  'central-asia': m['taxonomy.region.central-asia'](),
  'western-asia': m['taxonomy.region.western-asia'](),
  'northern-africa': m['taxonomy.region.northern-africa'](),
  'western-africa': m['taxonomy.region.western-africa'](),
  'middle-africa': m['taxonomy.region.middle-africa'](),
  'eastern-africa': m['taxonomy.region.eastern-africa'](),
  'southern-africa': m['taxonomy.region.southern-africa'](),
  'northern-america': m['taxonomy.region.northern-america'](),
  'central-america': m['taxonomy.region.central-america'](),
  caribbean: m['taxonomy.region.caribbean'](),
  'south-america': m['taxonomy.region.south-america'](),
  'australia-and-new-zealand': m['taxonomy.region.australia-and-new-zealand'](),
  melanesia: m['taxonomy.region.melanesia'](),
  micronesia: m['taxonomy.region.micronesia'](),
  polynesia: m['taxonomy.region.polynesia'](),
};
