import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

export const PROMPT_PATH = path.join(PACKAGE_DIR, 'prompts', 'profile.md');
export const WRITER_AGENT_PATH = path.join(
  PACKAGE_DIR,
  '..',
  '..',
  '.claude',
  'agents',
  'profile-writer.md',
);

// `<lane>/<QID>-<english-name>.en.json` records live here; Output reads them.
export const RAW_PROFILES_DIR = path.join(
  PACKAGE_DIR,
  'data',
  'raw',
  'profiles',
);

// Where the profile-writer agents leave their output, one `<QID>.json` each.
// Gitignored: finalize turns these into committed records.
export const INCOMING_DIR = path.join(RAW_PROFILES_DIR, 'incoming');
