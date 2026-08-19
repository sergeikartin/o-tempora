import * as d3 from 'd3';
import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { DOMAIN_COLORS } from '../../shared/config';
import { motionDurationMs } from '../../shared/lib/motion';
import { m } from '../../shared/paraglide/messages.js';
import type { Person } from '../../shared/types';
import { mapPeople } from './map-to-items';
import {
  estimateLabelWidthPx,
  HIT_AREA_PADDING_PX,
  PERIOD_LINE_HEIGHT,
  personLabelYForRow,
  personLaneHeight,
  personLineCenterYForRow,
  type ZoomAnimationHandle,
  zoomAnimationCounterScaleAttr,
  zoomAnimationGroupTransformAttr,
} from './options';
import styles from './PeopleLane.module.css';

interface PersonLayout {
  id: string;
  name: string;
  x1: number;
  x2: number;
  hitX2: number;
  labelY: number;
  lineY: number;
  fill: string;
}

interface PeopleLaneProps {
  people: Person[];
  xScale: d3.ScaleLinear<number, number>;
  // Resolves this lane's currently-visible ids to their Row Depth — backed
  // by a permanent row identity computed once against the full (unfiltered)
  // dataset (see map-to-items.ts's computeRowAssignment), so a person's row
  // stays stable across every filter/zoom change instead of being
  // re-derived from whatever's currently visible.
  personRowFor: (ids: string[]) => Map<string, number>;
}

