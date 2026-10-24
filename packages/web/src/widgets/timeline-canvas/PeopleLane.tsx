import * as d3 from 'd3';
import {
  forwardRef,
  memo,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { motionDurationMs } from '../../shared/lib/motion';
import { m } from '../../shared/paraglide/messages.js';
import type { Person } from '../../shared/types';
import {
  buildPersonLayout,
  mapPeople,
  type PersonLayout,
  pinnedLabelX,
} from './map-to-items';
import {
  attachMarkJoin,
  ensureHaloChild,
  toggleSelectionHighlight,
} from './mark-join';
import { PERSON_MARK_SHAPE } from './mark-shape';
import { renderPeopleMarkupHtml } from './mark-shape-html';
import {
  HIT_AREA_PADDING_PX,
  type LabelPinningHandle,
  PERIOD_LINE_HEIGHT,
  personLaneHeight,
  zoomAnimationCounterScaleAttr,
  zoomAnimationGroupTransformAttr,
} from './options';
import styles from './PeopleLane.module.css';
import { usePinnedLabels } from './use-pinned-labels';

interface PeopleLaneProps {
  people: Person[];
  xScale: d3.ScaleLinear<number, number>;
  // Resolves visible ids to their permanent row, computed once against the full
  // unfiltered dataset (map-to-items.ts's computeRowAssignment), so a person's
  // row is stable across filter/zoom changes.
  personRowFor: (ids: string[]) => Map<string, number>;
  // The Selection's members in this lane; their marks get the selection
  // highlight, whether picked by click or search. Needs a stable identity
  // across renders that don't change the Selection.
  selectedIds?: readonly string[];
}

const NO_IDS: readonly string[] = [];

const personLabelSelector = (id: string) => `.d3-name[data-entity-id="${id}"]`;
const writeLabelX = (label: SVGTextElement, x: number) =>
  label.setAttribute('x', `${x}`);

// A person's lifespan renders as a rounded-cap line with the name label
// left-aligned just above it, colored by occupation domain. Overlapping people
// stack into rows; a label wider than its line claims the row via pixelInterval.
// memo: TimelineCanvas re-renders every rAF tick while scrolling, but none of
// these props change from that, and the D3 join is gated on [layout,
// totalHeight], so skipping the render body avoids per-frame work.
const PeopleLaneImpl = forwardRef<LabelPinningHandle, PeopleLaneProps>(
  function PeopleLane(
    { people, xScale, personRowFor, selectedIds = NO_IDS },
    ref,
  ) {
    const svgRef = useRef<SVGSVGElement>(null);
    const hasMountedRef = useRef(false);
    // Caches the zoom tick loop's selectAll across a gesture's frames; the join
    // effect, the only place marks are created/destroyed, invalidates it (null).
    const zoomNamesSelectionRef = useRef<d3.Selection<
      SVGGElement,
      unknown,
      SVGSVGElement,
      unknown
    > | null>(null);

    const items = useMemo(() => mapPeople(people), [people]);
    const rowOfPerson = useMemo(
      () => personRowFor(items.map((item) => item.id)),
      [items, personRowFor],
    );
    const rowCount =
      rowOfPerson.size > 0 ? Math.max(...rowOfPerson.values()) + 1 : 0;
    const totalHeight = personLaneHeight(rowCount);
    const totalWidth = xScale.range()[1] ?? 0;

    const layout: PersonLayout[] = useMemo(
      () => buildPersonLayout(people, xScale, personRowFor),
      [people, xScale, personRowFor],
    );

    // Frozen at mount: g.people's starting content, identical on server and
    // client (same layout, same templater, mark-shape-html.ts), so first paint shows
    // real marks. The D3 join owns every update after mount. The whole `{ __html }`
    // object is frozen because React re-applies dangerouslySetInnerHTML when its
    // reference changes, and a fresh literal per render would revert every D3
    // update.
    const [initialPeopleHtmlProp] = useState(() => ({
      __html: renderPeopleMarkupHtml(layout, styles),
    }));

    // Frozen at mount like initialPeopleHtmlProp: without a height, the <svg> is
    // padded by .bottomAlign's min-height: 100% to exactly fill .peopleLane and
    // reports no overflow (scrollHeight === clientHeight) even when rows overflow.
    // TimelineCanvas's scroll-to-bottom pin and the prerender's pre-hydration pin
    // (vite-plugins/prerender-default-viewport.ts) both read scrollHeight, so a
    // wrong pre-D3 value caused layout shift.
    const [initialSvgHeightPx] = useState(() => totalHeight);

    const { pinLabels, setItems: setPinnedLabelItems } =
      usePinnedLabels<PersonLayout>({
        svgRef,
        labelSelector: personLabelSelector,
        pinnedX: pinnedLabelX,
        writeX: writeLabelX,
      });

    // D3 owns the DOM inside <g class="people">: one <g class="d3-person"> per
    // person with its lifespan line and name label. Literal marker classes drive
    // the join's enter/update/exit matching; CSS-Module classes are styling only.
    //
    // useLayoutEffect so the write lands before paint; otherwise a filter/zoom
    // change that also touches xScale shows one stale frame.
    useLayoutEffect(() => {
      if (!svgRef.current) return;
      const svg = d3.select(svgRef.current);
      const durationMs = motionDurationMs('--motion-duration-base');

      // The zoom animation's rAF loop (imperative handle below) writes transforms
      // straight to g.people and every .d3-name, bypassing React. Reset them in the
      // same effect that lands the real geometry for a new xScale, so the commit
      // (real x/y attrs plus identity transform) is atomic and marks never flash at
      // the wrong position.
      svg.select('g.people').attr('transform', null).style('will-change', null);
      svg.selectAll('.d3-name-zoom').attr('transform', null);
      zoomNamesSelectionRef.current = null;

      // Row 0 sits at the bottom of the svg (personLabelYForRow/
      // personLineCenterYForRow compute from rowCount) and .bottomAlign bottom-aligns
      // it, so an instant height change would move every mark before the row-shift
      // transition corrects it. Transitioning height with the same duration and
      // easing makes them cancel: unchanged marks don't move, changed ones glide.
      // D3 fully owns this attribute.
      if (hasMountedRef.current) {
        svg.transition().duration(durationMs).attr('height', totalHeight);
      } else {
        svg.attr('height', totalHeight);
        hasMountedRef.current = true;
      }

      // g.people's children already exist before this effect first runs (rendered by
      // initialPeopleHtml on server and client) but carry no bound data;
      // attachMarkJoin seeds it from each node's data-entity-id, so the join adopts
      // them as `update` instead of tearing them down and fading in a fresh `enter`.
      // A person's label sits above its line (hit rect grows up from labelY), the
      // opposite of ConflictsMilestonesLane's ranges; see LineMarkGeometry.
      attachMarkJoin(
        svgRef.current,
        { groupSelector: 'g.people', nodeClass: 'd3-person' },
        PERSON_MARK_SHAPE,
        styles,
        layout,
        {
          hitX1: (d) => d.x1,
          hitY: (d) => d.labelY - HIT_AREA_PADDING_PX,
          hitHeight: (d) =>
            d.lineY +
            PERIOD_LINE_HEIGHT / 2 -
            d.labelY +
            HIT_AREA_PADDING_PX * 2,
          centerY: (d) => d.lineY,
          labelX: (d) => d.x1,
          entityType: () => 'person',
        },
      );
      // The join reset every label to its bar's start.
      setPinnedLabelItems(layout);
    }, [layout, totalHeight, setPinnedLabelItems]);

    // A DOM class toggle independent of the join: it re-scans marks by the
    // data-entity-id the click listener reads whenever the selection or mark set
    // changes. The halo line, the real .d3-line (outline plus grow-to-hover) and
    // .d3-name get different classes; see PeopleLane.module.css's
    // .searchHighlight/.searchHighlightLabel.
    useLayoutEffect(() => {
      if (!svgRef.current) return;
      for (const id of selectedIds) {
        ensureHaloChild(
          svgRef.current,
          '.d3-line',
          PERSON_MARK_SHAPE[1],
          styles,
          id,
          ['x1', 'x2', 'y1', 'y2'],
        );
      }
      // The classes exist in the compiled CSS module; indexed access reads as
      // possibly undefined only because of noUncheckedIndexedAccess.
      toggleSelectionHighlight(
        svgRef.current,
        '.d3-line-halo[data-entity-id], .d3-line[data-entity-id]',
        '.d3-name[data-entity-id]',
        selectedIds,
        styles.searchHighlight as string,
        styles.searchHighlightLabel as string,
      );
    }, [selectedIds]);

    // Called every frame by TimelineCanvas's single rAF driver (mechanism in
    // options.ts's ZoomAnimationTransform). Bound data is already on the DOM nodes,
    // but a fresh selectAll per tick is wasted work, so it is queried once and
    // cached in zoomNamesSelectionRef until the join effect invalidates it.
    useImperativeHandle(
      ref,
      () => ({
        pinLabelsToViewport: pinLabels,
        beginZoomAnimation() {
          if (!svgRef.current) return;
          d3.select(svgRef.current)
            .select('g.people')
            .style('will-change', 'transform');
        },
        applyZoomTransform(transform) {
          if (!svgRef.current) return;
          const svg = d3.select(svgRef.current);
          svg
            .select('g.people')
            .attr('transform', zoomAnimationGroupTransformAttr(transform));
          zoomNamesSelectionRef.current ??= svg.selectAll<SVGGElement, unknown>(
            '.d3-name-zoom',
          );
          zoomNamesSelectionRef.current.attr(
            'transform',
            zoomAnimationCounterScaleAttr(transform.sx),
          );
        },
      }),
      [pinLabels],
    );

    return (
      <div className={styles.bottomAlign}>
        <svg
          ref={svgRef}
          width={totalWidth}
          height={initialSvgHeightPx}
          className={styles.svg}
          role="img"
          aria-label={m.peopleHeading()}
        >
          <g
            className="people"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: initialPeopleHtmlProp is our own pure templater's output (mark-shape-html.ts), not user input — see its own comment for why this exists at all.
            dangerouslySetInnerHTML={initialPeopleHtmlProp}
          />
        </svg>
      </div>
    );
  },
);
export const PeopleLane = memo(PeopleLaneImpl);
