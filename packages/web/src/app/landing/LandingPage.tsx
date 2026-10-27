import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import {
  DATA_LICENSE_URL,
  GITHUB_REPO_URL,
  SIBLING_LANDING_HREF,
  TIMELINE_HREF,
} from '../../shared/config';
import { entityLinkSearch } from '../../shared/lib/entity';
import { trackEvent } from '../../shared/lib/track-event';
import { m } from '../../shared/paraglide/messages.js';
import { Logo } from '../../shared/ui';
import { CuriosityFigure } from './CuriosityFigure';
import { CURIOSITIES } from './curiosities';
import styles from './LandingPage.module.css';
import { prefetchTimeline } from './prefetch-timeline';

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path
        d={
          direction === 'left'
            ? 'M12.5 4.5 7 10l5.5 5.5'
            : 'M7.5 4.5 13 10l-5.5 5.5'
        }
      />
    </svg>
  );
}

function curiosityIdFromHash(): string | null {
  const id = window.location.hash.slice(1);
  return CURIOSITIES.some((curiosity) => curiosity.id === id) ? id : null;
}

export function LandingPage() {
  const [activeId, setActiveId] = useState(CURIOSITIES[0].id);
  const active =
    CURIOSITIES.find((curiosity) => curiosity.id === activeId) ??
    CURIOSITIES[0];

  const activeIndex = CURIOSITIES.findIndex(
    (curiosity) => curiosity.id === active.id,
  );
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [hash, setHash] = useState('');

  // The chosen curiosity lives in the hash so a reload or shared link reopens
  // it; it is read after mount because the prerendered HTML has no hash.
  useEffect(() => {
    const id = curiosityIdFromHash();
    if (id) {
      setActiveId(id);
      setHash(`#${id}`);
    }
  }, []);

  const pickIndex = (index: number, method: 'chip' | 'stepper') => {
    const next = CURIOSITIES[index];
    if (!next) return;
    trackEvent('landing_curiosity_select', { curiosity: next.id, method });
    setActiveId(next.id);
    setHash(`#${next.id}`);
    window.history.replaceState(null, '', `#${next.id}`);
  };
  const step = (delta: number) =>
    pickIndex(
      (activeIndex + delta + CURIOSITIES.length) % CURIOSITIES.length,
      'stepper',
    );

  const onChipKeyDown = (event: KeyboardEvent) => {
    const last = CURIOSITIES.length - 1;
    const target = {
      ArrowRight: activeIndex === last ? 0 : activeIndex + 1,
      ArrowDown: activeIndex === last ? 0 : activeIndex + 1,
      ArrowLeft: activeIndex === 0 ? last : activeIndex - 1,
      ArrowUp: activeIndex === 0 ? last : activeIndex - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    pickIndex(target, 'chip');
    chipRefs.current[target]?.focus();
  };

  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <Logo />
        <a className={styles.navLink} href={`${SIBLING_LANDING_HREF}${hash}`}>
          {m.switchLanguageLabel()}
        </a>
      </header>
      <main className={styles.main}>
        <div className={styles.copy}>
          <h1 className={styles.headline}>{m.landingHeadline()}</h1>
          <p className={styles.pitch}>{m.landingPitch()}</p>
          <div className={styles.ledeStack} aria-live="polite">
            {CURIOSITIES.map((curiosity) => (
              <p
                key={curiosity.id}
                className={`${styles.lede} ${curiosity.id === active.id ? styles.ledeActive : ''}`}
              >
                {curiosity.lede()}
              </p>
            ))}
          </div>
        </div>
        <a
          className={styles.cta}
          href={`${TIMELINE_HREF}${entityLinkSearch(active.marks[0]?.slug ?? null)}`}
          onPointerEnter={prefetchTimeline}
          onFocus={prefetchTimeline}
          onTouchStart={prefetchTimeline}
          onClick={() =>
            trackEvent('landing_cta_click', { curiosity: active.id })
          }
        >
          {m.landingCta()}
        </a>
        <div className={styles.picker}>
          <p className={styles.legend} id="landing-cases-label">
            {m.landingCasesLabel()}
          </p>
          <div
            className={styles.chips}
            role="toolbar"
            aria-labelledby="landing-cases-label"
          >
            {CURIOSITIES.map((curiosity, index) => (
              <button
                key={curiosity.id}
                ref={(node) => {
                  chipRefs.current[index] = node;
                }}
                type="button"
                className={styles.chip}
                data-label={curiosity.chip()}
                aria-pressed={curiosity.id === active.id}
                tabIndex={curiosity.id === active.id ? 0 : -1}
                onClick={() => pickIndex(index, 'chip')}
                onKeyDown={onChipKeyDown}
              >
                {curiosity.chip()}
              </button>
            ))}
          </div>
          <div className={styles.stepper}>
            <button
              type="button"
              className={styles.stepButton}
              aria-label={m.landingPrevCase()}
              onClick={() => step(-1)}
            >
              <Chevron direction="left" />
            </button>
            <p className={styles.stepLabel}>
              <span className={styles.stepName}>{active.chip()}</span>
              <span className={styles.stepCount}>
                {activeIndex + 1} / {CURIOSITIES.length}
              </span>
            </p>
            <button
              type="button"
              className={styles.stepButton}
              aria-label={m.landingNextCase()}
              onClick={() => step(1)}
            >
              <Chevron direction="right" />
            </button>
          </div>
        </div>
        <CuriosityFigure curiosity={active} onLinkIntent={prefetchTimeline} />
      </main>
      <footer className={styles.footer}>
        <p className={styles.footerGroup}>
          <span>{m.landingFooterData()}</span>
          <a
            className={styles.footerLink}
            href={DATA_LICENSE_URL}
            target="_blank"
            rel="noreferrer"
          >
            {m.landingFooterLicense()}
          </a>
        </p>
        <p className={styles.footerGroup}>
          <span>{m.aboutMadeBy()}</span>
          <a
            className={styles.footerLink}
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noreferrer"
          >
            {m.landingFooterSource()}
          </a>
        </p>
      </footer>
    </div>
  );
}
