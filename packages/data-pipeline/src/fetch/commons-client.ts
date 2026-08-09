// Wikimedia Commons' `action=query&prop=imageinfo` REST API — a distinct
// MediaWiki API from Wikidata's SPARQL endpoint (wikidata-client.ts), used
// only to resolve per-file license/attribution metadata for an already-known
// P18 image URI (dynamic-tooltips spec §4.2). Kept as its own client rather
// than folded into wikidata-client.ts since it's a different protocol
// entirely (plain REST query params, not a SPARQL query body).

export interface CommonsExtMetadataField {
  value: string;
}

export interface CommonsImageInfo {
  extmetadata?: {
    LicenseShortName?: CommonsExtMetadataField;
    AttributionRequired?: CommonsExtMetadataField;
    Artist?: CommonsExtMetadataField;
    Credit?: CommonsExtMetadataField;
  };
}

export interface CommonsPage {
  title?: string;
  missing?: boolean;
  imageinfo?: CommonsImageInfo[];
}

// `formatversion=2` (requested below) shapes `query.pages` as a plain
// array, not the legacy pageid-keyed object — simpler to iterate, no
// numeric-key indirection needed.
export interface CommonsImageInfoResponse {
  query?: { pages?: CommonsPage[] };
}

const ENDPOINT = "https://commons.wikimedia.org/w/api.php";

// Same courtesy identification Wikidata's own client sends (wikidata-client.ts) —
// Wikimedia asks all API traffic to self-identify.
const USER_AGENT =
  "same-sky-data-pipeline/0.1 (personal project; contact sergei.kartin@gmail.com)";

const MAX_RETRIES = 3;
// Shorter than wikidata-client.ts's 55s (which is sized to WDQS's documented
// 60s hard query deadline for a graph query): an imageinfo lookup is a plain
// indexed metadata read on a batch of titles, not a query with an unbounded
// evaluation cost, so it has no comparable server-side deadline to budget
// against.
const REQUEST_TIMEOUT_MS = 30_000;
const RETRYABLE_SERVER_ERROR_STATUSES = new Set([502, 503, 504]);
const BACKOFF_BASE_MS = 2_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isCommonsImageInfoResponse(value: unknown): value is CommonsImageInfoResponse {
  if (typeof value !== "object" || value === null) return false;
  const query = (value as Record<string, unknown>).query;
  if (query === undefined) return true;
  if (typeof query !== "object" || query === null) return false;
  const pages = (query as Record<string, unknown>).pages;
  return pages === undefined || Array.isArray(pages);
}

/**
 * Fetches `imageinfo`/`extmetadata` for up to 50 `File:`-prefixed titles in
 * one request (MediaWiki's own per-request title-batching limit for
 * unauthenticated callers), with the same 429/502-504 retry treatment
 * wikidata-client.ts's runSparqlQuery gives WDQS.
 */
export async function fetchCommonsImageInfo(
  fileTitles: string[],
  attempt = 1,
): Promise<CommonsImageInfoResponse> {
  const params = new URLSearchParams({
    action: "query",
    prop: "imageinfo",
    iiprop: "extmetadata",
    titles: fileTitles.join("|"),
    format: "json",
    formatversion: "2",
  });

  const response = await fetch(`${ENDPOINT}?${params.toString()}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (attempt <= MAX_RETRIES) {
    if (response.status === 429) {
      const retryAfterHeader = Number(response.headers.get("retry-after"));
      const retryAfterSeconds =
        Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader : 5 * attempt;
      await sleep(retryAfterSeconds * 1000);
      return fetchCommonsImageInfo(fileTitles, attempt + 1);
    }
    if (RETRYABLE_SERVER_ERROR_STATUSES.has(response.status)) {
      await sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1));
      return fetchCommonsImageInfo(fileTitles, attempt + 1);
    }
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Commons imageinfo API returned HTTP ${response.status}: ${body.slice(0, 500)}`);
  }

  const json: unknown = await response.json();
  if (!isCommonsImageInfoResponse(json)) {
    throw new Error("Commons imageinfo API response is not the expected query.pages shape.");
  }
  return json;
}
