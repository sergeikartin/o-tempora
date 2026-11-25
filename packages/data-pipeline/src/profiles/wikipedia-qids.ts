import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { retryAfterMs } from './http-retry.ts';
import { writeJson } from './store.ts';

const ENDPOINT = 'https://en.wikipedia.org/w/api.php';

// The Action API caps `titles` at 50 per request.
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 500;
const QID_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1_000;

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

interface CachedQidEntry {
  qid: string;
  resolved_at: number;
}

function parseQidCache(value: unknown): Record<string, CachedQidEntry> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries: Record<string, CachedQidEntry> = {};
  for (const [title, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Partial<CachedQidEntry>;
    if (
      typeof item.qid === 'string' &&
      /^Q\d+$/.test(item.qid) &&
      typeof item.resolved_at === 'number' &&
      Number.isFinite(item.resolved_at)
    ) {
      entries[title] = { qid: item.qid, resolved_at: item.resolved_at };
    }
  }
  return entries;
}

export function cachedArticleQidResolver(
  profilesDir: string,
  resolve: ResolveArticleQids = resolveArticleQids,
  {
    ttlMs = QID_CACHE_TTL_MS,
    now = Date.now,
  }: { ttlMs?: number; now?: () => number } = {},
): ResolveArticleQids {
  const cacheFile = path.join(profilesDir, 'evidence', 'wikipedia-qids.json');
  return async (urls) => {
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(cacheFile, 'utf8'));
    } catch (error) {
      if (
        !(error instanceof SyntaxError) &&
        (error as NodeJS.ErrnoException).code !== 'ENOENT'
      )
        throw error;
    }
    const cache = parseQidCache(raw);
    const timestamp = now();
    const result = new Map<string, string>();
    const missing: string[] = [];
    for (const url of urls) {
      const title = titleOfArticleUrl(url);
      if (!title) continue;
      const entry = cache[title];
      if (entry && timestamp - entry.resolved_at < ttlMs) {
        result.set(url, entry.qid);
      } else {
        missing.push(url);
      }
    }
    if (!missing.length) return result;

    const fetched = await resolve(missing);
    let updated = false;
    for (const [url, qid] of fetched) {
      result.set(url, qid);
      const title = titleOfArticleUrl(url);
      if (title && /^Q\d+$/.test(qid)) {
        cache[title] = { qid, resolved_at: timestamp };
        updated = true;
      }
    }
    if (updated) await writeJson(cacheFile, cache);
    return result;
  };
}
