export type EntryLocale = 'en' | 'ru';
export type EntryKind = 'landing' | 'timeline';

// The four HTML entries (`/`, `/ru/`, `/timeline/`, `/ru/timeline/`) are told
// apart by the path Vite hands each transformIndexHtml call.
export function htmlEntry(path: string): {
  locale: EntryLocale;
  kind: EntryKind;
} {
  return {
    locale: path.startsWith('/ru/') ? 'ru' : 'en',
    kind: path.includes('/timeline/') ? 'timeline' : 'landing',
  };
}
