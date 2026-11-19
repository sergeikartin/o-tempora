export type EntryLocale = 'en' | 'ru';
export type EntryKind = 'landing' | 'timeline';

export function htmlEntry(path: string): {
  locale: EntryLocale;
  kind: EntryKind;
} {
  return {
    locale: path.startsWith('/ru/') ? 'ru' : 'en',
    kind: path.includes('/timeline/') ? 'timeline' : 'landing',
  };
}
