import { useCallback, useEffect, useRef, useState } from 'react';
import {
  entityLinkSearch,
  type ProfileAnchor,
  readEntityLinkAnchor,
  readEntityLinkSlug,
  type SelectionMember,
} from '../../../shared/lib/entity';
import { trackEvent } from '../../../shared/lib/track-event';

// Defined in shared/lib/entity/ because features/search-timeline-entities
// also needs them and FSD forbids same-layer feature imports.
export type {
  EntityType,
  SelectedEntityRef,
  SelectionMember,
} from '../../../shared/lib/entity';
export { ENTITY_TYPES } from '../../../shared/lib/entity';

function currentLinkSlug(): string | null {
  return typeof window === 'undefined'
    ? null
    : readEntityLinkSlug(window.location.search);
}

// Writes `slug` into the URL unless it already says exactly that, so picking
// what the URL already names adds no history entry, and a link with extras is
// rewritten to what actually opened. The Profile Anchor fragment belongs to the
// entity the link named, so it is dropped unless `keepAnchor` says it still
// applies.
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

// The Selection (GLOSSARY.md): the one entity whose panel is open, mirrored into
// the URL's Entity Link (`?e=<slug>`). Shared by widgets/timeline-canvas (the
// click source) and widgets/detail-panel.
//
// On initial load and Back/forward, `pendingLinkSlug` holds the entity slug
// until the app finds the entity and passes its member to `openLink`.
//
// A Profile Anchor (`#moment-<n>` / `#fact-<n>`) arriving with the link is
// exposed as `anchor` once its entity opens; it is gone as soon as the
// Selection becomes a different entity or closes.
//
// History: picking an entity from an empty Selection pushes an entry, so Back
// closes the panel in one step; every later click or Search pick while the panel
// is open, and closing, replaces it. A Connection hop always pushes, so Back
// retraces the hops.
//
// All callbacks are stable (useCallback) because they are effect dependencies
// in TimelineCanvas's click listener and DetailPanel's dismiss listeners,
// which would otherwise be re-added on every App render.
export function useSelection() {
  const [member, setMember] = useState<SelectionMember | null>(null);
  // Mirrors `member` for the callbacks, so they can read the latest Selection
  // without depending on it (and losing their stable identity).
  const memberRef = useRef(member);
  memberRef.current = member;
  const [pendingLinkSlug, setPendingLinkSlug] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<ProfileAnchor | null>(null);

  // Read after mount rather than in the useState initializer: the prerendered
  // HTML has no link, and hydration doesn't patch attribute mismatches (the
  // language switch's href), so the first client render must match it.
  useEffect(() => {
    setPendingLinkSlug(currentLinkSlug());
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const slug = currentLinkSlug();
      if (!slug) {
        setMember(null);
        setAnchor(null);
      }
      setPendingLinkSlug(slug);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // A click, a Search pick or a Connection: the Selection becomes this entity.
  const replace = useCallback((next: SelectionMember) => {
    const previous = memberRef.current;
    memberRef.current = next;
    setMember(next);
    setPendingLinkSlug(null);
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
    setPendingLinkSlug(null);
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
    setPendingLinkSlug(null);
    writeEntityLink(resolved.slug, 'replace', true);
    trackEvent('selection_open_link');
  }, []);

  // Closing (or an Entity Link that never resolves) replaces the entry
  // rather than adding one, so Back doesn't reopen what was just dismissed.
  const clear = useCallback(() => {
    memberRef.current = null;
    setMember(null);
    setAnchor(null);
    setPendingLinkSlug(null);
    writeEntityLink(null, 'replace');
  }, []);

  return { member, anchor, pendingLinkSlug, replace, follow, openLink, clear };
}
