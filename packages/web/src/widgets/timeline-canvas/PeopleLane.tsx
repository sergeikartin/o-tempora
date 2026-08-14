import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import type { Person } from '../../shared/types';
import { DOMAIN_COLORS } from '../../shared/config';
import { assignRows, mapPeople, personPixelInterval } from './map-to-items';
import {
  estimateLabelWidthPx,
  HIT_AREA_PADDING_PX,
  MIN_ROW_GAP_PX,
  PERIOD_LINE_HEIGHT,
  personLabelYForRow,
  personLaneHeight,
  personLineCenterYForRow,
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
}

// A person's lifespan (a Period) renders as a rounded-cap line, not a solid
// bar — their name label sits left-aligned just above it, the same
// above-line treatment every Period gets, colored to match the lifespan
// line's own occupation-domain fill. Overlapping people are stacked into
// separate rows same as before; a colliding label (wider than its own line)
// claims the row via pixelInterval above rather than moving to its own band.
export function PeopleLane({ people, xScale }: PeopleLaneProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const items = useMemo(() => mapPeople(people), [people]);
  const rowOfPerson = useMemo(() => {
    const intervals = items.map((item) => {
      const { start, end } = personPixelInterval(item, xScale);
      return { id: item.id, startYear: start, endYear: end, fameScore: item.fameScore };
    });
    return assignRows(intervals, MIN_ROW_GAP_PX);
  }, [items, xScale]);
  const rowCount = rowOfPerson.size > 0 ? Math.max(...rowOfPerson.values()) + 1 : 0;
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
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    const personGroups = svg
      .select<SVGGElement>('g.people')
      .selectAll<SVGGElement, PersonLayout>('g.d3-person')
      .data(layout, (d) => d.id)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'd3-person');
        // Invisible, oversized rect behind the line/label — the real hover
        // and click target, since a 6px line and its label are too thin and
        // too far apart (see HIT_AREA_PADDING_PX) to hit reliably on their
        // own. Appended first so it paints behind the visible marks.
        g.append('rect').attr('class', `d3-hit ${styles.hitArea}`);
        g.append('line')
          .attr('class', `d3-line ${styles.line}`)
          .attr('stroke-width', PERIOD_LINE_HEIGHT)
          .attr('stroke-linecap', 'round');
        g.append('text').attr('class', `d3-name ${styles.name}`).attr('dominant-baseline', 'hanging');
        return g;
      });

    personGroups
      .select<SVGRectElement>('.d3-hit')
      .attr('x', (d) => d.x1 - HIT_AREA_PADDING_PX)
      .attr('y', (d) => d.labelY - HIT_AREA_PADDING_PX)
      .attr('width', (d) => d.hitX2 - d.x1 + HIT_AREA_PADDING_PX * 2)
      .attr('height', (d) => d.lineY + PERIOD_LINE_HEIGHT / 2 - d.labelY + HIT_AREA_PADDING_PX * 2)
      .attr('data-entity-id', (d) => d.id)
      .attr('data-entity-type', 'person');

    personGroups
      .select<SVGLineElement>('.d3-line')
      .attr('x1', (d) => d.x1)
      .attr('x2', (d) => d.x2)
      .attr('y1', (d) => d.lineY)
      .attr('y2', (d) => d.lineY)
      .attr('stroke', (d) => d.fill)
      // Lets TimelineCanvas's delegated click listener resolve the source
      // entity (dynamic-tooltips spec §2's click-wiring architecture).
      .attr('data-entity-id', (d) => d.id)
      .attr('data-entity-type', 'person');

    personGroups
      .select<SVGTextElement>('.d3-name')
      .attr('x', (d) => d.x1)
      .attr('y', (d) => d.labelY)
      .attr('fill', (d) => d.fill)
      // Same delegated-click wiring as the line above, so the label is an
      // equally valid click target for opening the detail drawer.
      .attr('data-entity-id', (d) => d.id)
      .attr('data-entity-type', 'person')
      .text((d) => d.name);
  }, [layout]);

  return (
    <div className={styles.bottomAlign}>
      <svg ref={svgRef} width={totalWidth} height={totalHeight} className={styles.svg}>
        <g className="people" />
      </svg>
    </div>
  );
}
