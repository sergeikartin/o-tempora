// Wikimedia's Pageviews Analytics REST API, distinct from Wikidata's SPARQL
// endpoint (wikidata-client.ts) and Commons' imageinfo API (commons-client.ts).
// Sums trailing-4-year monthly pageviews per Wikipedia article for the fameScore
// blend (docs/adr/0010-blend-sitelinks-and-pageviews-for-wars-discoveries-fame-score.md).
// Its own client because it is a different protocol (REST path segments, not a
// SPARQL body or MediaWiki action=query params).

export interface PageviewsPerArticleItem {
  views: number;
}

export interface PageviewsPerArticleResponse {
  items?: PageviewsPerArticleItem[];
}

const ENDPOINT = "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article";

// Same courtesy identification as the Wikidata and Commons clients; Wikimedia
// asks all API traffic to self-identify.
const USER_AGENT =
  "o-tempora-data-pipeline/0.1 (personal project; contact sergei.kartin@gmail.com)";

const MAX_RETRIES = 3;
// As commons-client.ts's REQUEST_TIMEOUT_MS: a per-article monthly read over a
// fixed 4-year window is an indexed metric lookup with no comparable
// server-side deadline to budget against.
const REQUEST_TIMEOUT_MS = 30_000;
const RETRYABLE_SERVER_ERROR_STATUSES = new Set([502, 503, 504]);
const BACKOFF_BASE_MS = 2_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPageviewsPerArticleResponse(value: unknown): value is PageviewsPerArticleResponse {
  if (typeof value !== "object" || value === null) return false;
  const items = (value as Record<string, unknown>).items;
  if (items === undefined) return true;
  return (
    Array.isArray(items) &&
    items.every((item) => typeof item === "object" && item !== null && typeof (item as Record<string, unknown>).views === "number")
  );
}

/**
 * Sums monthly pageviews for one article title on one Wikipedia project
 * over `[startYYYYMM01, endYYYYMM01]` (compact `YYYYMM01` dates, per the
 * per-article endpoint's date-format contract). A 404 means the API has no
 * data for that title/period — a real, expected shape for a low-traffic or
 * newer article, not a transient failure, so it's treated as 0 rather than
 * retried or thrown. Same 429/502-504 retry-with-backoff treatment
 * commons-client.ts's fetchCommonsImageInfo gives Commons.
 */
export async function fetchArticlePageviews(
  project: string,
  articleTitle: string,
  startYYYYMM01: string,
  endYYYYMM01: string,
  attempt = 1,
): Promise<number> {
  const encodedTitle = encodeURIComponent(articleTitle);
  const url = `${ENDPOINT}/${project}/all-access/all-agents/${encodedTitle}/monthly/${startYYYYMM01}/${endYYYYMM01}`;

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (response.status === 404) return 0;

  if (attempt <= MAX_RETRIES) {
    if (response.status === 429) {
      const retryAfterHeader = Number(response.headers.get("retry-after"));
      const retryAfterSeconds =
        Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader : 5 * attempt;
      await sleep(retryAfterSeconds * 1000);
      return fetchArticlePageviews(project, articleTitle, startYYYYMM01, endYYYYMM01, attempt + 1);
    }
    if (RETRYABLE_SERVER_ERROR_STATUSES.has(response.status)) {
      await sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1));
      return fetchArticlePageviews(project, articleTitle, startYYYYMM01, endYYYYMM01, attempt + 1);
    }
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Pageviews API returned HTTP ${response.status}: ${body.slice(0, 500)}`);
  }

  const json: unknown = await response.json();
  if (!isPageviewsPerArticleResponse(json)) {
    throw new Error("Pageviews API response is not the expected items shape.");
  }
  return (json.items ?? []).reduce((sum, item) => sum + item.views, 0);
}
