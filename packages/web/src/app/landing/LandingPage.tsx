import { useEffect, useRef, useState } from 'react';
import {
  DATA_LICENSE_URL,
  GITHUB_REPO_URL,
  SIBLING_LANDING_HREF,
  TIMELINE_HREF,
} from '../../shared/config';
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

export function LandingPage() {
  const [activeId, setActiveId] = useState(CURIOSITIES[0].id);
  const active =
    CURIOSITIES.find((curiosity) => curiosity.id === activeId) ??
    CURIOSITIES[0];

  const activeIndex = CURIOSITIES.findIndex(
    (curiosity) => curiosity.id === active.id,
  );
  const figureRef = useRef<HTMLElement>(null);
  const picked = useRef(false);

  const pick = (id: string) => {
    picked.current = true;
    setActiveId(id);
  };
  const step = (delta: number) => {
    const next =
      (activeIndex + delta + CURIOSITIES.length) % CURIOSITIES.length;
    pick(CURIOSITIES[next].id);
  };

  // On a phone the figure sits below the chips; reveal it after a pick so the
  // tap visibly answers.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on each pick
  useEffect(() => {
    if (!picked.current) return;
    picked.current = false;
    const reduceMotion = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    figureRef.current?.scrollIntoView?.({
      block: 'nearest',
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [activeId]);

  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <Logo />
        <a className={styles.navLink} href={SIBLING_LANDING_HREF}>
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
          href={TIMELINE_HREF}
          onPointerEnter={prefetchTimeline}
          onFocus={prefetchTimeline}
          onTouchStart={prefetchTimeline}
        >
          {m.landingCta()}
        </a>
        <fieldset className={styles.chips}>
          <legend className={styles.legend}>{m.landingCasesLabel()}</legend>
          {CURIOSITIES.map((curiosity) => (
            <button
              key={curiosity.id}
              type="button"
              className={styles.chip}
              data-label={curiosity.chip()}
              aria-pressed={curiosity.id === active.id}
              onClick={() => pick(curiosity.id)}
            >
              {curiosity.chip()}
            </button>
          ))}
        </fieldset>
        <CuriosityFigure
          curiosity={active}
          onLinkIntent={prefetchTimeline}
          figureRef={figureRef}
        >
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
        </CuriosityFigure>
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
