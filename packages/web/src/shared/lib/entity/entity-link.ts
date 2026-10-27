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

// A Profile Anchor: the URL fragment `#moment-<n>` or `#fact-<n>` that names
// one Key Moment or Deep Fact of the opened Profile, counted from 1. Only the
// Landing Page writes it; the Entity Link itself stays one slug.
export type ProfileAnchorKind = 'moment' | 'fact';

export interface ProfileAnchor {
  kind: ProfileAnchorKind;
  index: number;
}

export function entityLinkHash(anchor: ProfileAnchor | undefined): string {
  return anchor ? `#${anchor.kind}-${anchor.index}` : '';
}

// Null for anything that is not exactly a known kind and a positive integer.
export function readEntityLinkAnchor(hash: string): ProfileAnchor | null {
  const match = /^#(moment|fact)-([1-9]\d*)$/.exec(hash);
  if (!match) return null;
  return { kind: match[1] as ProfileAnchorKind, index: Number(match[2]) };
}
