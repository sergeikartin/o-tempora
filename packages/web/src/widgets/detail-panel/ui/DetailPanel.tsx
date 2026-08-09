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
  const [isPortraitImage, setIsPortraitImage] = useState(false);

  useEffect(() => {
    setIsPortraitImage(false);
  }, [selected?.entity.id]);

  useEffect(() => {
    if (!selected) return;

    function handlePointerDown(event: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) onClose();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
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
          className={isPortraitImage ? `${styles.image} ${styles.imageContain}` : styles.image}
          onLoad={(event) => {
            const img = event.currentTarget;
            if (img.naturalHeight > img.naturalWidth) setIsPortraitImage(true);
          }}
          onError={() => setFailedEntityId(selected.entity.id)}
        />
      )}
      <div className={styles.body}>
        {showImage && content.imageAttribution && (
          <p className={styles.imageAttribution}>{content.imageAttribution}</p>
        )}
        <h2 className={styles.name}>{content.name}</h2>
        <p className={styles.dateLine}>{content.dateLine}</p>
        <p className={styles.description}>{content.description}</p>
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
