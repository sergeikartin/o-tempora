// Minimal RFC4180 row parser — hand-rolled rather than adding a dependency
// (see CLAUDE.md's "flag new dependencies" rule) since the actual format
// needed is narrow: fields may be unquoted (numbers/booleans) or
// double-quoted with "" as an escaped quote, and a quoted field may itself
// contain literal commas (verified against real Pantheon rows, e.g.
// "Bahamas, The" and Joaquín ""El Chapo"" Guzmán). Does not handle embedded
// newlines inside a quoted field — verified absent from the actual
// Pantheon 2025 CSV (its row count matches its line count exactly), so the
// caller can safely split the file on "\n" before calling this per line.
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }
  fields.push(field);

  return fields;
}
