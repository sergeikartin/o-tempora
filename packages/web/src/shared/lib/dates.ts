// toLegacyDate() is the sole legacy-Date construction point in this app
// (Invariant 4, code-standards.md's Timeline Rendering rules) and must only
// be called from within widgets/timeline-canvas/.

export function yearToPlainDate(year: number): Temporal.PlainDate {
  return Temporal.PlainDate.from({ year, month: 1, day: 1 });
}

export function today(): Temporal.PlainDate {
  return Temporal.Now.plainDateISO();
}

export function toLegacyDate(date: Temporal.PlainDate): Date {
  const legacy = new Date(0);
  legacy.setFullYear(date.year, date.month - 1, date.day);
  legacy.setHours(0, 0, 0, 0);
  return legacy;
}
