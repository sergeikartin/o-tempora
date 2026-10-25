import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Copies build-data's output into packages/shared-types/src/data/, the
// single location both /data-pipeline and /web read from — kept as an
// explicit, separate step from generation so a dataset can be inspected
// (or regenerated and diffed) before it's published for consumers.
const SOURCE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'data',
  'output',
);
const DEST_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'shared-types',
  'src',
  'data',
);

// Copies `sourceDir` into `destDir`, returning the published paths relative to
// `destDir`. A subdirectory (`profiles/`) replaces its counterpart wholesale,
// so a file dropped from the source does not linger in the published data.
export async function publishFiles(
  sourceDir: string,
  destDir: string,
): Promise<string[]> {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  await mkdir(destDir, { recursive: true });

  const published: string[] = [];
  for (const entry of entries) {
    const source = path.join(sourceDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await rm(dest, { recursive: true, force: true });
      const nested = await publishFiles(source, dest);
      published.push(
        ...nested.map((nestedPath) => path.posix.join(entry.name, nestedPath)),
      );
    } else {
      await copyFile(source, dest);
      published.push(entry.name);
    }
  }

  return published;
}

async function main(): Promise<void> {
  const fileNames = await publishFiles(SOURCE_DIR, DEST_DIR);
  for (const fileName of fileNames) {
    console.log(`Published ${fileName} to ${DEST_DIR}`);
  }
}

// Only run when executed directly (`tsx output/publish.ts`), not when
// `publishFiles` is imported for testing — importing this module must not
// have the side effect of actually publishing.
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
