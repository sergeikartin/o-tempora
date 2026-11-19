import { type RefObject, useCallback, useRef } from 'react';

interface PinnedLabelItem {
  id: string;
  x1: number;
}

interface PinnedLabelsConfig<Item extends PinnedLabelItem> {
  svgRef: RefObject<SVGSVGElement | null>;
  labelSelector: (id: string) => string;
  pinnedX: (item: Item, scrollLeft: number) => number;
  writeX: (label: SVGTextElement, x: number) => void;
}

// Slides a lane's labels along their bars to stay readable while the bar began
// left of the viewport. Only labels whose pinned position changed are written.
// `pinLabels` is driven from the scroll position; `setItems` hands over the
// layout the D3 join just reset every label to.
export function usePinnedLabels<Item extends PinnedLabelItem>({
  svgRef,
  labelSelector,
  pinnedX,
  writeX,
}: PinnedLabelsConfig<Item>) {
  const pinnedXByIdRef = useRef(new Map<string, number>());
  const itemsRef = useRef<Item[]>([]);
  const scrollLeftRef = useRef(0);

  const pinLabels = useCallback(
    (scrollLeft: number) => {
      scrollLeftRef.current = scrollLeft;
      const svg = svgRef.current;
      if (!svg) return;
      const pinned = pinnedXByIdRef.current;
      const nextPinned = new Map<string, number>();
      const labelOf = (id: string) =>
        svg.querySelector<SVGTextElement>(labelSelector(id));
      for (const item of itemsRef.current) {
        const x = pinnedX(item, scrollLeft);
        if (x === item.x1) continue;
        nextPinned.set(item.id, x);
        if (pinned.get(item.id) !== x) {
          const label = labelOf(item.id);
          if (label) writeX(label, x);
        }
      }
      if (pinned.size > 0) {
        const x1ById = new Map(itemsRef.current.map((i) => [i.id, i.x1]));
        for (const id of pinned.keys()) {
          const x1 = x1ById.get(id);
          if (nextPinned.has(id) || x1 === undefined) continue;
          const label = labelOf(id);
          if (label) writeX(label, x1);
        }
      }
      pinnedXByIdRef.current = nextPinned;
    },
    [svgRef, labelSelector, pinnedX, writeX],
  );

  const setItems = useCallback(
    (items: Item[]) => {
      itemsRef.current = items;
      pinnedXByIdRef.current = new Map();
      pinLabels(scrollLeftRef.current);
    },
    [pinLabels],
  );

  return { pinLabels, setItems };
}
