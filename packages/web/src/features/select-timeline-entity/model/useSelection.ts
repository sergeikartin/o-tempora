import { useCallback, useEffect, useRef, useState } from 'react';
import {
  entityLinkSearch,
  isSelectionFull,
  readEntityLinkSlugs,
  type SelectionMember,
  toggleMember,
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

function currentLinkSlugs(): string[] {
  return typeof window === 'undefined'
    ? []
    : readEntityLinkSlugs(window.location.search);
}

// Writes `slugs` into the URL unless it already says exactly that, so picking
// what the URL already names adds no history entry, and a link with extras
// beyond the cap is rewritten to what actually opened.
function writeEntityLink(slugs: readonly string[], mode: 'push' | 'replace') {
  const { pathname, search, hash } = window.location;
  const nextSearch = entityLinkSearch(slugs, search);
  if (nextSearch === search) return;
  const url = pathname + nextSearch + hash;
  if (mode === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(window.history.state, '', url);
}

// The Selection (CONTEXT.md): up to four entities in the order they were
// picked, mirrored into the URL's Entity Link (`?e=<slug>`, repeated).
// Shared by widgets/timeline-canvas (the click source) and
// widgets/detail-panel.
//
// The URL carries only slugs, so slugs arriving from outside (initial load,
// Back/forward) surface as `pendingLinkSlugs` until app/ finds the entities in
// the datasets and hands their members to `openLink`.
//
// History: the first member picked from an empty Selection pushes an entry, so
// Back closes the panel in one step however many members were added since;
// every later change while the panel is open, and closing, replaces it.
//
// All callbacks are stable (useCallback) because they are effect dependencies
// in TimelineCanvas's click listener and DetailPanel's dismiss listeners,
// which would otherwise be re-added on every App render.
export function useSelection() {
  const [members, setMembers] = useState<readonly SelectionMember[]>([]);
  // Mirrors `members` for the callbacks, so they can read the latest Selection
  // without depending on it (and losing their stable identity).
  const membersRef = useRef(members);
  membersRef.current = members;
  const [pendingLinkSlugs, setPendingLinkSlugs] = useState<string[]>([]);

  // Read after mount rather than in the useState initializer: the prerendered
  // HTML has no link, and hydration doesn't patch attribute mismatches (the
  // language switch's href), so the first client render must match it.
  useEffect(() => {
    setPendingLinkSlugs(currentLinkSlugs());
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const slugs = currentLinkSlugs();
      if (slugs.length === 0) setMembers([]);
      setPendingLinkSlugs(slugs);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const commit = useCallback((next: readonly SelectionMember[]) => {
    const wasEmpty = membersRef.current.length === 0;
    membersRef.current = next;
    setMembers(next);
    setPendingLinkSlugs([]);
    writeEntityLink(
      next.map((member) => member.slug),
      wasEmpty && next.length > 0 ? 'push' : 'replace',
    );
  }, []);

  // A plain click or a Search pick: the Selection becomes this one entity.
  const replace = useCallback(
    (member: SelectionMember) => {
      commit([member]);
      trackEvent('entity_view', { entityType: member.ref.entityType });
    },
    [commit],
  );

  // Shift/Ctrl/Cmd-click or the panel's add mode: adds or removes one member.
  // Returns false when the add was ignored because the Selection is full.
  const toggle = useCallback(
    (member: SelectionMember): boolean => {
      const current = membersRef.current;
      const next = toggleMember(current, member);
      if (next === current) {
        trackEvent('selection_full');
        return false;
      }
      commit(next);
      if (next.length > current.length) {
        trackEvent('selection_add', { size: next.length });
      } else {
        trackEvent('selection_remove', { size: next.length });
      }
      return true;
    },
    [commit],
  );

  // Opens the entities the URL already names; it writes only to drop slugs
  // that never resolved or exceeded the cap.
  const openLink = useCallback((resolved: readonly SelectionMember[]) => {
    membersRef.current = resolved;
    setMembers(resolved);
    setPendingLinkSlugs([]);
    writeEntityLink(
      resolved.map((member) => member.slug),
      'replace',
    );
    trackEvent('selection_open_link', { size: resolved.length });
  }, []);

  // Closing (or an Entity Link that never resolves) replaces the entry
  // rather than adding one, so Back doesn't reopen what was just dismissed.
  const clear = useCallback(() => {
    membersRef.current = [];
    setMembers([]);
    setPendingLinkSlugs([]);
    writeEntityLink([], 'replace');
  }, []);

  return {
    members,
    isFull: isSelectionFull(members),
    pendingLinkSlugs,
    replace,
    toggle,
    openLink,
    clear,
  };
}
