import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PROFILE_LANES, type ProfileLane } from '@o-tempora/shared-types';
import { RAW_PROFILES_DIR } from './paths.ts';
import {
  formatZodIssues,
  type ProfileLocale,
  type StoredProfile,
  StoredProfileSchema,
} from './schemas.ts';

export interface CommittedProfileRecord {
  filePath: string;
  fileName: string;
  lane: ProfileLane;
  profile: StoredProfile;
}

export function committedProfilePath(
  lane: ProfileLane,
  qid: string,
  slug: string,
  locale: ProfileLocale,
  rawProfilesDir = RAW_PROFILES_DIR,
): string {
  return path.join(rawProfilesDir, lane, `${qid}-${slug}.${locale}.json`);
}

export async function readCommittedProfiles(
  rawProfilesDir = RAW_PROFILES_DIR,
): Promise<CommittedProfileRecord[]> {
  const records: CommittedProfileRecord[] = [];
  for (const lane of PROFILE_LANES) {
    const laneDir = path.join(rawProfilesDir, lane);
    let fileNames: string[];
    try {
      fileNames = await readdir(laneDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    for (const fileName of fileNames.sort()) {
      if (!fileName.endsWith('.en.json') && !fileName.endsWith('.ru.json'))
        continue;
      const filePath = path.join(laneDir, fileName);
      const raw: unknown = JSON.parse(await readFile(filePath, 'utf8'));
      const parsed = StoredProfileSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error(
          `${lane}/${fileName}: ${formatZodIssues(parsed.error).join('; ')}`,
        );
      }
      records.push({
        filePath,
        fileName: `${lane}/${fileName}`,
        lane,
        profile: parsed.data,
      });
    }
  }
  return records;
}

export async function findCommittedProfile(
  qid: string,
  locale: ProfileLocale,
  rawProfilesDir = RAW_PROFILES_DIR,
): Promise<CommittedProfileRecord | undefined> {
  const records = await readCommittedProfiles(rawProfilesDir);
  return records.find(
    (record) =>
      record.profile.meta.qid === qid && record.profile.meta.locale === locale,
  );
}

export async function writeJsonFile(
  filePath: string,
  value: unknown,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function readJsonIfExists(
  filePath: string,
): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}
