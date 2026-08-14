import { fetchWikipediaSummary, type WikipediaLanguage, type WikipediaSummaryResponse } from "./wikipedia-client.js";

// Wikimedia's REST summary API has no VALUES-clause batch equivalent
// (unlike Wikidata SPARQL) and asks for a gentler pace than this pipeline's
// other batch fetchers (commons-client.ts/pageviews-client.ts run 50-wide
// concurrent bursts every 500ms) — so this paces one request at a time,
// roughly 2/second, rather than reusing that burst pattern.
const REQUEST_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Strips stray Unicode control (Cc) and format (Cf) characters — e.g. the
// left-to-right mark (U+200E) Wikipedia's REST extracts sometimes carry
// around dates/numbers — that a plain .trim() alone doesn't catch, since
// they're not leading/trailing whitespace.
const CONTROL_AND_FORMAT_CHARS = /[\p{Cc}\p{Cf}]/gu;

// A disambiguation page's "extract" is a list-page blurb, not real prose —
// treated the same as no extract at all. An empty/whitespace-only extract
// (after control-character stripping) is likewise treated as absent rather
// than published as a blank string.
export function cleanExtract(summary: WikipediaSummaryResponse | undefined): string | undefined {
  if (!summary || summary.type === "disambiguation" || !summary.extract) return undefined;
  const cleaned = summary.extract.replace(CONTROL_AND_FORMAT_CHARS, "").trim();
  return cleaned || undefined;
}

export interface WikipediaExtractEntry {
  id: string;
  title: string;
}

/**
 * Resolves a Wikipedia lead-paragraph extract for each entry's title, from
 * the given language edition (English by default), keyed by the caller's
 * own entity id (not the title, which more than one entity could in
 * principle share — deduped here so a shared title is only fetched once,
 * same "dedupe before fetching" shape
 * batched-commons-image-attribution-fetch.ts uses for Commons titles). A
 * single entry's fetch failure (network error, malformed response, etc.) is
 * logged and skipped, never aborting the rest of the run — same best-effort
 * philosophy this pipeline's other batch fetchers already use. Entities
 * with no resolvable extract (404, disambiguation page, empty extract) are
 * simply absent from the returned map.
 */
export async function batchedWikipediaExtractFetch(
  entries: WikipediaExtractEntry[],
  lang: WikipediaLanguage = "en",
): Promise<Map<string, string>> {
  const titleToIds = new Map<string, string[]>();
  for (const entry of entries) {
    const ids = titleToIds.get(entry.title);
    if (ids) ids.push(entry.id);
    else titleToIds.set(entry.title, [entry.id]);
  }
  const titles = [...titleToIds.keys()];

  const extractById = new Map<string, string>();

  for (let i = 0; i < titles.length; i++) {
    const title = titles[i]!;
    try {
      const summary = await fetchWikipediaSummary(title, lang);
      const cleaned = cleanExtract(summary);
      if (cleaned) {
        for (const id of titleToIds.get(title) ?? []) extractById.set(id, cleaned);
      }
    } catch (error) {
      console.warn(`    extract fetch failed for "${title}": ${(error as Error).message}; skipping.`);
    }
    if ((i + 1) % 200 === 0) {
      console.log(`    ${i + 1}/${titles.length} titles processed (${extractById.size} extracts resolved)`);
    }
    if (i < titles.length - 1) await sleep(REQUEST_DELAY_MS);
  }

  return extractById;
}
