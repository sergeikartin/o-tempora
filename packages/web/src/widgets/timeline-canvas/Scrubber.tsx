import {
  type PointerEvent as ReactPointerEvent,
  type Ref,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { m } from '../../shared/paraglide/messages.js';
import { centuryStripTicks } from './minimap';
import { buildXScale, REFERENCE_PIXELS_PER_YEAR } from './options';
import styles from './Scrubber.module.css';
import { useMeasuredWidthPx } from './useMeasuredWidthPx';

// Mirrors --scrubber-thumb-min-width in Scrubber.module.css: the visible floor
// for a thumb whose span is a sliver of the whole range.
const THUMB_MIN_WIDTH_PX = 16;

export interface ScrubberHandle {
  // Moves the thumb straight in the DOM: the live source during a pinch or
  // zoom animation, where nothing commits to React state until the gesture
  // settles.
  setViewport: (startYear: number, endYear: number) => void;
}

interface ScrubberProps {
  ref?: Ref<ScrubberHandle>;
  viewportStartYear: number;
  viewportEndYear: number;
  onCenterYearChange: (centerYear: number) => void;
  onCenterYearJump: (centerYear: number) => void;
}

function thumbGeometry(
  startYear: number,
  endYear: number,
  domainMinYear: number,
  domainYears: number,
): { left: string; width: string } {
  const widthRatio = Math.min((endYear - startYear) / domainYears, 1);
  const centerRatio = ((startYear + endYear) / 2 - domainMinYear) / domainYears;
  const halfMinPx = THUMB_MIN_WIDTH_PX / 2;
  return {
    width: `max(${widthRatio * 100}%, ${THUMB_MIN_WIDTH_PX}px)`,
    left: `clamp(${halfMinPx}px, ${centerRatio * 100}%, calc(100% - ${halfMinPx}px))`,
  };
}

// The phone-width stand-in for the Minimap: century ticks over the full
// pannable range with a thumb for the Viewport Range, position only. A tap on
// the track jumps there; dragging the thumb pans.
export function Scrubber({
  ref,
  viewportStartYear,
  viewportEndYear,
  onCenterYearChange,
  onCenterYearJump,
}: ScrubberProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef({
    startYear: viewportStartYear,
    endYear: viewportEndYear,
  });
  viewportRef.current = {
    startYear: viewportStartYear,
    endYear: viewportEndYear,
  };
  // Years from the pointer to the thumb's centre at grab time, so the thumb
  // doesn't snap its centre under the finger.
  const grabOffsetYearsRef = useRef<number | null>(null);

  const [domainMinYear, domainMaxYear] = useMemo(
    () => buildXScale(REFERENCE_PIXELS_PER_YEAR).scale.domain() as number[],
    [],
  ) as [number, number];
  const domainYears = domainMaxYear - domainMinYear;

  const trackWidthPx = useMeasuredWidthPx(trackRef);
  const centuryTicks = useMemo(
    () => centuryStripTicks(trackWidthPx),
    [trackWidthPx],
  );

  useImperativeHandle(
    ref,
    () => ({
      setViewport(startYear, endYear) {
        viewportRef.current = { startYear, endYear };
        const thumb = thumbRef.current;
        if (!thumb) return;
        const { left, width } = thumbGeometry(
          startYear,
          endYear,
          domainMinYear,
          domainYears,
        );
        thumb.style.left = left;
        thumb.style.width = width;
      },
    }),
    [domainMinYear, domainYears],
  );

  function yearAtPointer(clientX: number): number | null {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return null;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return domainMinYear + ratio * domainYears;
  }

  function handleTrackPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const year = yearAtPointer(event.clientX);
    if (year !== null) onCenterYearJump(year);
  }

  function handleThumbPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.stopPropagation();
    const year = yearAtPointer(event.clientX);
    if (year === null) return;
    const { startYear, endYear } = viewportRef.current;
    grabOffsetYearsRef.current = year - (startYear + endYear) / 2;
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // no-op — pointer capture can throw for an already-inactive pointerId
    }
  }

  function handleThumbPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const grabOffsetYears = grabOffsetYearsRef.current;
    if (grabOffsetYears === null) return;
    const year = yearAtPointer(event.clientX);
    if (year !== null) onCenterYearChange(year - grabOffsetYears);
  }

  function endThumbDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (grabOffsetYearsRef.current === null) return;
    grabOffsetYearsRef.current = null;
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // no-op — see handleThumbPointerDown's comment
    }
  }

  return (
    <div
      ref={trackRef}
      className={styles.track}
      data-testid="scrubber-track"
      // role="img": a bare div's generic role can't take an accessible name, and
      // like the Minimap the interaction is touch/mouse only.
      role="img"
      aria-label={m.scrubberAriaLabel()}
      onPointerDown={handleTrackPointerDown}
    >
      <div className={styles.ticks} aria-hidden="true">
        {centuryTicks.map((tick) => (
          <div
            key={tick.startYear}
            className={styles.tick}
            style={{ left: `${tick.leftPercent}%` }}
          >
            {tick.showLabel && (
              <span className={styles.tickLabel}>{tick.label}</span>
            )}
          </div>
        ))}
      </div>
      <div
        ref={thumbRef}
        className={styles.thumb}
        data-testid="scrubber-thumb"
        style={thumbGeometry(
          viewportStartYear,
          viewportEndYear,
          domainMinYear,
          domainYears,
        )}
        onPointerDown={handleThumbPointerDown}
        onPointerMove={handleThumbPointerMove}
        onPointerUp={endThumbDrag}
        onPointerCancel={endThumbDrag}
      />
    </div>
  );
}
