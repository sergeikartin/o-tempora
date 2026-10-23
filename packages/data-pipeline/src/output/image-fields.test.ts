import { test } from "node:test";
import assert from "node:assert/strict";
import { IMAGE_DENYLIST, imageFields, normalizeImageUrl } from "./image-fields.js";

test("normalizeImageUrl points Special:FilePath at Special:Redirect/file over https", () => {
  assert.equal(
    normalizeImageUrl("http://commons.wikimedia.org/wiki/Special:FilePath/Siyer-i%20Nebi%20158b.jpg"),
    "https://commons.wikimedia.org/wiki/Special:Redirect/file/Siyer-i%20Nebi%20158b.jpg",
  );
});

test("normalizeImageUrl upgrades other http URLs to https and leaves https ones alone", () => {
  assert.equal(normalizeImageUrl("http://example.org/a.jpg"), "https://example.org/a.jpg");
  assert.equal(normalizeImageUrl("https://example.org/a.jpg"), "https://example.org/a.jpg");
});

test("imageFields drops image and attribution for a denylisted id", () => {
  const [id] = IMAGE_DENYLIST;
  assert.deepEqual(imageFields(id as string, "http://commons.wikimedia.org/wiki/Special:FilePath/X.jpg", "X"), {});
});

test("imageFields omits attribution when absent and everything when there is no image", () => {
  assert.deepEqual(imageFields("1", "https://example.org/a.jpg", undefined), { image: "https://example.org/a.jpg" });
  assert.deepEqual(imageFields("1", undefined, "orphan attribution"), {});
});
