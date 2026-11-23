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

// The JSON object in a model reply, tolerating a code fence or a line of
// preamble around it.
export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end < start) throw new Error('reply has no JSON object');
  return JSON.parse(text.slice(start, end + 1));
}
