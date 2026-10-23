// The build (vite-plugins/landing-timeline-prefetch.ts) writes the timeline
// entry's JS/CSS and this locale's eager datasets into the landing page as
// JSON; they're fetched only once the visitor shows intent to open the
// timeline, so the landing itself stays free of timeline weight.
const MANIFEST_ID = 'timeline-prefetch';

interface PrefetchEntry {
  href: string;
  as?: 'script' | 'style';
}

let prefetched = false;

export function prefetchTimeline(): void {
  if (prefetched) return;
  const manifest = document.getElementById(MANIFEST_ID)?.textContent;
  if (!manifest) return;
  prefetched = true;
  for (const { href, as } of JSON.parse(manifest) as PrefetchEntry[]) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    if (as) link.as = as;
    if (as === 'script') link.crossOrigin = '';
    document.head.append(link);
  }
}
