export interface MatchSplit {
  before: string;
  match: string;
  after: string;
}

// Finds the first case-insensitive occurrence of `query` in `text`,
// preserving the original text's casing in the returned pieces — used to
// bold the matched substring in a search result row (grill-with-docs
// session) without altering how the entity's own name/tagline is
// capitalized. Returns null when there's no match (e.g. a result whose
// tagline matched but this particular field didn't).
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
