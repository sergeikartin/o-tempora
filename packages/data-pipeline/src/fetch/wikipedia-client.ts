// Wikipedia's REST summary API — a distinct API from Wikidata's SPARQL
// endpoint (wikidata-client.ts), Commons' imageinfo API (commons-client.ts),
// and the Pageviews Analytics API (pageviews-client.ts), used to resolve an
// entity's Wikipedia lead-paragraph prose for the `description` field
// (tagline-description-split spec). Single-title lookups only — unlike
// Wikidata's SPARQL, there's no VALUES-clause batch equivalent for this
// REST endpoint. Queried against both en.wikipedia.org and ru.wikipedia.org
// (per-language `lang` argument below) — Russian description sourcing is
// this same REST client pointed at the Russian article, not a translation
// of the English extract.

export type WikipediaLanguage = "en" | "ru";

export interface WikipediaSummaryResponse {
  // "standard" for a normal article; "disambiguation" for a disambiguation
  // page (batched-wikipedia-extract-fetch.ts treats that as no extract
  // available, not real prose); absent/other values are passed through
  // uninterpreted by this client.
  type?: string;
  extract?: string;
}

function endpoint(lang: WikipediaLanguage): string {
  return `https://${lang}.wikipedia.org/api/rest_v1/page/summary`;
}

// Same courtesy identification Wikidata's/Commons'/Pageviews' clients send
// (wikidata-client.ts, commons-client.ts, pageviews-client.ts) — Wikimedia
// asks all API traffic to self-identify.
const USER_AGENT =
  "same-sky-data-pipeline/0.1 (personal project; contact sergei.kartin@gmail.com)";

const MAX_RETRIES = 3;
// Same reasoning as commons-client.ts/pageviews-client.ts's
// REQUEST_TIMEOUT_MS: a single-title summary read is a plain indexed
// lookup, not an unbounded graph query, so it carries no comparable
// server-side deadline to budget against.
const REQUEST_TIMEOUT_MS = 30_000;
const RETRYABLE_SERVER_ERROR_STATUSES = new Set([502, 503, 504]);
const BACKOFF_BASE_MS = 2_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isWikipediaSummaryResponse(value: unknown): value is WikipediaSummaryResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.type === undefined || typeof candidate.type === "string") &&
    (candidate.extract === undefined || typeof candidate.extract === "string")
  );
}

/**
 * Fetches the REST summary (including lead-paragraph `extract`) for one
 * Wikipedia article title, in the given language edition (English by
 * default). A 404 means no article resolves for this title — a real,
 * expected shape (a redirect-less miss, a stale title), not a transient
 * failure, so it returns `undefined` rather than throwing or retrying.
 * Same 429/502-504 retry-with-backoff treatment commons-client.ts's
 * fetchCommonsImageInfo and pageviews-client.ts's fetchArticlePageviews
 * give their own APIs.
 */
export async function fetchWikipediaSummary(
  title: string,
  lang: WikipediaLanguage = "en",
  attempt = 1,
): Promise<WikipediaSummaryResponse | undefined> {
  const encodedTitle = encodeURIComponent(title);
  const url = `${endpoint(lang)}/${encodedTitle}`;

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (response.status === 404) return undefined;

  if (attempt <= MAX_RETRIES) {
    if (response.status === 429) {
      const retryAfterHeader = Number(response.headers.get("retry-after"));
      const retryAfterSeconds =
        Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader : 5 * attempt;
      await sleep(retryAfterSeconds * 1000);
      return fetchWikipediaSummary(title, lang, attempt + 1);
    }
    if (RETRYABLE_SERVER_ERROR_STATUSES.has(response.status)) {
      await sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1));
      return fetchWikipediaSummary(title, lang, attempt + 1);
    }
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Wikipedia summary API returned HTTP ${response.status}: ${body.slice(0, 500)}`);
  }

  const json: unknown = await response.json();
  if (!isWikipediaSummaryResponse(json)) {
    throw new Error("Wikipedia summary API response is not the expected shape.");
  }
  return json;
}
