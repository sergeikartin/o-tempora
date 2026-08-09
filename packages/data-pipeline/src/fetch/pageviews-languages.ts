// The fixed 7-language basket ADR 0010 (packages/data-pipeline/docs/adr/
// 0010-blend-sitelinks-and-pageviews-for-wars-discoveries-fame-score.md)
// pins for the pageviews half of the Wars/Discoveries fameScore blend —
// rejected "sum across every sitelink language" in favor of this bounded
// set, since cost would otherwise scale with sitelinks count itself.
// Shared by queries/wars-enrichment.ts, queries/events-enrichment.ts (title
// resolution), and fetch-pageviews.ts (the pageviews REST calls).
export const PAGEVIEWS_LANGUAGES = ["en", "zh", "es", "fr", "de", "ar", "ru"] as const;
export type PageviewsLanguage = (typeof PAGEVIEWS_LANGUAGES)[number];

// SPARQL variable name for a given language's article-title binding, e.g.
// "en" -> "articleEn", "zh" -> "articleZh" — same casing convention as the
// pre-existing English-only ?article binding these queries used to have.
export function articleVar(lang: PageviewsLanguage): string {
  return `article${lang[0]!.toUpperCase()}${lang.slice(1)}`;
}

function isPageviewsLanguage(value: string): value is PageviewsLanguage {
  return (PAGEVIEWS_LANGUAGES as readonly string[]).includes(value);
}

// Validates the per-language article-URL map enrichment queries backfill
// (EnrichedWar.articleUrls / EnrichedEvent.articleUrls) — same boundary-
// validation reasoning as every other enriched-file field (see
// fetch-wars-enrichment.ts/fetch-events-enrichment.ts's isEnrichedWar/
// isEnrichedEvent), applied to a nested record instead of a flat field.
export function isArticleUrlsRecord(value: unknown): value is Partial<Record<PageviewsLanguage, string>> {
  if (typeof value !== "object" || value === null) return false;
  return Object.entries(value as Record<string, unknown>).every(
    ([key, url]) => isPageviewsLanguage(key) && typeof url === "string",
  );
}
