import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { publishFiles } from "./publish.js";

test("publishFiles copies every file from source to destination", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "publish-test-"));
  const sourceDir = path.join(root, "source");
  const destDir = path.join(root, "dest");
  await mkdir(sourceDir, { recursive: true });
  await writeFile(path.join(sourceDir, "people.json"), '{"a":1}');
  await writeFile(path.join(sourceDir, "events.json"), '{"b":2}');

  const published = await publishFiles(sourceDir, destDir);

  assert.deepEqual(published.sort(), ["events.json", "people.json"]);
  assert.equal(await readFile(path.join(destDir, "people.json"), "utf8"), '{"a":1}');
  assert.equal(await readFile(path.join(destDir, "events.json"), "utf8"), '{"b":2}');

  await rm(root, { recursive: true, force: true });
});

test("publishFiles creates the destination directory if it doesn't already exist", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "publish-test-"));
  const sourceDir = path.join(root, "source");
  const destDir = path.join(root, "nested", "dest");
  await mkdir(sourceDir, { recursive: true });
  await writeFile(path.join(sourceDir, "data.json"), "{}");

  await publishFiles(sourceDir, destDir);

  assert.equal(await readFile(path.join(destDir, "data.json"), "utf8"), "{}");

  await rm(root, { recursive: true, force: true });
});
