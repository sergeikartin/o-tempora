import { fetchArticlePageviews } from './pageviews-client.js';
import {
  PAGEVIEWS_LANGUAGES,
  type PageviewsLanguage,
} from './pageviews-languages.js';

// The Pageviews API takes one article per request, so pace groups of requests.
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Pageviews expects a bare title, while Wikidata supplies the full article URL.
export function extractWikipediaArticleTitle(
  articleUrl: string,
): string | undefined {
  let pathname: string;
  try {
    pathname = new URL(articleUrl).pathname;
  } catch {
    return undefined;
  }
  const title = decodeURIComponent(pathname.split('/').pop() ?? '');
  return title || undefined;
}

export interface PageviewsWindow {
  startYYYYMM01: string;
  endYYYYMM01: string;
}

export function trailingFourYearWindow(
  now: Date = new Date(),
): PageviewsWindow {
  const lastCompletedYear = now.getUTCFullYear() - 1;
  const startYear = lastCompletedYear - 3;
  return {
    startYYYYMM01: `${startYear}0101`,
    endYYYYMM01: `${lastCompletedYear}1201`,
  };
}

function projectFor(lang: PageviewsLanguage): string {
  return `${lang}.wikipedia`;
}

// A missing article or failed request contributes zero for that language so
// one lookup failure cannot drop the entity from the score.
export async function batchedPageviewsFetch(
  entries: Array<{
    id: string;
    articleUrls: Partial<Record<PageviewsLanguage, string>>;
  }>,
  window: PageviewsWindow = trailingFourYearWindow(),
): Promise<Map<string, number>> {
  const calls: Array<{ id: string; lang: PageviewsLanguage; title: string }> =
    [];
  for (const entry of entries) {
    for (const lang of PAGEVIEWS_LANGUAGES) {
      const url = entry.articleUrls[lang];
      if (!url) continue;
      const title = extractWikipediaArticleTitle(url);
      if (!title) continue;
      calls.push({ id: entry.id, lang, title });
    }
  }

  const totals = new Map<string, number>();

  for (let i = 0; i < calls.length; i += BATCH_SIZE) {
    const batch = calls.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const results = await Promise.allSettled(
      batch.map((call) =>
        fetchArticlePageviews(
          projectFor(call.lang),
          call.title,
          window.startYYYYMM01,
          window.endYYYYMM01,
        ),
      ),
    );

    let resolved = 0;
    results.forEach((result, index) => {
      const call = batch[index]!;
      if (result.status === 'fulfilled') {
        totals.set(call.id, (totals.get(call.id) ?? 0) + result.value);
        resolved += 1;
      } else {
        console.warn(
          `    pageviews call failed for ${call.id} (${call.lang}): ${(result.reason as Error).message}; treating as 0.`,
        );
      }
    });
    console.log(
      `    batch ${batchNumber}: ${resolved}/${batch.length} pageviews calls resolved`,
    );
    if (i + BATCH_SIZE < calls.length) await sleep(BATCH_DELAY_MS);
  }

  return totals;
}
