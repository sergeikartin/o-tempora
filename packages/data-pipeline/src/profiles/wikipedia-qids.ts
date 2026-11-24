import { retryAfterMs } from './http-retry.js';

const ENDPOINT = 'https://en.wikipedia.org/w/api.php';

// The Action API caps `titles` at 50 per request.
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 500;

const USER_AGENT =
  'o-tempora-data-pipeline/0.1 (personal project; contact sergei.kartin@gmail.com)';

const ARTICLE_URL = /^https:\/\/en\.wikipedia\.org\/wiki\/([^#?]+)$/;

// Maps English article URLs to the Wikidata QIDs of the entities behind them.
// A URL that is not a plain article link, or an article with no Wikidata item,
// is absent from the result.
export type ResolveArticleQids = (
  urls: readonly string[],
) => Promise<Map<string, string>>;

export function titleOfArticleUrl(url: string): string | undefined {
  const encoded = ARTICLE_URL.exec(url)?.[1];
  if (!encoded) return undefined;
  try {
    return decodeURIComponent(encoded).replaceAll('_', ' ');
  } catch {
    return undefined;
  }
}

interface QueryResponse {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: Record<
      string,
      { title: string; pageprops?: { wikibase_item?: string } }
    >;
  };
}

export function qidsByTitle(
  titles: readonly string[],
  response: QueryResponse,
): Map<string, string> {
  const query = response.query ?? {};
  const normalized = new Map(query.normalized?.map((n) => [n.from, n.to]));
  const redirected = new Map(query.redirects?.map((r) => [r.from, r.to]));
  const qidOfPage = new Map(
    Object.values(query.pages ?? {}).map((page) => [
      page.title,
      page.pageprops?.wikibase_item,
    ]),
  );

  const result = new Map<string, string>();
  for (const title of titles) {
    const normal = normalized.get(title) ?? title;
    const qid = qidOfPage.get(redirected.get(normal) ?? normal);
    if (qid) result.set(title, qid);
  }
  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchBatch(
  url: string,
  fetchPage: typeof fetch,
  wait: typeof sleep,
) {
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetchPage(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      if (attempt === 2) throw error;
      await wait(5_000 * 2 ** attempt);
      continue;
    }
    if (response.ok) return (await response.json()) as QueryResponse;
    const { status } = response;
    if (attempt === 2 || (status !== 429 && status < 500))
      throw new Error(`en.wikipedia.org returned HTTP ${status}`);
    await response.body?.cancel();
    const delay =
      status === 429 || status === 503
        ? retryAfterMs(response.headers.get('Retry-After'))
        : undefined;
    await wait(delay ?? 5_000 * 2 ** attempt);
  }
}

export async function resolveArticleQids(
  urls: readonly string[],
  {
    fetch: fetchPage = fetch,
    wait = sleep,
  }: {
    fetch?: typeof fetch;
    wait?: typeof sleep;
  } = {},
): Promise<Map<string, string>> {
  const titleOfUrl = new Map<string, string>();
  for (const url of urls) {
    const title = titleOfArticleUrl(url);
    if (title) titleOfUrl.set(url, title);
  }
  const titles = [...new Set(titleOfUrl.values())];

  const qidOfTitle = new Map<string, string>();
  for (let i = 0; i < titles.length; i += BATCH_SIZE) {
    if (i > 0) await wait(BATCH_DELAY_MS);
    const batch = titles.slice(i, i + BATCH_SIZE);
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      prop: 'pageprops',
      ppprop: 'wikibase_item',
      redirects: '1',
      titles: batch.join('|'),
    });
    const found = qidsByTitle(
      batch,
      await fetchBatch(`${ENDPOINT}?${params}`, fetchPage, wait),
    );
    for (const [title, qid] of found) qidOfTitle.set(title, qid);
  }

  const result = new Map<string, string>();
  for (const [url, title] of titleOfUrl) {
    const qid = qidOfTitle.get(title);
    if (qid) result.set(url, qid);
  }
  return result;
}
