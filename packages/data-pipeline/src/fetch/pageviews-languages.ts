// The fixed 7-language basket for the pageviews half of the Conflicts/Milestones
// fameScore blend (docs/adr/0010-blend-sitelinks-and-pageviews-for-wars-discoveries-fame-score.md),
// bounded because summing every sitelink language would scale cost with
// sitelink count. Shared by queries/conflicts-enrichment.ts,
// queries/milestones-enrichment.ts (title resolution) and fetch-pageviews.ts
// (the REST calls).
export const PAGEVIEWS_LANGUAGES = ["en", "zh", "es", "fr", "de", "ar", "ru"] as const;
export type PageviewsLanguage = (typeof PAGEVIEWS_LANGUAGES)[number];

// SPARQL variable name for a language's article-title binding, e.g. "en" ->
// "articleEn", "zh" -> "articleZh".
export function articleVar(lang: PageviewsLanguage): string {
  return `article${lang[0]!.toUpperCase()}${lang.slice(1)}`;
}

function isPageviewsLanguage(value: string): value is PageviewsLanguage {
  return (PAGEVIEWS_LANGUAGES as readonly string[]).includes(value);
}

// Validates the per-language article-URL map enrichment queries backfill
// (EnrichedConflict/EnrichedMilestone.articleUrls), with the same boundary
// validation as the other enriched-file fields (isEnrichedConflict/
// isEnrichedMilestone), applied to a nested record.
export function isArticleUrlsRecord(value: unknown): value is Partial<Record<PageviewsLanguage, string>> {
  if (typeof value !== "object" || value === null) return false;
  return Object.entries(value as Record<string, unknown>).every(
    ([key, url]) => isPageviewsLanguage(key) && typeof url === "string",
  );
}
