import { useEffect, useRef, useState } from 'react';
import type { ProfileAnchor } from '../../../shared/lib/entity';
import { m } from '../../../shared/paraglide/messages.js';
import {
  buildDrawerContent,
  type DetailPanelEntity,
} from '../lib/build-drawer-content';
import type { ProfileBody, ResolvedConnection } from '../lib/profile';
import styles from './DetailPanel.module.css';
import { ProfileView } from './ProfileView';

export interface DetailPanelMember {
  entity: DetailPanelEntity;
  // Filtered out of the canvas by Detail Level or filters; it stays selected.
  isHidden: boolean;
  // Present when the entity has a Profile; once loaded it replaces the
  // Description, and the panel is wide while it loads or if that fails.
  profileView?: ProfileViewState;
  // The Key Moment or Deep Fact a Landing Page link named; the Profile scrolls
  // to it and accents it.
  anchor?: ProfileAnchor;
}

export type ProfileViewState =
  | { status: 'loading' }
  | { status: 'failed' }
  | {
      status: 'ready';
      profile: ProfileBody;
      color: string;
      connections: readonly ResolvedConnection[];
    };

interface DetailPanelProps {
  member: DetailPanelMember | null;
  onOpenConnection: (slug: string) => void;
  onClose: () => void;
}

// Sized for the panel's fixed 440px width at typical device pixel ratios; not
// load-bearing.
const IMAGE_BANNER_WIDTH_PX = 400;

// Below this much pointerdown-to-pointerup movement, an outside press is a
// click (dismiss) rather than a drag-to-pan release (ignore). Mirrors
// TimelineCanvas's DRAG_CLICK_SUPPRESSION_PX, tracked independently since this
// widget can't see that drag state.
const OUTSIDE_PRESS_DRAG_THRESHOLD_PX = 4;

