// Use a fixed language basket so request volume per entity stays bounded regardless of sitelink count.
export const PAGEVIEWS_LANGUAGES = [
  'en',
  'zh',
  'es',
  'fr',
  'de',
  'ar',
  'ru',
] as const;
export type PageviewsLanguage = (typeof PAGEVIEWS_LANGUAGES)[number];

export function articleVar(lang: PageviewsLanguage): string {
  return `article${lang[0]!.toUpperCase()}${lang.slice(1)}`;
}

function isPageviewsLanguage(value: string): value is PageviewsLanguage {
  return (PAGEVIEWS_LANGUAGES as readonly string[]).includes(value);
}

export function isArticleUrlsRecord(
  value: unknown,
): value is Partial<Record<PageviewsLanguage, string>> {
  if (typeof value !== 'object' || value === null) return false;
  return Object.entries(value as Record<string, unknown>).every(
    ([key, url]) => isPageviewsLanguage(key) && typeof url === 'string',
  );
}
