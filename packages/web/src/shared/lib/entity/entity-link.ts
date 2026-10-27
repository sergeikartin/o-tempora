// The Entity Link (CONTEXT.md): `?e=<slug>` names the one selected entity and
// is the only URL state the app has. Slugs are globally unique across lanes, so
// a slug alone identifies the entity — its lane is resolved by looking it up in
// the loaded datasets.
const ENTITY_PARAM = 'e';

// The first non-empty slug; a link that repeats the param opens only that one.
export function readEntityLinkSlug(search: string): string | null {
  return new URLSearchParams(search).getAll(ENTITY_PARAM).find(Boolean) ?? null;
}

// `search` with the entity param replaced by `slug` (null removes it), every
// other param left untouched.
export function entityLinkSearch(slug: string | null, search = ''): string {
  const params = new URLSearchParams(search);
  params.delete(ENTITY_PARAM);
  if (slug) params.append(ENTITY_PARAM, slug);
  const next = params.toString();
  return next ? `?${next}` : '';
}
