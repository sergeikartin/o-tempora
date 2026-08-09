import { fetchArticlePageviews } from "./pageviews-client.js";
import { PAGEVIEWS_LANGUAGES, type PageviewsLanguage } from "./pageviews-languages.js";

// Same batch size/delay convention batched-sparql-fetch.ts and
// batched-commons-image-attribution-fetch.ts use — here it paces individual
// per-article REST calls (no VALUES-clause batching available; this is a
// REST API, not SPARQL) rather than titles= batches.
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A resolved sitelink article URL (from wars-enrichment.ts's/
// events-enrichment.ts's widened per-language OPTIONAL bindings) is a full
// `https://{lang}.wikipedia.org/wiki/<Title>` URI — the pageviews endpoint
// instead wants a bare, underscore-joined title, so this recovers it from
// the URI's last path segment (same approach commons-client.ts's
// extractCommonsFileTitle uses for P18 image URIs).
export function extractWikipediaArticleTitle(articleUrl: string): string | undefined {
  let pathname: string;
  try {
    pathname = new URL(articleUrl).pathname;
  } catch {
    return undefined;
  }
  const title = decodeURIComponent(pathname.split("/").pop() ?? "");
  return title || undefined;
}

export interface PageviewsWindow {
  startYYYYMM01: string;
  endYYYYMM01: string;
}

// The 4 most recently *completed* calendar years as of `now` — excludes the
// current partial year, matching ADR 0010's benchmark-derivation pilot
// window. Not configurable (ADR 0010's "Consequences": a fixed pipeline
// constant, requires a code change + re-run to alter).
export function trailingFourYearWindow(now: Date = new Date()): PageviewsWindow {
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

/**
 * For every entity's resolved per-language sitelink article URLs, sums
 * trailing-4-year monthly pageviews across the fixed 7-language basket,
 * keyed by the caller's own entity id. A language with no resolved URL, an
 * unparseable URL, or a failed individual pageviews call contributes 0 for
 * that language — best-effort, matching ADR 0010's "pageviews-fetch failure
 * degrades to 0 rather than dropping the row" decision.
 */
export async function batchedPageviewsFetch(
  entries: Array<{ id: string; articleUrls: Partial<Record<PageviewsLanguage, string>> }>,
  window: PageviewsWindow = trailingFourYearWindow(),
): Promise<Map<string, number>> {
  const calls: Array<{ id: string; lang: PageviewsLanguage; title: string }> = [];
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
        fetchArticlePageviews(projectFor(call.lang), call.title, window.startYYYYMM01, window.endYYYYMM01),
      ),
    );

    let resolved = 0;
    results.forEach((result, index) => {
      const call = batch[index]!;
      if (result.status === "fulfilled") {
        totals.set(call.id, (totals.get(call.id) ?? 0) + result.value);
        resolved += 1;
      } else {
        console.warn(
          `    pageviews call failed for ${call.id} (${call.lang}): ${(result.reason as Error).message}; treating as 0.`,
        );
      }
    });
    console.log(`    batch ${batchNumber}: ${resolved}/${batch.length} pageviews calls resolved`);
    if (i + BATCH_SIZE < calls.length) await sleep(BATCH_DELAY_MS);
  }

  return totals;
}
