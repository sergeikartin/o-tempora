import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  DETAIL_LEVEL_FAME_SCORE_FLOORS,
  PROFILE_LANES,
  type Profile,
  type ProfileConnection,
  type ProfileLane,
} from '@o-tempora/shared-types';
import { assertBoldOnlyMarkup } from '../profiles/markup.ts';
import {
  computeEnglishSourceHash,
  type ProfileLocale,
  type StoredProfile,
  StoredProfileSchema,
} from '../profiles/schemas.ts';
import {
  type CommittedProfileRecord,
  readCommittedProfiles,
} from '../profiles/store.ts';
import { detailLevelOf } from './write-datasets.ts';

export type RawProfileRecord = CommittedProfileRecord;

export async function readRawProfiles(
  dir: string,
): Promise<RawProfileRecord[]> {
  return readCommittedProfiles(dir);
}

export function parseRawProfile(
  json: unknown,
  fileName: string,
): StoredProfile {
  const parsed = StoredProfileSchema.safeParse(json);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`${fileName}: ${details}`);
  }
  return parsed.data;
}

export interface ProfileTarget {
  // Wikidata QID. A Person's dataset `id` is Pantheon's, so it is not the join key.
  qid: string;
  slug: string;
  name: string;
  nameRu?: string;
  lane: ProfileLane;
  fameScore: number;
  dates: string;
}

function resolveConnections(
  qid: string,
  connections: readonly { qid: string; reason: string }[],
  targetByQid: ReadonlyMap<string, ProfileTarget>,
  locale: ProfileLocale,
): ProfileConnection[] {
  const resolved: ProfileConnection[] = [];
  const seen = new Set<string>();
  for (const { qid: targetQid, reason } of connections) {
    const target = targetByQid.get(targetQid);
    if (!target || target.qid === qid || seen.has(target.qid)) continue;
    seen.add(target.qid);
    resolved.push({
      slug: target.slug,
      reason,
      name: locale === 'ru' ? (target.nameRu ?? target.name) : target.name,
      lane: target.lane,
      detailLevel: detailLevelOf(
        target.fameScore,
        DETAIL_LEVEL_FAME_SCORE_FLOORS[target.lane],
      ),
    });
  }
  return resolved;
}

function assertProfileMarkup(profile: StoredProfile, fileName: string): void {
  assertBoldOnlyMarkup(profile.overview, `${fileName}: overview`);
  profile.keyMoments.forEach((moment, i) => {
    assertBoldOnlyMarkup(moment.date, `${fileName}: keyMoments[${i}].date`);
    assertBoldOnlyMarkup(moment.title, `${fileName}: keyMoments[${i}].title`);
    assertBoldOnlyMarkup(moment.text, `${fileName}: keyMoments[${i}].text`);
  });
  profile.deepFacts.forEach((fact, i) => {
    assertBoldOnlyMarkup(fact.text, `${fileName}: deepFacts[${i}].text`);
  });
  profile.connections.forEach((conn, i) => {
    assertBoldOnlyMarkup(conn.reason, `${fileName}: connections[${i}].reason`);
  });
}

// Committed files under `data/raw/profiles/` are the publication truth.
// Output enforces deterministic invariants: dataset membership, bold-only
// markup, and warn-and-skip freshness for `meta.subjectDates` and Russian
// `meta.sourceHash`. English owns `sourceUrl` and `isLegend` authoritatively.
export function shipProfiles(
  records: readonly RawProfileRecord[],
  targets: readonly ProfileTarget[],
  locale: ProfileLocale = 'en',
  { warn = console.warn }: { warn?: (message: string) => void } = {},
): Map<string, Profile> {
  const targetByQid = new Map(targets.map((target) => [target.qid, target]));
  const enByQid = new Map<string, RawProfileRecord>();

  for (const record of records) {
    if (record.profile.meta.locale !== 'en') continue;
    const { qid } = record.profile.meta;
    if (enByQid.has(qid)) {
      throw new Error(
        `${record.fileName}: a second English Profile for ${qid}`,
      );
    }
    enByQid.set(qid, record);
  }

  const shipped = new Map<string, Profile>();
  for (const record of records) {
    const { profile, fileName } = record;
    if (profile.meta.locale !== locale) continue;

    const subject = targetByQid.get(profile.meta.qid);
    if (!subject) {
      throw new Error(
        `${fileName}: ${profile.meta.qid} is not an entity in the dataset`,
      );
    }
    if (shipped.has(subject.slug)) {
      throw new Error(
        `${fileName}: a second ${locale} Profile for ${profile.meta.qid}`,
      );
    }

    if (profile.meta.subjectDates !== subject.dates) {
      warn(
        `Skipping stale ${locale} Profile ${fileName}: subjectDates "${profile.meta.subjectDates}" != dataset "${subject.dates}"`,
      );
      continue;
    }

    let authoritativeEn: StoredProfile | undefined;
    if (locale === 'ru') {
      const enRecord = enByQid.get(profile.meta.qid);
      if (!enRecord || enRecord.profile.meta.subjectDates !== subject.dates) {
        warn(
          `Skipping Russian Profile ${fileName}: no current English Profile for ${profile.meta.qid}`,
        );
        continue;
      }
      authoritativeEn = enRecord.profile;
      const expectedHash = computeEnglishSourceHash(authoritativeEn);
      if (profile.meta.sourceHash !== expectedHash) {
        warn(
          `Skipping stale Russian Profile ${fileName}: sourceHash "${profile.meta.sourceHash ?? ''}" != English "${expectedHash}"`,
        );
        continue;
      }
      if (
        profile.keyMoments.length !== authoritativeEn.keyMoments.length ||
        profile.deepFacts.length !== authoritativeEn.deepFacts.length ||
        profile.connections.length !== authoritativeEn.connections.length
      ) {
        warn(
          `Skipping Russian Profile ${fileName}: structure length does not match English`,
        );
        continue;
      }
    }

    assertProfileMarkup(profile, fileName);

    const keyMoments = profile.keyMoments.map((moment, i) => {
      const sourceUrl = authoritativeEn
        ? authoritativeEn.keyMoments[i]?.sourceUrl
        : moment.sourceUrl;
      return {
        date: moment.date,
        title: moment.title,
        text: moment.text,
        ...(sourceUrl ? { sourceUrl } : {}),
      };
    });

    const deepFacts = profile.deepFacts.map((fact, i) => {
      const enFact = authoritativeEn?.deepFacts[i];
      const sourceUrl = enFact ? enFact.sourceUrl : fact.sourceUrl;
      return {
        text: fact.text,
        isLegend: enFact ? enFact.isLegend : fact.isLegend,
        ...(sourceUrl ? { sourceUrl } : {}),
      };
    });

    shipped.set(subject.slug, {
      overview: profile.overview,
      keyMoments,
      deepFacts,
      connections: resolveConnections(
        profile.meta.qid,
        profile.connections,
        targetByQid,
        locale,
      ),
    });
  }

  return shipped;
}

