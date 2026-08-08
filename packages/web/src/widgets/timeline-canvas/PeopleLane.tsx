import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import type { Person } from '../../shared/types';
import { DOMAIN_COLORS } from '../../shared/config';
import { assignRows, mapPeople, type PersonItem } from './map-to-items';
import {
  MIN_ROW_GAP_PX,
  PERIOD_LINE_HEIGHT,
  estimateLabelWidthPx,
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
  labelY: number;
  lineY: number;
  fill: string;
}

interface PeopleLaneProps {
  people: Person[];
  xScale: d3.ScaleLinear<number, number>;
}

// Row-stacking works in screen pixels, not years (mirrors WarsLane's
// pixelInterval) — a person's name label is left-aligned above the start of
// their lifespan line, so it can extend well past the line's own pixel span
// for a short-lived person with a long name, especially at low zoom.
function pixelInterval(item: PersonItem, xScale: d3.ScaleLinear<number, number>) {
  const x1 = xScale(item.startYear);
  const x2 = xScale(item.endYear);
  const labelWidth = estimateLabelWidthPx(item.name);
  return { start: x1, end: Math.max(x2, x1 + labelWidth) };
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
      const { start, end } = pixelInterval(item, xScale);
      return { id: item.id, startYear: start, endYear: end };
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
        return {
          id: item.id,
          name: item.name,
          x1,
          x2: Math.max(xScale(item.endYear), x1 + 2),
          labelY: personLabelYForRow(row),
          lineY: personLineCenterYForRow(row),
          fill: DOMAIN_COLORS[item.occupationDomain],
        };
      }),
    [items, rowOfPerson, xScale],
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
        g.append('line')
          .attr('class', `d3-line ${styles.line}`)
          .attr('stroke-width', PERIOD_LINE_HEIGHT)
          .attr('stroke-linecap', 'round');
        g.append('text').attr('class', `d3-name ${styles.name}`).attr('dominant-baseline', 'hanging');
        return g;
      });

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
      .text((d) => d.name);
  }, [layout]);

  return (
    <svg ref={svgRef} width={totalWidth} height={totalHeight} className={styles.svg}>
      <g className="people" />
    </svg>
  );
}
