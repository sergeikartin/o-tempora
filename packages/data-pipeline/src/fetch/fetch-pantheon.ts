import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Bunzip from "seek-bzip";

// Public, unauthenticated GCS object (.scratch/alt-data-sources/research/pantheon-schema.md).
// The bucket also lists 2020/2019 person datasets and Pantheon 1.0 files; the
// 2025 release is pinned explicitly, not "latest", so a new release can't
// silently reshape this pipeline's input.
const DATASET_URL = "https://storage.googleapis.com/pantheon-public-data/person_2025_update.csv.bz2";

const RAW_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "raw");
const OUTPUT_PATH = path.join(RAW_DIR, "people-pantheon.raw.csv");

export async function fetchPantheon(): Promise<void> {
  console.log(`Downloading Pantheon 2025 Person Dataset from ${DATASET_URL}...`);
  const response = await fetch(DATASET_URL);
  if (!response.ok) {
    throw new Error(`Pantheon dataset download returned HTTP ${response.status}`);
  }
  const compressed = Buffer.from(await response.arrayBuffer());
  console.log(`Downloaded ${compressed.length} bytes, decompressing...`);

  // Decompressed, not raw .bz2: Fetch's "raw results only" rule is about not
  // transforming the data, and a plain CSV is readable and diffable in git.
  const decompressed = Bunzip.decode(compressed);

  await mkdir(RAW_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, decompressed);
  console.log(`Wrote ${decompressed.length} bytes to ${OUTPUT_PATH}`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  fetchPantheon().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
