export function asRecord(
  value: unknown,
  where: string,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${where}: expected an object`);
  }
  return value as Record<string, unknown>;
}

export function asString(value: unknown, where: string): string {
  if (typeof value !== 'string' || value === '') {
    throw new Error(`${where}: expected a non-empty string`);
  }
  return value;
}

export function asArray(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${where}: expected an array`);
  return value;
}
