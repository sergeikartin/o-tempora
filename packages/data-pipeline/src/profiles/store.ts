import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { PROFILE_LANES } from '@o-tempora/shared-types';
import { asRecord, asString } from '../output/profiles.js';

export interface StoredProfile {
  qid: string;
  filePath: string;
  status: string;
  promptHash: string | null;
}

const RECORD_FILE = /^(Q\d+)-.+\.en\.json$/;

// Every English record under `<dir>/<lane>/`, keyed by QID. The file name is
// frozen when a record is first created, so the QID prefix is the identity;
// `*.verification.json` reports and the `incoming/` staging folder sit
// beside the records and do not match.
export async function readStoredProfiles(
  dir: string,
): Promise<Map<string, StoredProfile>> {
  const stored = new Map<string, StoredProfile>();
  for (const lane of PROFILE_LANES) {
    const laneDir = path.join(dir, lane);
    let fileNames: string[];
    try {
      fileNames = await readdir(laneDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    for (const fileName of fileNames.sort()) {
      const qid = RECORD_FILE.exec(fileName)?.[1];
      if (!qid) continue;
      const filePath = path.join(laneDir, fileName);
      const where = `${lane}/${fileName}`;
      const root = asRecord(
        JSON.parse(await readFile(filePath, 'utf8')),
        where,
      );
      const meta = asRecord(root.meta, `${where}: meta`);
      const review = asRecord(meta.review, `${where}: meta.review`);
      stored.set(qid, {
        qid,
        filePath,
        status: asString(review.status, `${where}: meta.review.status`),
        promptHash:
          meta.prompt_hash === null
            ? null
            : asString(meta.prompt_hash, `${where}: meta.prompt_hash`),
      });
    }
  }
  return stored;
}
