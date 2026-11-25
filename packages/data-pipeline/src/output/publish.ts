import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUBJECTS_CACHE_FILENAME } from '../profiles/paths.ts';

import { verifyBuiltProfiles } from './profiles.ts';

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
    if (
      entry.name === SUBJECTS_CACHE_FILENAME ||
      (entry.name.startsWith(`${SUBJECTS_CACHE_FILENAME}.`) &&
        entry.name.endsWith('.tmp'))
    )
      continue;
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

export async function publishBuiltData(
  sourceDir: string,
  destDir: string,
): Promise<string[]> {
  await verifyBuiltProfiles(sourceDir);
  const fileNames = await publishFiles(sourceDir, destDir);
  await verifyBuiltProfiles(destDir);
  return fileNames;
}

async function main(): Promise<void> {
  const fileNames = await publishBuiltData(SOURCE_DIR, DEST_DIR);
  for (const fileName of fileNames) {
    console.log(`Published ${fileName} to ${DEST_DIR}`);
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
