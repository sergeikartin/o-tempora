import { type ReactNode, useRef } from 'react';
import { useModalFocus } from '../lib/useModalFocus';
import { m } from '../paraglide/messages.js';
import styles from './ModalPanel.module.css';

interface ModalPanelProps {
  isOpen: boolean;
  onClose: () => void;
  heading: string;
  closeButtonAriaLabel: string;
  children: ReactNode;
}

// Centered modal, not the slide-in pattern DetailPanel uses — About and Help
// are opened rarely and have nothing underneath them to stay anchored to, so a
// plain conditional mount (no always-mounted/open class dance) is enough.
export function ModalPanel({
  isOpen,
  onClose,
  heading,
  closeButtonAriaLabel,
  children,
}: ModalPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useModalFocus({
    isOpen,
    panelRef,
    initialFocusRef: closeButtonRef,
    onClose,
  });

  if (!isOpen) return null;

  return (
    <>
      <button
        type="button"
        className={styles.backdrop}
        aria-label={m.closeAriaLabel()}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={heading}
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label={closeButtonAriaLabel}
          className={styles.closeButton}
        >
          ×
        </button>
        <h2 className={styles.heading}>{heading}</h2>
        {children}
      </div>
    </>
  );
}
