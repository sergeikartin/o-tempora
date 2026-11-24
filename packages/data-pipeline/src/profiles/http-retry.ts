export function retryAfterMs(
  value: string | null | undefined,
): number | undefined {
  const seconds = value?.trim();
  if (seconds && /^\d+$/.test(seconds))
    return Math.min(Number(seconds), 60) * 1_000;
}
