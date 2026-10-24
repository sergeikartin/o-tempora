import type { CSSProperties } from 'react';
import { TIMELINE_HREF } from '../../shared/config';
import {
  formatYear,
  formatYearRange,
  yearMonthToFractionalYear,
} from '../../shared/lib/date';
import { entityLinkSearch } from '../../shared/lib/entity';
import { trackEvent } from '../../shared/lib/track-event';
import { m } from '../../shared/paraglide/messages.js';
import type { YearMonth } from '../../shared/types';
import type { Curiosity, CuriosityMark } from './curiosities';
import styles from './LandingPage.module.css';

function axisPercent(curiosity: Curiosity, value: number): number {
  const [from, to] = curiosity.window;
  return Math.min(100, Math.max(0, ((value - from) / (to - from)) * 100));
}

function percentOf(curiosity: Curiosity, at: YearMonth): number {
  return axisPercent(curiosity, yearMonthToFractionalYear(at));
}

function MarkRow({
  curiosity,
  mark,
  index,
}: {
  curiosity: Curiosity;
  mark: CuriosityMark;
  index: number;
}) {
  const [windowStart, windowEnd] = curiosity.window;
  const start = percentOf(curiosity, mark.start);
  const end = percentOf(curiosity, mark.end);
  const clipsStart = yearMonthToFractionalYear(mark.start) < windowStart;
  const clipsEnd = yearMonthToFractionalYear(mark.end) > windowEnd;
  const style = {
    '--start': `${start}%`,
    '--span': `${end - start}%`,
    '--mark': mark.color,
    '--i': index,
  } as CSSProperties;
  const markClass = [
    styles.bar,
    clipsStart && styles.clipsStart,
    clipsEnd && styles.clipsEnd,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={styles.row} style={style}>
      <span className={styles.label}>
        {mark.label()}{' '}
        <span className={styles.years}>
          {formatYearRange(mark.start.year, mark.end.year)}
        </span>
      </span>
      <span className={styles.track} aria-hidden="true">
        <span className={markClass} />
      </span>
    </div>
  );
}

export function CuriosityFigure({
  curiosity,
  onLinkIntent,
}: {
  curiosity: Curiosity;
  onLinkIntent: () => void;
}) {
  const people = curiosity.marks.filter((mark) => mark.kind === 'person');
  const events = curiosity.marks.filter((mark) => mark.kind !== 'person');
  const band = curiosity.band;
  const bandStyle = band
    ? ({
        '--start': `${percentOf(curiosity, band.from)}%`,
        '--span': `${percentOf(curiosity, band.to) - percentOf(curiosity, band.from)}%`,
      } as CSSProperties)
    : undefined;

  return (
    <figure className={styles.figure}>
      <div className={styles.chart} key={curiosity.id}>
        {band && (
          <span
            className={`${styles.band} ${band.kind === 'conflict' ? styles.bandConflict : ''}`}
            style={bandStyle}
            aria-hidden="true"
          />
        )}
        {people.map((mark, i) => (
          <MarkRow
            key={mark.slug}
            curiosity={curiosity}
            mark={mark}
            index={i}
          />
        ))}
        <div className={styles.axis} aria-hidden="true">
          {curiosity.ticks.map((year) => (
            <span
              key={year}
              className={styles.tick}
              style={{ left: `${axisPercent(curiosity, year)}%` }}
            >
              {formatYear(year)}
            </span>
          ))}
        </div>
        {events.map((mark, i) => (
          <MarkRow
            key={mark.slug}
            curiosity={curiosity}
            mark={mark}
            index={people.length + i}
          />
        ))}
      </div>
      <figcaption className={styles.caption}>
        <span className={styles.captionText}>{curiosity.caption()}</span>
        <span className={styles.openOn}>
          <span className={styles.openLabel}>{m.landingOpenOnTimeline()}</span>
          {curiosity.marks.map((mark) => (
            <a
              key={mark.slug}
              className={styles.openLink}
              href={`${TIMELINE_HREF}${entityLinkSearch([mark.slug])}`}
              onPointerEnter={onLinkIntent}
              onFocus={onLinkIntent}
              onTouchStart={onLinkIntent}
              onClick={() =>
                trackEvent('landing_mark_open', { curiosity: curiosity.id })
              }
            >
              {mark.label()}
            </a>
          ))}
        </span>
      </figcaption>
    </figure>
  );
}
