import { type RefObject, useEffect, useRef } from 'react';

const FOCUSABLE = 'button, a[href], input, [tabindex]:not([tabindex="-1"])';

// For a surface that promises `aria-modal="true"`: moves focus to
// `initialFocusRef` on open, traps Tab/Shift+Tab inside `panelRef`, calls
// `onClose` on Escape, and gives focus back to whatever held it before.
export function useModalFocus({
  isOpen,
  panelRef,
  initialFocusRef,
  onClose,
}: {
  isOpen: boolean;
  panelRef: RefObject<HTMLElement | null>;
  initialFocusRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    initialFocusRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable =
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
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
  }, [isOpen, onClose, panelRef, initialFocusRef]);
}
