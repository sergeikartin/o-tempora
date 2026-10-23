// Entity ids whose Wikidata P18 image the site deliberately doesn't show —
// the entry itself stays on the timeline, only its image and attribution
// are dropped.
export const IMAGE_DENYLIST: ReadonlySet<string> = new Set([
  "18934", // Muhammad: a depiction of the Prophet
]);

const FILE_PATH_PREFIX = /^https?:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//;
const REDIRECT_FILE_PREFIX = "https://commons.wikimedia.org/wiki/Special:Redirect/file/";

// Wikidata's P18 binding is an `http://…/Special:FilePath/<name>` URI. Special:FilePath
// 302s to Special:Redirect/file before reaching the thumbnail, so pointing at
// Special:Redirect/file directly saves a round trip on every image load, and
// https avoids the mixed-content upgrade hop.
export function normalizeImageUrl(uri: string): string {
  return FILE_PATH_PREFIX.test(uri) ? uri.replace(FILE_PATH_PREFIX, REDIRECT_FILE_PREFIX) : uri.replace(/^http:\/\//, "https://");
}

// Spread target for a built entry: both keys absent (never undefined-valued)
// when the row has no image or its id is denylisted.
export function imageFields(
  id: string,
  image: string | undefined,
  imageAttribution: string | undefined,
): { image?: string; imageAttribution?: string } {
  if (!image || IMAGE_DENYLIST.has(id)) return {};
  return {
    image: normalizeImageUrl(image),
    ...(imageAttribution ? { imageAttribution } : {}),
  };
}