export function withProfileFlags<T extends { slug: string }>(
  entries: T[],
  profiles: ReadonlyMap<string, Profile>,
): (T & { hasProfile?: true })[] {
  return entries.map((entry) =>
    profiles.has(entry.slug) ? { ...entry, hasProfile: true as const } : entry,
  );
}

const PROFILE_LOCALES = ['en', 'ru'] as const;

// Writes `<outputDir>/profiles/<locale>/<slug>.json`, replacing the previous
// run's files so a Profile that no longer ships does not linger.
export async function writeProfiles(
  outputDir: string,
  profiles: ReadonlyMap<string, Profile>,
  russianProfiles: ReadonlyMap<string, Profile> = new Map(),
): Promise<void> {
  const profilesDir = path.join(outputDir, 'profiles');
  await rm(profilesDir, { recursive: true, force: true });
  for (const locale of PROFILE_LOCALES) {
    const localeDir = path.join(profilesDir, locale);
    await mkdir(localeDir, { recursive: true });
    for (const [slug, profile] of locale === 'ru'
      ? russianProfiles
      : profiles) {
      await writeFile(
        path.join(localeDir, `${slug}.json`),
        JSON.stringify(profile, null, 2),
      );
    }
  }
}

type BuiltTarget = Pick<ProfileConnection, 'slug' | 'lane' | 'detailLevel'> & {
  hasProfile?: boolean;
};

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${where}: expected an object`);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${where}: expected an array`);
  return value;
}

function asString(value: unknown, where: string): string {
  if (typeof value !== 'string') throw new Error(`${where}: expected a string`);
  return value;
}

async function readBuiltTargets(outputDir: string, locale: ProfileLocale) {
  const targets: BuiltTarget[] = [];
  for (const lane of PROFILE_LANES) {
    for (const detailLevel of [1, 2, 3, 4] as const) {
      const file = path.join(
        outputDir,
        `${lane}.detail${detailLevel}${locale === 'ru' ? '.ru' : ''}.json`,
      );
      const rows = asArray(JSON.parse(await readFile(file, 'utf8')), file);
      for (const row of rows) {
        const entity = asRecord(row, file);
        targets.push({
          slug: asString(entity.slug, `${file}: slug`),
          hasProfile: entity.hasProfile === true,
          lane,
          detailLevel,
        });
      }
    }
  }
  return targets;
}

export async function verifyBuiltProfiles(
  outputDir: string,
  datasets?: Record<ProfileLocale, readonly BuiltTarget[]>,
): Promise<void> {
  for (const locale of PROFILE_LOCALES) {
    const targets = new Map<string, BuiltTarget>();
    for (const entry of datasets?.[locale] ??
      (await readBuiltTargets(outputDir, locale))) {
      if (targets.has(entry.slug))
        throw new Error(
          `Duplicate entity slug in ${locale} Detail Level datasets: ${entry.slug}`,
        );
      targets.set(entry.slug, entry);
    }
    const directory = path.join(outputDir, 'profiles', locale);
    const files = new Set(
      (
        await readdir(directory).catch((error: NodeJS.ErrnoException) => {
          if (error.code === 'ENOENT') return [];
          throw error;
        })
      )
        .filter((name) => name.endsWith('.json'))
        .sort(),
    );
    for (const { slug, hasProfile } of targets.values()) {
      if (hasProfile && !files.has(`${slug}.json`))
        throw new Error(
          `Missing Profile file: ${path.join(directory, `${slug}.json`)}`,
        );
    }
    for (const name of files) {
      const file = path.join(directory, name);
      if (!targets.get(name.slice(0, -5))?.hasProfile)
        throw new Error(`Orphan Profile file: ${file}`);
      let raw: unknown;
      try {
        raw = JSON.parse(await readFile(file, 'utf8'));
      } catch (error) {
        throw new Error(`Unreadable Profile JSON: ${file}`, { cause: error });
      }
      const profile = asRecord(raw, file);
      for (const entry of asArray(
        profile.connections,
        `${file}: connections`,
      )) {
        const connection = asRecord(entry, `${file}: Connection`);
        const slug = asString(connection.slug, `${file}: Connection slug`);
        const target = targets.get(slug);
        if (!target)
          throw new Error(`${file}: unknown Connection slug ${slug}`);
        if (
          connection.lane !== target.lane ||
          connection.detailLevel !== target.detailLevel
        )
          throw new Error(
            `${file}: Connection ${slug} must match lane ${target.lane} and Detail Level ${target.detailLevel}`,
          );
      }
    }
  }
}
