import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

export const PROMPTS_DIR = path.join(PACKAGE_DIR, 'prompts');
export const PROMPT_PATH = path.join(PROMPTS_DIR, 'profile.md');
export const WRITER_AGENT_PATH = path.join(
  PACKAGE_DIR,
  '..',
  '..',
  '.claude',
  'agents',
  'profile-writer.md',
);

export const RAW_PROFILES_DIR = path.join(
  PACKAGE_DIR,
  'data',
  'raw',
  'profiles',
);

// Where the profile-writer agents leave their output, one `<QID>.json` each.
// Gitignored: finalize turns these into committed records.
export const INCOMING_DIR = path.join(RAW_PROFILES_DIR, 'incoming');

export const SUBJECTS_CACHE_FILENAME = 'profile-subjects.cache.json';
export const SUBJECTS_CACHE_PATH = path.join(
  PACKAGE_DIR,
  'data',
  'output',
  SUBJECTS_CACHE_FILENAME,
);
