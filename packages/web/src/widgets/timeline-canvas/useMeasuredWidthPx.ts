import { type RefObject, useLayoutEffect, useState } from 'react';

// The element's live content width, 0 until measured. rAF-batched: at most one
// re-render per frame during a resize burst.
export function useMeasuredWidthPx(ref: RefObject<HTMLElement | null>): number {
  const [widthPx, setWidthPx] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    let latestWidth: number | undefined;
    const observer = new ResizeObserver((entries) => {
      latestWidth = entries[0]?.contentRect.width;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (latestWidth !== undefined) setWidthPx(latestWidth);
      });
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref]);
  return widthPx;
}