// Click-to-open side panel docked to the viewport's right edge, independent of
// the clicked mark's position, so panning/zooming underneath needs no special
// handling. One global instance: App.tsx swaps `selected` in place rather than
// mounting a panel per entity.
export function DetailPanel({
  member,
  onOpenConnection,
  onClose,
}: DetailPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const [isHeaderStuck, setIsHeaderStuck] = useState(false);
  function handleScroll() {
    const header = headerRef.current;
    const panel = panelRef.current;
    if (!header || !panel) return;
    setIsHeaderStuck(
      header.getBoundingClientRect().top <=
        panel.getBoundingClientRect().top + 0.5,
    );
  }
  // Which entity's image failed to load, keyed by entity id (not URL: different
  // entities can share a Commons file), so another entity's image gets a fresh
  // attempt: a runtime 404 hides the image, not the slot for every later entity.
  const [failedEntityId, setFailedEntityId] = useState<string | null>(null);
  // Portrait photos would get cropped top and bottom by object-fit: cover in the
  // fixed-height banner, so they switch to contain (letterboxed) once the shape
  // is known. Keyed by entity id and reset during render, not in an effect
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes),
  // which would flash the previous entity's crop mode for a frame.
  const [portraitImage, setPortraitImage] = useState<{
    entityId: string | null;
    isPortrait: boolean;
  }>({
    entityId: null,
    isPortrait: false,
  });
  const [imageLoaded, setImageLoaded] = useState<{
    entityId: string | null;
    loaded: boolean;
  }>({
    entityId: null,
    loaded: false,
  });
  // The panel stays mounted (web/docs/adr/0006) so its close slide has a frame to
  // animate: `member` goes null the instant a close is requested, so content
  // keeps rendering from the last non-null member during the slide-out.
  const isOpen = member !== null;
  const [lastMember, setLastMember] = useState<DetailPanelMember | null>(null);
  if (member && member !== lastMember) setLastMember(member);
  const displayedMember = member ?? lastMember;
  const displayedEntity = displayedMember?.entity ?? null;
  const profileView = displayedMember?.profileView;

  const selectedEntityId = displayedEntity?.entity.id ?? null;
  if (portraitImage.entityId !== selectedEntityId) {
    setPortraitImage({ entityId: selectedEntityId, isPortrait: false });
  }
  if (imageLoaded.entityId !== selectedEntityId) {
    setImageLoaded({ entityId: selectedEntityId, loaded: false });
  }

  // A Connection swaps the entity inside an already-scrolled panel; the new
  // one starts at its top.
  useEffect(() => {
    if (selectedEntityId) panelRef.current?.scrollTo?.({ top: 0 });
  }, [selectedEntityId]);

  useEffect(() => {
    if (!isOpen) return;

    // Recorded on pointerdown, consumed on pointerup: closing is decided at
    // release, so a drag-to-pan that starts outside the panel can prove itself a
    // drag first.
    let pressStart: { x: number; y: number } | null = null;

    function handlePointerDown(event: PointerEvent) {
      pressStart = { x: event.clientX, y: event.clientY };
    }

    function handlePointerUp(event: PointerEvent) {
      const start = pressStart;
      pressStart = null;
      if (!panelRef.current || panelRef.current.contains(event.target as Node))
        return;
      // The mobile backdrop button (below) owns its onClick. Closing here first
      // would unmount it before the browser's trailing click, which would then land
      // on whatever mark is exposed underneath. Same reasoning as the mark deferral
      // below.
      if (backdropRef.current?.contains(event.target as Node)) return;
      // A pointerdown on a mark fires before the click that follows it
      // (TimelineCanvas's delegated listener), and that click always re-selects,
      // even the entity already open. Closing here first would unmount the panel just
      // before the click reopens it, a close/reopen flash. Leave the next selection
      // to the mark's click.
      // Hit-tested at the release position, not event.target: a mouse press on
      // the canvas captures the pointer there (TimelineCanvas's drag-to-pan), which
      // retargets this pointerup to the canvas itself, hiding the mark under it.
      const target =
        document.elementFromPoint?.(event.clientX, event.clientY) ??
        (event.target as Element | null);
      if (target?.closest?.('[data-entity-id]')) return;
      // Keep the Selection in the language link's href until it navigates.
      if (target?.closest?.('[data-switch-language]')) return;
      if (start) {
        const moved = Math.hypot(
          event.clientX - start.x,
          event.clientY - start.y,
        );
        if (moved > OUTSIDE_PRESS_DRAG_THRESHOLD_PX) return;
      }
      onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      // Escape belongs to an open modal (Filters Panel, Help, About) first.
      if (
        event.key === 'Escape' &&
        !document.querySelector('[aria-modal="true"]')
      )
        onClose();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const content = displayedEntity ? buildDrawerContent(displayedEntity) : null;
  const showImage =
    Boolean(content?.image) && displayedEntity?.entity.id !== failedEntityId;
  const panelClassName = [styles.panel, isOpen && styles.open]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      {isOpen && (
        <button
          ref={backdropRef}
          type="button"
          className={styles.backdrop}
          aria-label={m.closeAriaLabel()}
          onClick={onClose}
        />
      )}
      <aside
        ref={panelRef}
        className={panelClassName}
        aria-label={
          content ? m.detailsAriaLabel({ name: content.name }) : undefined
        }
        inert={!isOpen}
        onScroll={handleScroll}
      >
        {content && displayedEntity && (
          <>
            <button
              type="button"
              onClick={onClose}
              aria-label={m.closeDetailsAriaLabel()}
              className={styles.closeButton}
            >
              ×
            </button>
            {showImage && (
              <div
                className={`${styles.imageSlot} ${profileView ? styles.imageSlotProfile : ''} ${imageLoaded.loaded ? '' : styles.imageSlotLoading}`}
              >
                {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: onLoad/onError are resource-loading callbacks, not user-interaction handlers */}
                <img
                  key={`image-${selectedEntityId}`}
                  src={`${content.image}?width=${IMAGE_BANNER_WIDTH_PX}`}
                  alt={content.name}
                  loading="lazy"
                  className={`${styles.image} ${portraitImage.isPortrait ? styles.imageContain : ''} ${imageLoaded.loaded ? styles.imageLoaded : ''}`}
                  onLoad={(event) => {
                    const img = event.currentTarget;
                    if (img.naturalHeight > img.naturalWidth) {
                      setPortraitImage((prev) => ({
                        ...prev,
                        isPortrait: true,
                      }));
                    }
                    setImageLoaded((prev) => ({ ...prev, loaded: true }));
                  }}
                  onError={() => setFailedEntityId(displayedEntity.entity.id)}
                />
              </div>
            )}
            <div key={`body-${selectedEntityId}`} className={styles.body}>
              {showImage && content.imageAttribution && (
                <p className={styles.imageAttribution}>
                  {content.imageAttribution}
                </p>
              )}
              <header
                ref={headerRef}
                className={`${styles.header} ${isHeaderStuck ? styles.headerStuck : ''}`}
              >
                <h2 className={styles.name}>{content.name}</h2>
                {content.dateLine && (
                  <p className={styles.dateLine}>{content.dateLine}</p>
                )}
                <p className={styles.tagline}>{content.tagline}</p>
              </header>
              {displayedMember?.isHidden && (
                <p className={styles.hiddenNote}>{m.hiddenByFiltersNote()}</p>
              )}
              {profileView?.status === 'ready' && (
                <ProfileView
                  profile={profileView.profile}
                  color={profileView.color}
                  connections={profileView.connections}
                  anchor={displayedMember?.anchor}
                  onOpenConnection={onOpenConnection}
                />
              )}
              {profileView?.status === 'loading' && (
                <div className={styles.profilePlaceholder} aria-busy="true" />
              )}
              {(!profileView || profileView.status === 'failed') && (
                <>
                  {content.description && (
                    <p className={styles.description}>{content.description}</p>
                  )}
                  {!profileView && (
                    <a
                      href={content.wikipediaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.wikipediaButton}
                    >
                      {m.readOnWikipedia()}
                    </a>
                  )}
                </>
              )}
            </div>
            {profileView && (
              <div className={styles.footer}>
                <a
                  href={content.wikipediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.footerButton}
                >
                  {m.readOnWikipedia()}
                </a>
              </div>
            )}
          </>
        )}
      </aside>
    </>
  );
}
