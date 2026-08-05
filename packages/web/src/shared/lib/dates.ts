export function today(): Temporal.PlainDate {
  return Temporal.Now.plainDateISO();
}
