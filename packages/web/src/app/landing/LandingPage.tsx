import { useState } from 'react';
import { SIBLING_LANDING_HREF, TIMELINE_HREF } from '../../shared/config';
import { m } from '../../shared/paraglide/messages.js';
import { Logo } from '../../shared/ui';
import { CuriosityFigure } from './CuriosityFigure';
import { CURIOSITIES } from './curiosities';
import styles from './LandingPage.module.css';
import { prefetchTimeline } from './prefetch-timeline';

export function LandingPage() {
  const [activeId, setActiveId] = useState(CURIOSITIES[0].id);
  const active =
    CURIOSITIES.find((curiosity) => curiosity.id === activeId) ??
    CURIOSITIES[0];

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
              onClick={() => setActiveId(curiosity.id)}
            >
              {curiosity.chip()}
            </button>
          ))}
        </fieldset>
        <CuriosityFigure curiosity={active} onLinkIntent={prefetchTimeline} />
      </main>
      <footer className={styles.footer}>{m.landingAttribution()}</footer>
    </div>
  );
}
