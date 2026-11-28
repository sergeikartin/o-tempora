import type { CSSProperties } from 'react';
import {
  formatYear,
  formatYearMonth,
  formatYearRange,
  yearMonthToFractionalYear,
} from '../../shared/lib/date';
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
  const end = mark.end ? percentOf(curiosity, mark.end) : start;
  const isPoint =
    !mark.end ||
    yearMonthToFractionalYear(mark.end) ===
      yearMonthToFractionalYear(mark.start);
  const clipsStart = yearMonthToFractionalYear(mark.start) < windowStart;
  const clipsEnd = mark.end && yearMonthToFractionalYear(mark.end) > windowEnd;
  const style = {
    '--start': `${start}%`,
    '--span': `${end - start}%`,
    '--mark': mark.color,
    '--i': index,
  } as CSSProperties;
  const markClass = [
    isPoint ? styles.dot : styles.bar,
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
          {mark.end && !isPoint
            ? formatYearRange(mark.start.year, mark.end.year)
            : formatYearMonth(mark.start)}
        </span>
      </span>
      <span className={styles.track} aria-hidden="true">
        <span className={markClass} />
      </span>
    </div>
  );
}

export function CuriosityFigure({ curiosity }: { curiosity: Curiosity }) {
  const people = curiosity.marks.filter((mark) => mark.kind === 'person');
  const events = curiosity.marks.filter((mark) => mark.kind !== 'person');
  return (
    <figure className={styles.figure}>
      <div className={styles.chart} key={curiosity.id}>
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
      </figcaption>
    </figure>
  );
}
