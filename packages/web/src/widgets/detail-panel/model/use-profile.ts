import type { Profile } from '@o-tempora/shared-types';
import { useEffect, useState } from 'react';
import { getLocale } from '../../../shared/paraglide/runtime.js';
import type { ProfileState } from '../lib/profile';

// One request per Profile per page load; a failed one is dropped so reopening
// the entity retries.
const requests = new Map<string, Promise<Profile>>();

function fetchProfile(locale: string, slug: string): Promise<Profile> {
  const url = `${import.meta.env.BASE_URL}profiles/${locale}/${slug}.json`;
  let request = requests.get(url);
  if (!request) {
    request = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`${url}: ${response.status}`);
      return response.json() as Promise<Profile>;
    });
    request.catch(() => requests.delete(url));
    requests.set(url, request);
  }
  return request;
}

// The shipped Profile of the entity with this slug, fetched when it opens;
// undefined when `slug` is null (the entity has none).
export function useProfile(slug: string | null): ProfileState | undefined {
  const locale = getLocale();
  const key = slug && `${locale}/${slug}`;
  const [settled, setSettled] = useState<{
    key: string;
    state: ProfileState;
  } | null>(null);

  useEffect(() => {
    if (!slug || !key) return;
    let isCurrent = true;
    fetchProfile(locale, slug).then(
      (profile) => {
        if (isCurrent) setSettled({ key, state: { status: 'ready', profile } });
      },
      () => {
        if (isCurrent) setSettled({ key, state: { status: 'failed' } });
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [key, locale, slug]);

  if (!key) return undefined;
  return settled?.key === key ? settled.state : { status: 'loading' };
}
