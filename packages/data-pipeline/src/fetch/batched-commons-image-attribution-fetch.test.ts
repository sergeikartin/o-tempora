import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractCommonsFileTitle,
  buildAttributionDisplayString,
  batchedCommonsImageAttributionFetch,
} from "./batched-commons-image-attribution-fetch.js";

test("extractCommonsFileTitle recovers a File: title from a Special:FilePath URI, decoding %20", () => {
  const title = extractCommonsFileTitle(
    "http://commons.wikimedia.org/wiki/Special:FilePath/Jacques-Louis%20David.jpg",
  );
  assert.equal(title, "File:Jacques-Louis David.jpg");
});

test("extractCommonsFileTitle returns undefined for an unparseable URI", () => {
  assert.equal(extractCommonsFileTitle("not a url"), undefined);
});

test("buildAttributionDisplayString returns undefined when AttributionRequired is not \"true\"", () => {
  const display = buildAttributionDisplayString({
    extmetadata: { AttributionRequired: { value: "false" }, Artist: { value: "Someone" } },
  });
  assert.equal(display, undefined);
});

test("buildAttributionDisplayString strips HTML from Artist and appends the Commons credit", () => {
  const display = buildAttributionDisplayString({
    extmetadata: {
      AttributionRequired: { value: "true" },
      Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:X">Jacques-Louis David</a>' },
    },
  });
  assert.equal(display, "Jacques-Louis David, via Wikimedia Commons");
});

test("buildAttributionDisplayString falls back to Credit when Artist is absent", () => {
  const display = buildAttributionDisplayString({
    extmetadata: { AttributionRequired: { value: "true" }, Credit: { value: "Official portrait" } },
  });
  assert.equal(display, "Official portrait, via Wikimedia Commons");
});

test("buildAttributionDisplayString returns undefined when attribution is required but neither Artist nor Credit is present", () => {
  const display = buildAttributionDisplayString({ extmetadata: { AttributionRequired: { value: "true" } } });
  assert.equal(display, undefined);
});

test("batchedCommonsImageAttributionFetch resolves imageAttribution only for entities requiring it", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        query: {
          pages: [
            {
              title: "File:PublicDomain.jpg",
              imageinfo: [{ extmetadata: { AttributionRequired: { value: "false" } } }],
            },
            {
              title: "File:CcBySa.jpg",
              imageinfo: [
                { extmetadata: { AttributionRequired: { value: "true" }, Artist: { value: "Jane Doe" } } },
              ],
            },
          ],
        },
      }),
      { status: 200 },
    )) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await batchedCommonsImageAttributionFetch([
    { id: "person-1", imageUri: "http://commons.wikimedia.org/wiki/Special:FilePath/PublicDomain.jpg" },
    { id: "person-2", imageUri: "http://commons.wikimedia.org/wiki/Special:FilePath/CcBySa.jpg" },
  ]);

  assert.equal(result.has("person-1"), false);
  assert.equal(result.get("person-2"), "Jane Doe, via Wikimedia Commons");
});

test("batchedCommonsImageAttributionFetch applies the same file's attribution to every id sharing it", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        query: {
          pages: [
            {
              title: "File:Shared.jpg",
              imageinfo: [
                { extmetadata: { AttributionRequired: { value: "true" }, Artist: { value: "Shared Artist" } } },
              ],
            },
          ],
        },
      }),
      { status: 200 },
    )) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await batchedCommonsImageAttributionFetch([
    { id: "person-1", imageUri: "http://commons.wikimedia.org/wiki/Special:FilePath/Shared.jpg" },
    { id: "person-2", imageUri: "http://commons.wikimedia.org/wiki/Special:FilePath/Shared.jpg" },
  ]);

  assert.equal(result.get("person-1"), "Shared Artist, via Wikimedia Commons");
  assert.equal(result.get("person-2"), "Shared Artist, via Wikimedia Commons");
});
