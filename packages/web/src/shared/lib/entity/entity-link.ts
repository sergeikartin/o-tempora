// The Entity Link (CONTEXT.md): `?e=<slug>` is the only URL state the app has.
// Slugs are globally unique across lanes, so the slug alone identifies the
// entity — its lane is resolved by looking it up in the loaded datasets.
const ENTITY_PARAM = 'e';

export function readEntityLinkSlug(search: string): string | null {
  return new URLSearchParams(search).get(ENTITY_PARAM) || null;
}

// `search` with the entity param set to `slug` (or removed for null), every
// other param left untouched.
export function entityLinkSearch(slug: string | null, search = ''): string {
  const params = new URLSearchParams(search);
  if (slug) params.set(ENTITY_PARAM, slug);
  else params.delete(ENTITY_PARAM);
  const next = params.toString();
  return next ? `?${next}` : '';
}
