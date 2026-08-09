import { fetchCommonsImageInfo, type CommonsImageInfo } from "./commons-client.js";

// Same batch size batched-sparql-fetch.ts uses for Wikidata VALUES clauses
// — also MediaWiki's own titles= batching ceiling for unauthenticated API
// callers.
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A P18 SPARQL binding is already a full `Special:FilePath/<encoded name>`
// URI (research/image-sourcing.md §2.1) — the imageinfo API instead wants a
// bare `File:<name>` title, so this recovers the filename by decoding the
// URI's last path segment.
export function extractCommonsFileTitle(imageUri: string): string | undefined {
  let pathname: string;
  try {
    pathname = new URL(imageUri).pathname;
  } catch {
    return undefined;
  }
  const fileName = decodeURIComponent(pathname.split("/").pop() ?? "");
  return fileName ? `File:${fileName}` : undefined;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

// Commons' extmetadata.Artist/Credit values are HTML fragments (research/
// image-sourcing.md §2.3's live samples), not plain text — this app renders
// the result as plain React text (auto-escaped), so tags are stripped, not
// preserved or re-rendered as markup.
export function buildAttributionDisplayString(info: CommonsImageInfo): string | undefined {
  const meta = info.extmetadata;
  if (!meta || meta.AttributionRequired?.value !== "true") return undefined;
  const credit = meta.Artist?.value ?? meta.Credit?.value;
  if (!credit) return undefined;
  const plainCredit = stripHtml(credit);
  return plainCredit ? `${plainCredit}, via Wikimedia Commons` : undefined;
}

// Resolves `imageAttribution` display strings for a batch of entities that
// each already carry a raw P18 image URI, keyed by the caller's own entity
// id (not the Commons filename, which multiple entities could in principle
// share). Entities with no license-required attribution — the common,
// public-domain case for this dataset — are simply absent from the
// returned map, same "absent means not applicable" convention `image`/
// `imageAttribution` use throughout (dynamic-tooltips spec §4.1).
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
      console.log(`    batch ${batchNumber}: +${resolved} attributions (total ${attributionById.size})`);
    } catch (error) {
      console.warn(`    batch ${batchNumber}: failed (${(error as Error).message}); skipping.`);
    }
    if (i + BATCH_SIZE < titles.length) await sleep(BATCH_DELAY_MS);
  }

  return attributionById;
}
