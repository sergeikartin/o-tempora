import { entityLinkSearch } from '../lib/entity';
import { getLocale } from '../paraglide/runtime.js';

// The sibling locale's timeline — English is served from the domain root,
// every other locale from its own `/<locale>/` subpath (`/ru/timeline/`; see
// docs/deployment.md, docs/adr/0007). Root-relative so it resolves correctly
// regardless of which subpath this page was served from. getLocale()
// resolves the locale from the current URL at runtime (docs/adr/0009's
// strategy: ['url', 'baseLocale']). Carries only the Entity Link across the
// switch, never viewport or filter state.
const SIBLING_TIMELINE_HREF =
  getLocale() === 'ru' ? '/timeline/' : '/ru/timeline/';

export function switchLanguageHref(entitySlug: string | null): string {
  return SIBLING_TIMELINE_HREF + entityLinkSearch(entitySlug);
}
