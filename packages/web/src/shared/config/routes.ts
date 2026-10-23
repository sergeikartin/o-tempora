import { getLocale } from '../paraglide/runtime.js';

// The landing page and the timeline are separate HTML entries per locale
// (docs/deployment.md, docs/adr/0007). Root-relative, resolved from the
// current URL's locale at runtime.
const isRussian = getLocale() === 'ru';

export const TIMELINE_HREF = isRussian ? '/ru/timeline/' : '/timeline/';

export const SIBLING_LANDING_HREF = isRussian ? '/' : '/ru/';
