import { useEffect, useRef, useState } from 'react';
import { buildDrawerContent, type DetailPanelEntity } from '../lib/build-drawer-content';
import styles from './DetailPanel.module.css';

interface DetailPanelProps {
  selected: DetailPanelEntity | null;
  onClose: () => void;
}

// Sized for this drawer's fixed 340px-wide panel at typical device pixel
// ratios — not load-bearing, see spec §4.1.
const IMAGE_BANNER_WIDTH_PX = 400;

// Below this much pointerdown-to-pointerup movement, an outside press is
// treated as a click (dismiss) rather than a drag-to-pan release (ignore)
// — mirrors TimelineCanvas's own DRAG_CLICK_SUPPRESSION_PX, tracked
// independently here since this widget has no visibility into that one's
// internal drag state.
const OUTSIDE_PRESS_DRAG_THRESHOLD_PX = 4;

// Click-to-open side drawer, docked to the viewport's right edge,
// decoupled from the clicked mark's screen position entirely (dynamic-
// tooltips spec §2) — no anchoring math, so panning/zooming the timeline
// underneath it needs no special handling. One global instance: App.tsx
// renders exactly one of these, swapping `selected` in place rather than
// mounting a new drawer per entity.
export function DetailPanel({ selected, onClose }: DetailPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  // Tracks which entity's image failed to load, keyed by entity id (not the
  // image URL itself — two different entities can genuinely reference the
  // same Commons file) so a different entity's image always gets a fresh
  // attempt (spec §3.1: a runtime 404 hides the image, it doesn't blank the
  // slot for every entity after).
  const [failedEntityId, setFailedEntityId] = useState<string | null>(null);
  // Portrait photos would otherwise get their top/bottom cropped by
  // object-fit: cover in the fixed-height banner — switch those to
  // contain (letterboxed on the sides) once we know the image's shape.
  // Keyed by entity id and reset during render (not in an effect) per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  // — an effect here would commit the stale flag for one extra frame,
  // flashing the previous entity's crop mode before snapping to the new one.
  const [portraitImage, setPortraitImage] = useState<{ entityId: string | null; isPortrait: boolean }>({
    entityId: null,
    isPortrait: false,
  });
  const selectedEntityId = selected?.entity.id ?? null;
  if (portraitImage.entityId !== selectedEntityId) {
    setPortraitImage({ entityId: selectedEntityId, isPortrait: false });
  }

  useEffect(() => {
    if (!selected) return;

    // Recorded on pointerdown, consumed on pointerup — closing is decided
    // at release, not press, so a drag-to-pan that starts outside the
    // panel gets a chance to prove itself a drag before we act on it.
    let pressStart: { x: number; y: number } | null = null;

    function handlePointerDown(event: PointerEvent) {
      pressStart = { x: event.clientX, y: event.clientY };
    }

    function handlePointerUp(event: PointerEvent) {
      const start = pressStart;
      pressStart = null;
      if (!panelRef.current || panelRef.current.contains(event.target as Node)) return;
      // A pointerdown on a mark fires before the click that follows it
      // (TimelineCanvas's delegated click listener, dynamic-tooltips spec
      // §2), and that click always re-selects — including re-clicking the
      // same entity already open. Closing here first would unmount the
      // panel a beat before that click reopens it, a close/reopen flash
      // most visible when the entity doesn't change. Leave the mark's own
      // click to decide the next selection instead of pre-empting it.
      const target = event.target as Element | null;
      if (target?.closest?.('[data-entity-id]')) return;
      // A drag-to-pan release also lands here (its start point is outside
      // the panel too) — only treat this as a dismiss click if the press
      // barely moved.
      if (start) {
        const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
        if (moved > OUTSIDE_PRESS_DRAG_THRESHOLD_PX) return;
      }
      onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selected, onClose]);

  if (!selected) return null;

  const content = buildDrawerContent(selected);
  const showImage = Boolean(content.image) && selected.entity.id !== failedEntityId;

  return (
    <aside ref={panelRef} className={styles.panel} aria-label={`${content.name} details`}>
      <button type="button" onClick={onClose} aria-label="Close" className={styles.closeButton}>
        ×
      </button>
      {showImage && (
        <img
          src={`${content.image}?width=${IMAGE_BANNER_WIDTH_PX}`}
          alt={content.name}
          loading="lazy"
          className={portraitImage.isPortrait ? `${styles.image} ${styles.imageContain}` : styles.image}
          onLoad={(event) => {
            const img = event.currentTarget;
            if (img.naturalHeight > img.naturalWidth) {
              setPortraitImage((prev) => ({ ...prev, isPortrait: true }));
            }
          }}
          onError={() => setFailedEntityId(selected.entity.id)}
        />
      )}
      <div className={styles.body}>
        {showImage && content.imageAttribution && (
          <p className={styles.imageAttribution}>{content.imageAttribution}</p>
        )}
        <h2 className={styles.name}>{content.name}</h2>
        {content.dateLine && <p className={styles.dateLine}>{content.dateLine}</p>}
        <p className={styles.tagline}>{content.tagline}</p>
        {content.description && <p className={styles.description}>{content.description}</p>}
        {content.reignLines && (
          <>
            <h3 className={styles.sectionHeading}>Reign periods</h3>
            <ul className={styles.reignList}>
              {content.reignLines.map((line) => (
                <li key={line} className={styles.reignItem}>
                  {line}
                </li>
              ))}
            </ul>
          </>
        )}
        <a
          href={content.wikipediaUrl}
          target="_blank"
          rel="noreferrer"
          className={styles.wikipediaButton}
        >
          Read on Wikipedia →
        </a>
      </div>
    </aside>
  );
}
