export interface MatchSplit {
  before: string;
  match: string;
  after: string;
}

// First case-insensitive occurrence of `query` in `text`, with the original
// casing preserved in the pieces, for bolding the match in a result row.
// Null when this field has no match (e.g. only the tagline matched).
export function splitOnMatch(text: string, query: string): MatchSplit | null {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return null;
  const index = text.toLowerCase().indexOf(trimmedQuery.toLowerCase());
  if (index === -1) return null;
  return {
    before: text.slice(0, index),
    match: text.slice(index, index + trimmedQuery.length),
    after: text.slice(index + trimmedQuery.length),
  };
}
