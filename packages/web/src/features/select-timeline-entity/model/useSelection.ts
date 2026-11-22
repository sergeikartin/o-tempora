import { useCallback, useEffect, useRef, useState } from 'react';
import {
  entityLinkSearch,
  type ProfileAnchor,
  readEntityLinkAnchor,
  readEntityLinkSlug,
  type SelectionMember,
} from '../../../shared/lib/entity';
import { trackEvent } from '../../../shared/lib/track-event';

export type {
  EntityType,
  SelectedEntityRef,
  SelectionMember,
} from '../../../shared/lib/entity';
export { ENTITY_TYPES } from '../../../shared/lib/entity';

type PendingSelection = { via: 'link' | 'connection'; slug: string };

function currentLinkSlug(): string | null {
  return typeof window === 'undefined'
    ? null
    : readEntityLinkSlug(window.location.search);
}

// Keep the fragment only while it still refers to the same entity.
function writeEntityLink(
  slug: string | null,
  mode: 'push' | 'replace',
  keepAnchor = false,
) {
  const { pathname, search, hash } = window.location;
  const url =
    pathname + entityLinkSearch(slug, search) + (keepAnchor ? hash : '');
  if (url === pathname + search + hash) return;
  if (mode === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(window.history.state, '', url);
}

// Back closes the first opened Selection and retraces Connection hops.
// The callbacks stay stable for the canvas and panel listener effects.
export function useSelection() {
  const [member, setMember] = useState<SelectionMember | null>(null);
  // Mirrors `member` for the callbacks, so they can read the latest Selection
  // without depending on it (and losing their stable identity).
  const memberRef = useRef(member);
  memberRef.current = member;
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const [anchor, setAnchor] = useState<ProfileAnchor | null>(null);

  // Read after mount rather than in the useState initializer: the prerendered
  // HTML has no link, and hydration doesn't patch attribute mismatches (the
  // language switch's href), so the first client render must match it.
  useEffect(() => {
    const slug = currentLinkSlug();
    if (slug) setPending({ via: 'link', slug });
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const slug = currentLinkSlug();
      if (!slug) {
        memberRef.current = null;
        setMember(null);
        setAnchor(null);
      }
      setPending(slug ? { via: 'link', slug } : null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const replace = useCallback((next: SelectionMember) => {
    const previous = memberRef.current;
    memberRef.current = next;
    setMember(next);
    setPending(null);
    const isSameEntity = previous?.slug === next.slug;
    if (!isSameEntity) setAnchor(null);
    writeEntityLink(
      next.slug,
      previous === null ? 'push' : 'replace',
      isSameEntity,
    );
    trackEvent('entity_view', { entityType: next.ref.entityType });
  }, []);

  // A Connection hop: like `replace`, but always adds a history entry so Back
  // returns to the entity the hop left.
  const follow = useCallback((next: SelectionMember) => {
    const isSameEntity = memberRef.current?.slug === next.slug;
    memberRef.current = next;
    setMember(next);
    setPending(null);
    if (!isSameEntity) setAnchor(null);
    writeEntityLink(next.slug, 'push', isSameEntity);
    trackEvent('entity_view', { entityType: next.ref.entityType });
  }, []);

  // Opens the entity the URL already names, with the Profile Anchor it carries;
  // it writes only to drop extra slugs from the link.
  const openLink = useCallback((resolved: SelectionMember) => {
    memberRef.current = resolved;
    setMember(resolved);
    setAnchor(readEntityLinkAnchor(window.location.hash));
    setPending(null);
    writeEntityLink(resolved.slug, 'replace', true);
    trackEvent('selection_open_link');
  }, []);

  // Closing (or an Entity Link that never resolves) replaces the entry
  // rather than adding one, so Back doesn't reopen what was just dismissed.
  const clear = useCallback(() => {
    memberRef.current = null;
    setMember(null);
    setAnchor(null);
    setPending(null);
    writeEntityLink(null, 'replace');
  }, []);

  const requestConnection = useCallback((slug: string) => {
    setPending({ via: 'connection', slug });
  }, []);

  const cancelPending = useCallback(() => setPending(null), []);

  return {
    member,
    anchor,
    pending,
    replace,
    follow,
    openLink,
    clear,
    requestConnection,
    cancelPending,
  };
}
