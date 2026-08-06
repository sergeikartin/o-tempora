import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import type { Person } from '../../shared/types';
import { DOMAIN_COLORS } from '../../shared/config';
import { assignRows, mapPeople } from './map-to-items';
import { BAR_HEIGHT, LANE_TOP_PADDING, REIGN_STRIPE_COLOR, REIGN_STRIPE_HEIGHT, ROW_PITCH } from './options';
import styles from './PeopleLane.module.css';

interface PersonLayout {
  id: string;
  name: string;
  x: number;
  width: number;
  y: number;
  fill: string;
  tooltip: string;
  stripes: { id: string; x: number; width: number; tooltip: string }[];
}

interface PeopleLaneProps {
  people: Person[];
  xScale: d3.ScaleLinear<number, number>;
}

export function PeopleLane({ people, xScale }: PeopleLaneProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const items = useMemo(() => mapPeople(people), [people]);
  const rowOfPerson = useMemo(() => assignRows(items), [items]);
  const rowCount = rowOfPerson.size > 0 ? Math.max(...rowOfPerson.values()) + 1 : 0;
  const totalHeight = rowCount * ROW_PITCH + LANE_TOP_PADDING;
  const totalWidth = xScale.range()[1] ?? 0;

  const layout: PersonLayout[] = useMemo(
    () =>
      items.map((item) => {
        const row = rowOfPerson.get(item.id) ?? 0;
        return {
          id: item.id,
          name: item.name,
          x: xScale(item.startYear),
          width: Math.max(xScale(item.endYear) - xScale(item.startYear), 2),
          y: LANE_TOP_PADDING + row * ROW_PITCH,
          fill: DOMAIN_COLORS[item.occupationDomain],
          tooltip: item.tooltip,
          stripes: item.reignPeriods.map((reignPeriod) => ({
            id: reignPeriod.id,
            x: xScale(reignPeriod.startYear),
            width: Math.max(xScale(reignPeriod.endYear) - xScale(reignPeriod.startYear), 2),
            tooltip: reignPeriod.tooltip,
          })),
        };
      }),
    [items, rowOfPerson, xScale],
  );

  // D3 owns the DOM inside <g class="people"> — one <g class="d3-person">
  // per person, containing its clip-path, lifespan bar, name label, and any
  // reign-period stripes. Literal (non-CSS-Module) marker classes drive the
  // join's enter/update/exit matching; CSS-Module classes ride alongside
  // purely for styling and are never used as join selectors.
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    const personGroups = svg
      .select<SVGGElement>('g.people')
      .selectAll<SVGGElement, PersonLayout>('g.d3-person')
      .data(layout, (d) => d.id)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'd3-person');
        g.append('clipPath')
          .attr('id', (d) => `clip-${d.id}`)
          .append('rect')
          .attr('class', 'd3-clip-rect')
          .attr('height', BAR_HEIGHT)
          .attr('rx', 4);
        const bar = g.append('rect').attr('class', `d3-bar ${styles.bar}`).attr('height', BAR_HEIGHT).attr('rx', 4);
        bar.append('title');
        g.append('text').attr('class', `d3-name ${styles.name}`).attr('dominant-baseline', 'middle');
        g.append('g').attr('class', 'd3-stripes');
        return g;
      });

    personGroups
      .select<SVGRectElement>('.d3-clip-rect')
      .attr('x', (d) => d.x)
      .attr('y', (d) => d.y)
      .attr('width', (d) => d.width);

    personGroups
      .select<SVGRectElement>('.d3-bar')
      .attr('x', (d) => d.x)
      .attr('y', (d) => d.y)
      .attr('width', (d) => d.width)
      .attr('fill', (d) => d.fill);

    personGroups.select('.d3-bar title').text((d) => d.tooltip);

    personGroups
      .select<SVGTextElement>('.d3-name')
      .attr('x', (d) => d.x + 4)
      .attr('y', (d) => d.y + BAR_HEIGHT / 2)
      .attr('clip-path', (d) => `url(#clip-${d.id})`)
      .text((d) => d.name);

    personGroups.select<SVGGElement>('.d3-stripes').each(function renderStripes(personDatum) {
      d3.select(this)
        .selectAll<SVGRectElement, PersonLayout['stripes'][number]>('rect.d3-stripe')
        .data(personDatum.stripes, (d) => d.id)
        .join((enter) => {
          const rect = enter
            .append('rect')
            .attr('class', `d3-stripe ${styles.reignStripe}`)
            .attr('height', REIGN_STRIPE_HEIGHT)
            .attr('fill', REIGN_STRIPE_COLOR);
          rect.append('title');
          return rect;
        })
        .attr('x', (d) => d.x)
        .attr('y', personDatum.y + BAR_HEIGHT - REIGN_STRIPE_HEIGHT)
        .attr('width', (d) => d.width)
        .select('title')
        .text((d) => d.tooltip);
    });
  }, [layout]);

  return (
    <svg ref={svgRef} width={totalWidth} height={totalHeight} className={styles.svg}>
      <g className="people" />
    </svg>
  );
}
