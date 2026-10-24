import { MAX_SELECTION_SIZE } from './selection';

// The Entity Link (CONTEXT.md): `?e=<slug>`, repeated once per Selection
// member in selection order, is the only URL state the app has. Slugs are
// globally unique across lanes, so a slug alone identifies the entity — its
// lane is resolved by looking it up in the loaded datasets.
const ENTITY_PARAM = 'e';

// Slugs in URL order, empty ones and repeats dropped, extras beyond the
// Selection cap ignored.
export function readEntityLinkSlugs(search: string): string[] {
  const slugs = new Set(
    new URLSearchParams(search).getAll(ENTITY_PARAM).filter(Boolean),
  );
  return [...slugs].slice(0, MAX_SELECTION_SIZE);
}

// `search` with the entity params replaced by `slugs` (none removes them),
// every other param left untouched.
export function entityLinkSearch(
  slugs: readonly string[],
  search = '',
): string {
  const params = new URLSearchParams(search);
  params.delete(ENTITY_PARAM);
  for (const slug of slugs) params.append(ENTITY_PARAM, slug);
  const next = params.toString();
  return next ? `?${next}` : '';
}
