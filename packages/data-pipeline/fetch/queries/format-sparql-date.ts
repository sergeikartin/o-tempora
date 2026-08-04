// Shared by every era-bucketed query builder (people, historical-events,
// inventions) for the same `[minYear, maxYearExclusive)` FILTER pattern.
export function formatYearAsSparqlDateTime(year: number): string {
  const sign = year < 0 ? "-" : "";
  const magnitude = Math.abs(year).toString().padStart(4, "0");
  return `${sign}${magnitude}-01-01T00:00:00Z`;
}
