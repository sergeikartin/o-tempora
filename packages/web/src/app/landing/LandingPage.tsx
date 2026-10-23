import { SIBLING_LANDING_HREF, TIMELINE_HREF } from '../../shared/config';
import { m } from '../../shared/paraglide/messages.js';
import { Logo } from '../../shared/ui';
import styles from './LandingPage.module.css';
import { prefetchTimeline } from './prefetch-timeline';

export function LandingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <Logo />
        <a className={styles.navLink} href={SIBLING_LANDING_HREF}>
          {m.switchLanguageLabel()}
        </a>
      </header>
      <main className={styles.hero}>
        <h1 className={styles.headline}>{m.landingHeadline()}</h1>
        <p className={styles.subhead}>{m.landingSubhead()}</p>
        <a
          className={styles.cta}
          href={TIMELINE_HREF}
          onPointerEnter={prefetchTimeline}
          onFocus={prefetchTimeline}
          onTouchStart={prefetchTimeline}
        >
          {m.landingCta()}
        </a>
      </main>
    </div>
  );
}
