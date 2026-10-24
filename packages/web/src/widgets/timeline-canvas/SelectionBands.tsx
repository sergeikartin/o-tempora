import type * as d3 from 'd3';
import styles from './SelectionBands.module.css';

export interface BandSpan {
  id: string;
  startYear: number;
  endYear: number;
  isPoint: boolean;
}

export interface BandOverlap {
  startYear: number;
  endYear: number;
}

// A month-scale overlap would be a sub-pixel sliver at normal zoom.
export const OVERLAP_BAND_MIN_WIDTH_PX = 4;

interface SelectionBandsProps {
  spans: readonly BandSpan[];
  overlap: BandOverlap | null;
  xScale: d3.ScaleLinear<number, number>;
}

// The Span Bands and Overlap Band of the Selection (CONTEXT.md): full-height
// washes behind the Marks of every lane. Rendered inside the zebra layer, which
// sits behind the lanes, spans the full scroll width and follows the zoom
// animation, so the bands stay registered with the marks through a zoom.
export function SelectionBands({
  spans,
  overlap,
  xScale,
}: SelectionBandsProps) {
  const overlapStart = overlap ? xScale(overlap.startYear) : 0;
  const overlapEnd = overlap ? xScale(overlap.endYear) : 0;
  const overlapWidth = Math.max(
    overlapEnd - overlapStart,
    OVERLAP_BAND_MIN_WIDTH_PX,
  );
  return (
    <div className={styles.bands} aria-hidden="true">
      {spans.map((span) => {
        const left = xScale(span.startYear);
        return (
          <div
            key={span.id}
            className={span.isPoint ? styles.hairline : styles.band}
            data-span-band={span.id}
            style={{
              left,
              width: span.isPoint ? undefined : xScale(span.endYear) - left,
            }}
          />
        );
      })}
      {overlap && (
        <div
          className={styles.overlap}
          data-overlap-band
          style={{
            left: (overlapStart + overlapEnd) / 2 - overlapWidth / 2,
            width: overlapWidth,
          }}
        />
      )}
    </div>
  );
}
