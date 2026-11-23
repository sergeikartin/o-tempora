import searchIndexUrl from '@o-tempora/shared-types/src/data/search-index.json?url&no-inline';
import searchIndexRuUrl from '@o-tempora/shared-types/src/data/search-index.ru.json?url&no-inline';
import { useEffect, useState } from 'react';
import { logError } from '../shared/lib/log-error';
import { getLocale } from '../shared/paraglide/runtime.js';
import type { SearchIndex } from '../shared/types';

type SearchIndexState =
  | { status: 'ready'; index: SearchIndex }
  | { status: 'loading' | 'unavailable'; index: null };

const requests = new Map<string, Promise<SearchIndex>>();

function loadSearchIndex(url: string): Promise<SearchIndex> {
  const cached = requests.get(url);
  if (cached) return cached;

  const request = fetch(url)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Search index HTTP ${response.status}`);
      return (await response.json()) as SearchIndex;
    })
    .catch((error: unknown) => {
      requests.delete(url);
      logError(error, { dataset: 'search-index' });
      throw error;
    });
  requests.set(url, request);
  return request;
}

export function useSearchIndex(query: string): SearchIndexState {
  const [state, setState] = useState<SearchIndexState>({
    status: 'loading',
    index: null,
  });
  const isSearching = query.trim().length > 0;

  useEffect(() => {
    if (!isSearching) return;
    let cancelled = false;
    const url = getLocale() === 'ru' ? searchIndexRuUrl : searchIndexUrl;
    setState((current) =>
      current.status === 'unavailable'
        ? { status: 'loading', index: null }
        : current,
    );
    loadSearchIndex(url).then(
      (index) => {
        if (!cancelled) setState({ status: 'ready', index });
      },
      () => {
        if (!cancelled) setState({ status: 'unavailable', index: null });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isSearching]);

  return state;
}
