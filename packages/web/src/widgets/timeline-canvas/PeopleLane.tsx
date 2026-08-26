import * as d3 from 'd3';
import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { motionDurationMs } from '../../shared/lib/motion';
import { m } from '../../shared/paraglide/messages.js';
import type { Person } from '../../shared/types';
import {
  buildPersonLayout,
  mapPeople,
  type PersonLayout,
} from './map-to-items';
import { buildMarkChildren, PERSON_MARK_SHAPE } from './mark-shape';
import {
  HIT_AREA_PADDING_PX,
  PERIOD_LINE_HEIGHT,
  personLaneHeight,
  type ZoomAnimationHandle,
  zoomAnimationCounterScaleAttr,
  zoomAnimationGroupTransformAttr,
} from './options';
import styles from './PeopleLane.module.css';

interface PeopleLaneProps {
  people: Person[];
  xScale: d3.ScaleLinear<number, number>;
  // Resolves this lane's currently-visible ids to their Row Depth — backed
  // by a permanent row identity computed once against the full (unfiltered)
  // dataset (see map-to-items.ts's computeRowAssignment), so a person's row
  // stays stable across every filter/zoom change instead of being
  // re-derived from whatever's currently visible.
  personRowFor: (ids: string[]) => Map<string, number>;
  // The currently-selected entity's id (DetailPanel is open for it), or null
  // — CONTEXT.md's Search entry: picking a result highlights its mark, tied
  // to selection state rather than a timer. Extended to every selection
  // source (not just search), since the mechanism is identical either way.
  selectedId?: string | null;
}

// A person's lifespan (a Period) renders as a rounded-cap line, not a solid
// bar — their name label sits left-aligned just above it, the same
// above-line treatment every Period gets, colored to match the lifespan
// line's own occupation-domain fill. Overlapping people are stacked into
// separate rows same as before; a colliding label (wider than its own line)
// claims the row via pixelInterval above rather than moving to its own band.
export const PeopleLane = forwardRef<ZoomAnimationHandle, PeopleLaneProps>(
  function PeopleLane({ people, xScale, personRowFor, selectedId }, ref) {
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
      () => buildPersonLayout(people, xScale, personRowFor),
      [people, xScale, personRowFor],
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
            // Children built from PERSON_MARK_SHAPE, in its declared order —
            // hit rect, selection rings, the lifespan line, then the
            // zoom-wrapped name label — see mark-shape.ts's own comments for
            // why each is shaped the way it is.
            const [hit, lineRingOuter, lineRingGap, line, name] =
              buildMarkChildren(g, PERSON_MARK_SHAPE, styles);
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
            lineRingOuter.attr('y1', (d) => d.lineY).attr('y2', (d) => d.lineY);
            lineRingGap.attr('y1', (d) => d.lineY).attr('y2', (d) => d.lineY);
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

      // The ring/gap lines only need x1/x2 kept in sync with the real line
      // (their y and stroke-width are fixed at creation). They're
      // pointer-events: none (PeopleLane.module.css) so carrying the same
      // data-entity-id as the real line never makes them a click/hover
      // target — it's only there so the selection effect below can find
      // them by the same selector pattern every other mark uses.
      personGroups
        .select<SVGLineElement>('.d3-line-ring-outer')
        .attr('x1', (d) => d.x1)
        .attr('x2', (d) => d.x2)
        .attr('data-entity-id', (d) => d.id)
        .transition()
        .duration(durationMs)
        .attr('y1', (d) => d.lineY)
        .attr('y2', (d) => d.lineY);

      personGroups
        .select<SVGLineElement>('.d3-line-ring-gap')
        .attr('x1', (d) => d.x1)
        .attr('x2', (d) => d.x2)
        .attr('data-entity-id', (d) => d.id)
        .transition()
        .duration(durationMs)
        .attr('y1', (d) => d.lineY)
        .attr('y2', (d) => d.lineY);

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

    // A plain DOM class toggle, decoupled from the join above (its
    // enter/update/exit selections aren't touched) — every mark carries the
    // same data-entity-id the delegated click listener already reads, so
    // this just re-scans them whenever the selection or the mark set itself
    // changes, rather than threading a "am I selected" flag through the
    // join's own data binding. The ring/gap lines and the real .d3-line (the
    // lifespan mark's selection outline plus its own grow-to-hover-size) and
    // .d3-name (its label) get different classes — see PeopleLane.module.
    // css's .searchHighlight/.searchHighlightLabel for why the outline can't
    // just apply to both.
    useLayoutEffect(() => {
      if (!svgRef.current) return;
      const svg = svgRef.current;
      // The classes always exist in the compiled CSS module — the indexed
      // access only reads as possibly-undefined because of
      // noUncheckedIndexedAccess, not because they might really be missing.
      const toggleHighlight = (selector: string, className: string) => {
        for (const el of svg.querySelectorAll(selector)) {
          el.classList.toggle(
            className,
            el.getAttribute('data-entity-id') === selectedId,
          );
        }
      };
      toggleHighlight(
        '.d3-line-ring-outer[data-entity-id], .d3-line-ring-gap[data-entity-id], .d3-line[data-entity-id]',
        styles.searchHighlight as string,
      );
      toggleHighlight(
        '.d3-name[data-entity-id]',
        styles.searchHighlightLabel as string,
      );
    }, [selectedId]);

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
