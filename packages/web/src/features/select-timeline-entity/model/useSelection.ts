import { useCallback, useEffect, useRef, useState } from 'react';
import {
  entityLinkSearch,
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
// rewritten to what actually opened.
function writeEntityLink(slug: string | null, mode: 'push' | 'replace') {
  const { pathname, search, hash } = window.location;
  const nextSearch = entityLinkSearch(slug, search);
  if (nextSearch === search) return;
  const url = pathname + nextSearch + hash;
  if (mode === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(window.history.state, '', url);
}

// The Selection (CONTEXT.md): the one entity whose panel is open, mirrored into
// the URL's Entity Link (`?e=<slug>`). Shared by widgets/timeline-canvas (the
// click source) and widgets/detail-panel.
//
// The URL carries only a slug, so one arriving from outside (initial load,
// Back/forward) surfaces as `pendingLinkSlug` until app/ finds the entity in
// the datasets and hands its member to `openLink`.
//
// History: picking an entity from an empty Selection pushes an entry, so Back
// closes the panel in one step; every later change while the panel is open, and
// closing, replaces it.
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

  // Read after mount rather than in the useState initializer: the prerendered
  // HTML has no link, and hydration doesn't patch attribute mismatches (the
  // language switch's href), so the first client render must match it.
  useEffect(() => {
    setPendingLinkSlug(currentLinkSlug());
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const slug = currentLinkSlug();
      if (!slug) setMember(null);
      setPendingLinkSlug(slug);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // A click, a Search pick or a Connection: the Selection becomes this entity.
  const replace = useCallback((next: SelectionMember) => {
    const wasEmpty = memberRef.current === null;
    memberRef.current = next;
    setMember(next);
    setPendingLinkSlug(null);
    writeEntityLink(next.slug, wasEmpty ? 'push' : 'replace');
    trackEvent('entity_view', { entityType: next.ref.entityType });
  }, []);

  // Opens the entity the URL already names; it writes only to drop extra
  // slugs from the link.
  const openLink = useCallback((resolved: SelectionMember) => {
    memberRef.current = resolved;
    setMember(resolved);
    setPendingLinkSlug(null);
    writeEntityLink(resolved.slug, 'replace');
    trackEvent('selection_open_link');
  }, []);

  // Closing (or an Entity Link that never resolves) replaces the entry
  // rather than adding one, so Back doesn't reopen what was just dismissed.
  const clear = useCallback(() => {
    memberRef.current = null;
    setMember(null);
    setPendingLinkSlug(null);
    writeEntityLink(null, 'replace');
  }, []);

  return { member, pendingLinkSlug, replace, openLink, clear };
}
