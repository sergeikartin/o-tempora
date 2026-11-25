import {
  type CommonsImageInfo,
  fetchCommonsImageInfo,
} from './commons-client.ts';

// MediaWiki caps title batches at 50 for unauthenticated callers.
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Wikidata supplies a Special:FilePath URI. Commons imageinfo expects the decoded filename with a File: prefix.
export function extractCommonsFileTitle(imageUri: string): string | undefined {
  let pathname: string;
  try {
    pathname = new URL(imageUri).pathname;
  } catch {
    return undefined;
  }
  const fileName = decodeURIComponent(pathname.split('/').pop() ?? '');
  return fileName ? `File:${fileName}` : undefined;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim();
}

// Commons supplies these credits as HTML fragments. Strip tags for plain-text display.
export function buildAttributionDisplayString(
  info: CommonsImageInfo,
): string | undefined {
  const meta = info.extmetadata;
  if (!meta || meta.AttributionRequired?.value !== 'true') return undefined;
  const credit = meta.Artist?.value ?? meta.Credit?.value;
  if (!credit) return undefined;
  const plainCredit = stripHtml(credit);
  return plainCredit ? `${plainCredit}, via Wikimedia Commons` : undefined;
}

// Key credits by entity ID because multiple entities can share one Commons file.
// Missing credits can also mean Commons metadata was unavailable.
export async function batchedCommonsImageAttributionFetch(
  entries: Array<{ id: string; imageUri: string }>,
): Promise<Map<string, string>> {
  const titleToIds = new Map<string, string[]>();
  for (const entry of entries) {
    const title = extractCommonsFileTitle(entry.imageUri);
    if (!title) continue;
    const ids = titleToIds.get(title);
    if (ids) ids.push(entry.id);
    else titleToIds.set(title, [entry.id]);
  }
  const titles = [...titleToIds.keys()];

  const attributionById = new Map<string, string>();

  for (let i = 0; i < titles.length; i += BATCH_SIZE) {
    const batch = titles.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    try {
      const response = await fetchCommonsImageInfo(batch);
      const pages = response.query?.pages ?? [];
      let resolved = 0;
      for (const page of pages) {
        if (!page.title || page.missing) continue;
        const info = page.imageinfo?.[0];
        if (!info) continue;
        const display = buildAttributionDisplayString(info);
        if (!display) continue;
        for (const id of titleToIds.get(page.title) ?? []) {
          attributionById.set(id, display);
          resolved += 1;
        }
      }
      console.log(
        `    batch ${batchNumber}: +${resolved} attributions (total ${attributionById.size})`,
      );
    } catch (error) {
      console.warn(
        `    batch ${batchNumber}: failed (${(error as Error).message}); skipping.`,
      );
    }
    if (i + BATCH_SIZE < titles.length) await sleep(BATCH_DELAY_MS);
  }

  return attributionById;
}
