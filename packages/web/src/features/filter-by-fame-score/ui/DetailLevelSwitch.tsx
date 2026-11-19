import { useEffect, useId, useRef, useState } from 'react';
import {
  DETAIL_LEVELS,
  type DetailLevel,
  type DetailLevelId,
} from '../../../shared/config';
import { m } from '../../../shared/paraglide/messages.js';
import styles from './DetailLevelSwitch.module.css';

interface DetailLevelSwitchProps {
  selectedLevelId: DetailLevelId;
  onSelectLevel: (level: DetailLevel) => void;
  loadingLevelIds: DetailLevelId[];
}

function Pips({ count }: { count: number }) {
  return (
    <span className={styles.pips} aria-hidden="true">
      {DETAIL_LEVELS.map((level, index) => (
        <span
          key={level.id}
          className={
            index < count ? `${styles.pip} ${styles.pipOn}` : styles.pip
          }
        />
      ))}
    </span>
  );
}

export function DetailLevelSwitch({
  selectedLevelId,
  onSelectLevel,
  loadingLevelIds,
}: DetailLevelSwitchProps) {
  const hintId = useId();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLFieldSetElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedIndex = Math.max(
    0,
    DETAIL_LEVELS.findIndex((level) => level.id === selectedLevelId),
  );
  const selectedLevel = DETAIL_LEVELS[selectedIndex] ?? DETAIL_LEVELS[1];
  const isLoading = loadingLevelIds.includes(selectedLevelId);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div>
      <fieldset
        ref={rootRef}
        className={styles.switch}
        aria-label={m.detailLevelAriaLabel()}
        aria-describedby={hintId}
      >
        <button
          ref={triggerRef}
          type="button"
          className={styles.trigger}
          aria-expanded={open}
          aria-controls={panelId}
          aria-busy={isLoading}
          onClick={() => setOpen((value) => !value)}
        >
          <span className={styles.label}>{m.detailLevelAriaLabel()}</span>
          <span className={styles.value}>{selectedLevel.label}</span>
          <Pips count={selectedIndex + 1} />
          <span className={styles.chevron} aria-hidden="true">
            ▾
          </span>
          {isLoading && (
            <span
              className={styles.srOnly}
              role="status"
              aria-label={m.detailLevelLoadingAriaLabel()}
            />
          )}
        </button>
        {open && (
          <div id={panelId} className={styles.panel}>
            {DETAIL_LEVELS.map((level, index) => (
              <button
                key={level.id}
                type="button"
                className={styles.row}
                aria-pressed={level.id === selectedLevelId}
                onClick={() => {
                  onSelectLevel(level);
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
              >
                <span className={styles.name}>{level.label}</span>
                <span className={styles.description}>{level.description}</span>
                <Pips count={index + 1} />
              </button>
            ))}
          </div>
        )}
      </fieldset>
      <p id={hintId} className={styles.srOnly}>
        {m.detailLevelHint()}
      </p>
    </div>
  );
}
