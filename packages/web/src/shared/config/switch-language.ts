import { entityLinkSearch } from '../lib/entity';
import { getLocale } from '../paraglide/runtime.js';

// Root-relative paths allow a switch from either locale’s subpath.
const SIBLING_TIMELINE_HREF =
  getLocale() === 'ru' ? '/timeline/' : '/ru/timeline/';

export function switchLanguageHref(entitySlug: string | null): string {
  return SIBLING_TIMELINE_HREF + entityLinkSearch(entitySlug);
}
