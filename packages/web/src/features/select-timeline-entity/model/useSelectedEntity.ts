import { useCallback, useEffect, useState } from 'react';
import {
  ENTITY_TYPES,
  entityLinkSearch,
  readEntityLinkSlug,
  type SelectedEntityRef,
} from '../../../shared/lib/entity';
import { trackEvent } from '../../../shared/lib/track-event';

// Defined in shared/lib/entity/ because features/search-timeline-entities
// also needs them and FSD forbids same-layer feature imports.
export type {
  EntityType,
  SelectedEntityRef,
} from '../../../shared/lib/entity';
export { ENTITY_TYPES };

function currentLinkSlug(): string | null {
  return typeof window === 'undefined'
    ? null
    : readEntityLinkSlug(window.location.search);
}

function writeEntityLink(slug: string | null, mode: 'push' | 'replace') {
  const { pathname, search, hash } = window.location;
  const url = pathname + entityLinkSearch(slug, search) + hash;
  if (mode === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(window.history.state, '', url);
}

// Selection state for the detail panel, mirrored into the URL's Entity Link
// (`?e=<slug>`, CONTEXT.md). Shared by widgets/timeline-canvas (the click
// source) and widgets/detail-panel.
//
// The URL carries only a slug, so a slug arriving from outside (initial load,
// Back/forward) surfaces as `pendingLinkSlug` until app/ finds the entity in
// the datasets and hands its ref and slug to `openLink`. select/openLink/
// clear are stable (useCallback) because they are effect dependencies in
// TimelineCanvas's click listener and DetailPanel's dismiss listeners, which
// would otherwise be re-added on every App render.
export function useSelectedEntity() {
  const [selection, setSelection] = useState<{
    ref: SelectedEntityRef;
    slug: string;
  } | null>(null);
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
      if (!slug) setSelection(null);
      setPendingLinkSlug(slug);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // A new selection adds a history entry (Back closes the panel); picking
  // what the URL already names doesn't.
  const select = useCallback((ref: SelectedEntityRef, slug: string) => {
    setSelection({ ref, slug });
    setPendingLinkSlug(null);
    if (currentLinkSlug() !== slug) writeEntityLink(slug, 'push');
    trackEvent('entity_view', { entityType: ref.entityType });
  }, []);

  // Opens an entity the URL already names, so no history write.
  const openLink = useCallback((ref: SelectedEntityRef, slug: string) => {
    setSelection({ ref, slug });
    setPendingLinkSlug(null);
    trackEvent('entity_view', { entityType: ref.entityType });
  }, []);

  // Closing (or an Entity Link that never resolves) replaces the entry
  // rather than adding one, so Back doesn't reopen what was just dismissed.
  const clear = useCallback(() => {
    setSelection(null);
    setPendingLinkSlug(null);
    if (currentLinkSlug()) writeEntityLink(null, 'replace');
  }, []);

  return {
    selected: selection?.ref ?? null,
    selectedSlug: selection?.slug ?? null,
    pendingLinkSlug,
    select,
    openLink,
    clear,
  };
}
