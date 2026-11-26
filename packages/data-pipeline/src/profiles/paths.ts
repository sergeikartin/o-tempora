import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

export const RAW_PROFILES_DIR = path.join(
  PACKAGE_DIR,
  'data',
  'raw',
  'profiles',
);

// Gitignored working directory at the root of packages/data-pipeline.
export const WORK_DIR = path.join(PACKAGE_DIR, '.work');
export const SOURCES_DIR = path.join(WORK_DIR, 'sources');

export const SUBJECTS_CACHE_FILENAME = 'profile-subjects.cache.json';
export const SUBJECTS_CACHE_PATH = path.join(
  PACKAGE_DIR,
  'data',
  'output',
  SUBJECTS_CACHE_FILENAME,
);

export function workQidDir(qid: string, workDir = WORK_DIR): string {
  return path.join(workDir, qid);
}

export function workFile(
  qid: string,
  fileName: string,
  workDir = WORK_DIR,
): string {
  return path.join(workQidDir(qid, workDir), fileName);
}
