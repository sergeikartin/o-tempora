import { entityLinkSearch } from '../lib/entity';
import { getLocale } from '../paraglide/runtime.js';

// The sibling deployment's default (home) view — English is served from the
// domain root, every other locale from its own `/<locale>/` subpath (Russian
// at `/ru`; see docs/deployment.md, docs/adr/0003). Root-relative so it
// resolves correctly regardless of which subpath this page was served
// from. getLocale() resolves the locale from the current URL at runtime
// (docs/adr/0009's strategy: ['url', 'baseLocale']). Carries only the
// Entity Link across the switch, never viewport or filter state.
const SIBLING_HOME_HREF = getLocale() === 'ru' ? '/' : '/ru/';

export function switchLanguageHref(entitySlug: string | null): string {
  return SIBLING_HOME_HREF + entityLinkSearch(entitySlug);
}