// A person's lifespan (a Period) renders as a rounded-cap line, not a solid
// bar — their name label sits left-aligned just above it, the same
// above-line treatment every Period gets, colored to match the lifespan
// line's own occupation-domain fill. Overlapping people are stacked into
// separate rows same as before; a colliding label (wider than its own line)
// claims the row via pixelInterval above rather than moving to its own band.
export const PeopleLane = forwardRef<ZoomAnimationHandle, PeopleLaneProps>(
  function PeopleLane({ people, xScale, personRowFor }, ref) {
    const svgRef = useRef<SVGSVGElement>(null);
    const hasMountedRef = useRef(false);

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
      () =>
        items.map((item) => {
          const row = rowOfPerson.get(item.id) ?? 0;
          const x1 = xScale(item.startYear);
          const x2 = Math.max(xScale(item.endYear), x1 + 2);
          return {
            id: item.id,
            name: item.name,
            x1,
            x2,
            // Label is left-aligned at x1, so it never extends left of the
            // line — only right, past x2 for a short-lived person with a
            // long name.
            hitX2: Math.max(x2, x1 + estimateLabelWidthPx(item.name)),
            labelY: personLabelYForRow(row, rowCount),
            lineY: personLineCenterYForRow(row, rowCount),
            fill: DOMAIN_COLORS[item.occupationDomain],
          };
        }),
      [items, rowOfPerson, rowCount, xScale],
    );

    // D3 owns the DOM inside <g class="people"> — one <g class="d3-person">
    // per person, containing its lifespan line and name label. Literal
    // (non-CSS-Module) marker classes drive the join's enter/update/exit
    // matching; CSS-Module classes ride alongside purely for styling and are
    // never used as join selectors.
    //
    // useLayoutEffect, not useEffect: this write must land before paint,
    // otherwise a filter/zoom change that also touches xScale in the same
    // commit shows one stale frame before the marks catch up.
    useLayoutEffect(() => {
      if (!svgRef.current) return;
      const svg = d3.select(svgRef.current);
      const durationMs = motionDurationMs('--motion-duration-base');

      // A zoom animation's rAF loop (see the imperative handle below) writes
      // a transform straight to g.people and every .d3-name every tick,
      // without going through React — reset it here, in the same effect that
      // lands the real geometry for a new xScale, so the commit (real x/y
      // attrs landing + transform resetting to identity) is atomic. Landing
      // one half a frame before the other would flash the marks at the wrong
      // position for a frame (this is the deferred-state-commit pattern the
      // zoom-animation spec's post-mortem calls for).
      svg.select('g.people').attr('transform', null);
      svg.selectAll('.d3-name-zoom').attr('transform', null);

      // Row 0 sits at the *bottom* of the svg (personLabelYForRow/
      // personLineCenterYForRow both compute from rowCount, not just row), and
      // .bottomAlign bottom-aligns the svg within its wrapper — so an instant
      // height change moves every mark's on-screen position, even one whose
      // own row didn't change, before the row-shift transition below corrects
      // it back: a visible jump-then-slide. Transitioning height with the
      // exact same duration (and default easing) as the row-shift below makes
      // the two cancel out instead: a mark whose row didn't change doesn't
      // visibly move at all, and one that did glides directly, with no jump.
      // React no longer sets this attribute (removed from the <svg> JSX below)
      // so D3 fully owns it, same as every mark attribute already is.
      if (hasMountedRef.current) {
        svg.transition().duration(durationMs).attr('height', totalHeight);
      } else {
        svg.attr('height', totalHeight);
        hasMountedRef.current = true;
      }

      const personGroups = svg
        .select<SVGGElement>('g.people')
        .selectAll<SVGGElement, PersonLayout>('g.d3-person')
        .data(layout, (d) => d.id)
        .join(
          (enter) => {
            const g = enter
              .append('g')
              .attr('class', 'd3-person')
              .style('opacity', 0);
            // Invisible, oversized rect behind the line/label — the real hover
            // and click target, since a 6px line and its label are too thin
            // and too far apart (see HIT_AREA_PADDING_PX) to hit reliably on
            // their own. Appended first so it paints behind the visible marks.
            const hit = g
              .append('rect')
              .attr('class', `d3-hit ${styles.hitArea}`);
            const line = g
              .append('line')
              .attr('class', `d3-line ${styles.line}`)
              .attr('stroke-width', PERIOD_LINE_HEIGHT)
              .attr('stroke-linecap', 'round');
            // Wrapped in its own <g> (a literal marker class, not styled
            // itself) so the zoom-animation counter-scale below can target
            // that wrapper instead of .d3-name directly — .name has its own
            // `transition: transform` for the hover-grow effect, which would
            // otherwise fight the counter-scale's own per-frame writes to the
            // very same CSS property (both count as "the transform property
            // changed", so the browser's transition engine tries to smooth
            // between every animation-frame value, lagging a frame behind and
            // producing a visible width wobble/flicker instead of an exact
            // per-tick cancellation).
            const name = g
              .append('g')
              .attr('class', 'd3-name-zoom')
              .append('text')
              .attr('class', `d3-name ${styles.name}`)
              .attr('dominant-baseline', 'hanging');
            // A brand-new mark starts already at its target row — only a
            // pre-existing mark's row *change* animates (below), via the
            // shift transition on personGroups; an entering mark should just
            // fade in, not also slide in from row 0.
            hit
              .attr('y', (d) => d.labelY - HIT_AREA_PADDING_PX)
              .attr(
                'height',
                (d) =>
                  d.lineY +
                  PERIOD_LINE_HEIGHT / 2 -
                  d.labelY +
                  HIT_AREA_PADDING_PX * 2,
              );
            line.attr('y1', (d) => d.lineY).attr('y2', (d) => d.lineY);
            name.attr('y', (d) => d.labelY);
            g.transition().duration(durationMs).style('opacity', 1);
            return g;
          },
          (update) => update,
          (exit) =>
            // pointer-events: none first, so a mark that's mid-fade-out can't
            // still be hovered/clicked.
            exit
              .style('pointer-events', 'none')
              .transition()
              .duration(durationMs)
              .style('opacity', 0)
              .remove(),
        );

      // x/fill/data-* attrs apply instantly — only a row change (the y-driven
      // attrs below) animates. An entering mark already has these set (above),
      // so re-setting them here is a no-op for it and a live update for one
      // that was already on screen.
      personGroups
        .select<SVGRectElement>('.d3-hit')
        .attr('x', (d) => d.x1 - HIT_AREA_PADDING_PX)
        .attr('width', (d) => d.hitX2 - d.x1 + HIT_AREA_PADDING_PX * 2)
        .attr('data-entity-id', (d) => d.id)
        .attr('data-entity-type', 'person')
        .transition()
        .duration(durationMs)
        .attr('y', (d) => d.labelY - HIT_AREA_PADDING_PX)
        .attr(
          'height',
          (d) =>
            d.lineY +
            PERIOD_LINE_HEIGHT / 2 -
            d.labelY +
            HIT_AREA_PADDING_PX * 2,
        );

      personGroups
        .select<SVGLineElement>('.d3-line')
        .attr('x1', (d) => d.x1)
        .attr('x2', (d) => d.x2)
        .attr('stroke', (d) => d.fill)
        // Lets TimelineCanvas's delegated click listener resolve the source
        // entity (dynamic-tooltips spec §2's click-wiring architecture).
        .attr('data-entity-id', (d) => d.id)
        .attr('data-entity-type', 'person')
        .transition()
        .duration(durationMs)
        .attr('y1', (d) => d.lineY)
        .attr('y2', (d) => d.lineY);

      personGroups
        .select<SVGTextElement>('.d3-name')
        .attr('x', (d) => d.x1)
        .attr('fill', (d) => d.fill)
        // Same delegated-click wiring as the line above, so the label is an
        // equally valid click target for opening the detail drawer.
        .attr('data-entity-id', (d) => d.id)
        .attr('data-entity-type', 'person')
        .text((d) => d.name)
        .transition()
        .duration(durationMs)
        .attr('y', (d) => d.labelY);
    }, [layout, totalHeight]);

    // TimelineCanvas's single rAF driver calls this every animation-frame
    // tick, once per lane/axis — see options.ts's ZoomAnimationTransform
    // comment for the mechanism. A plain D3 re-select (not a ref/cache of the
    // `layout` array): the marks' data is already bound to their DOM nodes
    // from the join above, so re-selecting picks it back up for free.
    useImperativeHandle(
      ref,
      () => ({
        applyZoomTransform(transform) {
          if (!svgRef.current) return;
          const svg = d3.select(svgRef.current);
          svg
            .select('g.people')
            .attr('transform', zoomAnimationGroupTransformAttr(transform));
          svg
            .selectAll('.d3-name-zoom')
            .attr('transform', zoomAnimationCounterScaleAttr(transform.sx));
        },
      }),
      [],
    );

    return (
      <div className={styles.bottomAlign}>
        <svg
          ref={svgRef}
          width={totalWidth}
          className={styles.svg}
          role="img"
          aria-label={m.peopleHeading()}
        >
          <g className="people" />
        </svg>
      </div>
    );
  },
);
