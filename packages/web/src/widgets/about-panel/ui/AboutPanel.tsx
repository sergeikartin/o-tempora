import { useEffect, useRef } from 'react';
import { m } from '../../../shared/paraglide/messages.js';
import styles from './AboutPanel.module.css';

interface AboutPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const GITHUB_REPO_URL = 'https://github.com/sergeikartin/same-sky';
const CODE_LICENSE_URL = `${GITHUB_REPO_URL}/blob/main/LICENSE`;
const DATA_LICENSE_URL = `${GITHUB_REPO_URL}/blob/main/packages/shared-types/LICENSE-DATA.md`;

// Citations stay in their original (untranslated) form across locales, same
// convention as the DOI/author string in LICENSE-DATA.md.
const PANTHEON_CITATION =
  'Yu, A. Z., et al. (2016). Pantheon 1.0, a manually verified dataset of globally famous biographies. Scientific Data 2:150075.';

// Centered modal, not the off-canvas drawer/slide-in pattern Sidebar and
// DetailPanel use — About is opened rarely and has nothing underneath it to
// stay anchored to, so a plain conditional mount (no always-mounted/open
// class dance) is enough.
export function AboutPanel({ isOpen, onClose }: AboutPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // aria-modal="true" below promises assistive tech that everything outside
  // is inert — move focus in on open and trap Tab/Shift+Tab inside so that
  // promise actually holds, then give focus back to whatever opened this
  // (the sidebar's About link) on close.
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
      <button type="button" className={styles.backdrop} aria-label={m.closeAriaLabel()} onClick={onClose} />
      <div ref={panelRef} className={styles.panel} role="dialog" aria-modal="true" aria-label={m.aboutHeading()}>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label={m.closeAboutAriaLabel()}
          className={styles.closeButton}
        >
          ×
        </button>
        <h2 className={styles.heading}>{m.aboutHeading()}</h2>
        <p className={styles.description}>{m.aboutDescription()}</p>

        <h3 className={styles.sectionHeading}>{m.aboutCodeHeading()}</h3>
        <p className={styles.body}>{m.aboutCodeBody()}</p>
        <a className={styles.link} href={CODE_LICENSE_URL} target="_blank" rel="noreferrer">
          {m.aboutViewOnGithub()}
        </a>

        <h3 className={styles.sectionHeading}>{m.aboutDataHeading()}</h3>
        <p className={styles.body}>{m.aboutDataPeopleBody()}</p>
        <p className={styles.citation}>{PANTHEON_CITATION}</p>
        <p className={styles.body}>{m.aboutDataEventsBody()}</p>
        <a className={styles.link} href={DATA_LICENSE_URL} target="_blank" rel="noreferrer">
          {m.aboutViewDataLicense()}
        </a>
      </div>
    </>
  );
}
