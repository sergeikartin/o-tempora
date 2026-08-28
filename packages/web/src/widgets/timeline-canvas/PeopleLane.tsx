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
} from './map-to-items';
import { attachMarkJoin, toggleSelectionHighlight } from './mark-join';
import { PERSON_MARK_SHAPE } from './mark-shape';
import { renderPeopleMarkupHtml } from './mark-shape-html';
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
// memo: props stay referentially stable across scroll/pan frames (TimelineCanvas
// re-renders every rAF tick while scrolling, but none of people/xScale/
// personRowFor/selectedId change from that) — without this, the whole render
// body (and React's reconciliation of its output) reruns on every such frame
// for nothing, since the D3 join below is already separately gated on [layout,
// totalHeight].
const PeopleLaneImpl = forwardRef<ZoomAnimationHandle, PeopleLaneProps>(
  function PeopleLane({ people, xScale, personRowFor, selectedId }, ref) {
    const svgRef = useRef<SVGSVGElement>(null);
    const hasMountedRef = useRef(false);
    // Caches the zoom tick loop's own selectAll (see applyZoomTransform
    // below) across an entire gesture's worth of rAF frames — invalidated
    // (set null) by the join effect below, the only place marks are
    // created/destroyed, so a stale cache never outlives the DOM nodes it
    // points at.
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

    // Frozen at mount (the lazy initializer runs once, ever) — g.people's
    // real starting content, identical on server and client since both
    // derive it from the same layout via the same shared templater
    // (mark-shape-html.ts). Never recomputed on a later `layout` change: the
    // D3 join below owns every update after mount, same as it always has —
    // this only exists so first paint (server or client, before that join
    // has ever run) already shows real marks instead of an empty <g>. The
    // whole `{ __html }` object (not just the string) is frozen here — React
    // re-applies dangerouslySetInnerHTML whenever that object's *reference*
    // changes, and a fresh `{ __html: x }` literal in the JSX below would be
    // a new reference on every render, re-stomping every D3 update since
    // mount (this is what a zoom animation's re-render was doing before this
    // fix — reverting every mark straight back to its frozen starting
    // position).
    const [initialPeopleHtmlProp] = useState(() => ({
      __html: renderPeopleMarkupHtml(layout, styles),
    }));

    // Frozen at mount, same reasoning as initialPeopleHtmlProp above: without
    // it, the <svg> below has no height at all on first paint (server or
    // client, before the D3 effect below has ever run) — .bottomAlign's
    // min-height: 100% then pads it up to fill .peopleLane's box exactly,
    // reporting as *not overflowing* (scrollHeight === clientHeight) even
    // though the real row count does overflow. TimelineCanvas.tsx's own
    // scroll-to-bottom pin (and the prerender build step's matching
    // pre-hydration pin, vite-plugins/prerender-default-viewport.ts) both
    // read scrollHeight to do that, so a wrong pre-D3 scrollHeight here was
    // the actual root cause of the CLS/forced-reflow regression the vertical
    // scroll-jump piece of that ticket kept finding (.scratch/
    // prerender-default-viewport/issues/06) — not PeopleLane's D3 mount
    // effect below, which was already applying the correct height
    // synchronously (no transition) on first mount, just one commit later.
    const [initialSvgHeightPx] = useState(() => totalHeight);

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
      svg.select('g.people').attr('transform', null).style('will-change', null);
      svg.selectAll('.d3-name-zoom').attr('transform', null);
      zoomNamesSelectionRef.current = null;

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

      // g.people's real children are already there before this effect's
      // first run — rendered by the initialPeopleHtml dangerouslySetInnerHTML
      // above, on both server and client — but carry no bound data yet;
      // attachMarkJoin seeds it from each node's own data-entity-id before
      // its keyed join, so it adopts them as `update` instead of tearing
      // them down and fading in a fresh `enter`. Person's label sits above
      // its lifespan line (hit rect grows up from labelY), the opposite of
      // ConflictsMilestonesLane's ranges — see LineMarkGeometry's own
      // comment for why this varies per mark kind.
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
      // The classes always exist in the compiled CSS module — the indexed
      // access only reads as possibly-undefined because of
      // noUncheckedIndexedAccess, not because they might really be missing.
      toggleSelectionHighlight(
        svgRef.current,
        '.d3-line-ring-outer[data-entity-id], .d3-line-ring-gap[data-entity-id], .d3-line[data-entity-id]',
        '.d3-name[data-entity-id]',
        selectedId,
        styles.searchHighlight as string,
        styles.searchHighlightLabel as string,
      );
    }, [selectedId]);

    // TimelineCanvas's single rAF driver calls this every animation-frame
    // tick, once per lane/axis — see options.ts's ZoomAnimationTransform
    // comment for the mechanism. The marks' data is already bound to their
    // DOM nodes from the join above, so re-selecting picks it back up for
    // free — but a fresh selectAll DOM query every tick is still wasted work
    // across a gesture's worth of frames, so it's queried once and cached in
    // zoomNamesSelectionRef until the join effect invalidates it.
    useImperativeHandle(
      ref,
      () => ({
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
      [],
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
