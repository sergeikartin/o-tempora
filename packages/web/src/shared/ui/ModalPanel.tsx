import { type ReactNode, useEffect, useRef } from 'react';
import { m } from '../paraglide/messages.js';
import styles from './ModalPanel.module.css';

interface ModalPanelProps {
  isOpen: boolean;
  onClose: () => void;
  heading: string;
  closeButtonAriaLabel: string;
  children: ReactNode;
}

// Centered modal, not the off-canvas drawer/slide-in pattern Sidebar and
// DetailPanel use — About and Help are opened rarely and have nothing
// underneath them to stay anchored to, so a plain conditional mount (no
// always-mounted/open class dance) is enough.
export function ModalPanel({
  isOpen,
  onClose,
  heading,
  closeButtonAriaLabel,
  children,
}: ModalPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // aria-modal="true" below promises assistive tech that everything outside
  // is inert — move focus in on open and trap Tab/Shift+Tab inside so that
  // promise actually holds, then give focus back to whatever opened this
  // (the sidebar's footer link) on close.
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, a[href], input, [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedRef.current?.focus();
    };
  }, [isOpen, onClose]);

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
