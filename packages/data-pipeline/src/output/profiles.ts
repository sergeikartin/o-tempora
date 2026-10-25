import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  DETAIL_LEVEL_FAME_SCORE_FLOORS,
  PROFILE_LANES,
  type Profile,
  type ProfileConnection,
  type ProfileLane,
} from '@o-tempora/shared-types';
import { detailLevelOf } from './write-datasets.js';

// The slice of a raw Profile file (prompts/profile.md's JSON plus the `meta`
// the profiles script adds, docs/adr/0021-...) that Output reads. Claims,
// sources, confidence, importance and the Deep Fact type are review material
// and never ship.
export interface RawProfile {
  fileName: string;
  qid: string;
  locale: string;
  status: string;
  overview: string;
  keyMoments: { date: string; title: string; text: string }[];
  deepFacts: { text: string; isLegend: boolean }[];
  // `qid` is the target's Wikidata ID, resolved from its Wikipedia URL by the
  // profiles script; a Connection without one cannot be resolved.
  connections: { qid?: string; reason: string }[];
}

// Only these review statuses ship (docs/adr/0021-...).
const SHIPPED_STATUSES: ReadonlySet<string> = new Set(['reviewed', 'edited']);

// A shipped Profile's text is `**bold**` and plain prose; web renders the bold
// runs as elements and everything else as text, so markup it would not render
// has to be caught here.
const MARKDOWN_LINK = /\[[^\]]*\]\([^)]*\)/;

function excerpt(text: string): string {
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

export function assertBoldOnlyMarkup(text: string, where: string): void {
  if (text.split('**').length % 2 === 0) {
    throw new Error(`${where}: unpaired "**" in "${excerpt(text)}"`);
  }
  const withoutBold = text.replaceAll('**', '');
  if (
    withoutBold.includes('<') ||
    withoutBold.includes('`') ||
    withoutBold.includes('*') ||
    MARKDOWN_LINK.test(withoutBold)
  ) {
    throw new Error(
      `${where}: markup other than **bold** in "${excerpt(text)}"`,
    );
  }
}

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${where}: expected an object`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, where: string): string {
  if (typeof value !== 'string' || value === '')
    throw new Error(`${where}: expected a non-empty string`);
  return value;
}

function asArray(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${where}: expected an array`);
  return value;
}

export function parseRawProfile(json: unknown, fileName: string): RawProfile {
  const root = asRecord(json, fileName);
  const meta = asRecord(root.meta, `${fileName}: meta`);
  const source = asRecord(meta.source, `${fileName}: meta.source`);
  const review = asRecord(meta.review, `${fileName}: meta.review`);

  return {
    fileName,
    qid: asString(source.wikidata_qid, `${fileName}: meta.source.wikidata_qid`),
    locale: asString(meta.locale, `${fileName}: meta.locale`),
    status: asString(review.status, `${fileName}: meta.review.status`),
    overview: asString(root.overview, `${fileName}: overview`),
    keyMoments: asArray(root.key_moments, `${fileName}: key_moments`).map(
      (item, index) => {
        const moment = asRecord(item, `${fileName}: key_moments[${index}]`);
        return {
          date: asString(
            moment.date,
            `${fileName}: key_moments[${index}].date`,
          ),
          title: asString(
            moment.title,
            `${fileName}: key_moments[${index}].title`,
          ),
          text: asString(
            moment.text,
            `${fileName}: key_moments[${index}].text`,
          ),
        };
      },
    ),
    deepFacts: asArray(root.deep_facts, `${fileName}: deep_facts`).map(
      (item, index) => {
        const fact = asRecord(item, `${fileName}: deep_facts[${index}]`);
        if (typeof fact.is_legend !== 'boolean') {
          throw new Error(
            `${fileName}: deep_facts[${index}].is_legend: expected a boolean`,
          );
        }
        return {
          text: asString(fact.text, `${fileName}: deep_facts[${index}].text`),
          isLegend: fact.is_legend,
        };
      },
    ),
    connections: asArray(root.connections, `${fileName}: connections`).map(
      (item, index) => {
        const connection = asRecord(item, `${fileName}: connections[${index}]`);
        return {
          qid: typeof connection.qid === 'string' ? connection.qid : undefined,
          reason: asString(
            connection.connection,
            `${fileName}: connections[${index}].connection`,
          ),
        };
      },
    ),
  };
}

// Reads every `<lane>/*.json` Profile under `dir`. The staging folder and the
// verifier's `*.verification.json` reports sit beside them and are not
// Profiles.
export async function readRawProfiles(dir: string): Promise<RawProfile[]> {
  const profiles: RawProfile[] = [];
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
      if (
        !fileName.endsWith('.json') ||
        fileName.endsWith('.verification.json')
      )
        continue;
      const json: unknown = JSON.parse(
        await readFile(path.join(laneDir, fileName), 'utf8'),
      );
      profiles.push(parseRawProfile(json, `${lane}/${fileName}`));
    }
  }
  return profiles;
}

// An entity a Profile can describe or connect to.
export interface ProfileTarget {
  // Wikidata QID. A Person's dataset `id` is Pantheon's, so it is not the join key.
  qid: string;
  slug: string;
  name: string;
  lane: ProfileLane;
  fameScore: number;
}

function resolveConnections(
  raw: RawProfile,
  targetByQid: ReadonlyMap<string, ProfileTarget>,
): ProfileConnection[] {
  const connections: ProfileConnection[] = [];
  const seen = new Set<string>();
  for (const { qid, reason } of raw.connections) {
    const target = qid === undefined ? undefined : targetByQid.get(qid);
    if (!target || target.qid === raw.qid || seen.has(target.qid)) continue;
    seen.add(target.qid);
    connections.push({
      slug: target.slug,
      reason,
      name: target.name,
      lane: target.lane,
      detailLevel: detailLevelOf(
        target.fameScore,
        DETAIL_LEVEL_FAME_SCORE_FLOORS[target.lane],
      ),
    });
  }
  return connections;
}

// The Profiles to ship, keyed by the entity's slug. Only `reviewed` and
// `edited` English Profiles ship; Russian files carry the English Profile whole
// (CONTEXT.md's Field Fallback), so a raw file in another locale is not read.
export function shipProfiles(
  rawProfiles: readonly RawProfile[],
  targets: readonly ProfileTarget[],
): Map<string, Profile> {
  const targetByQid = new Map(targets.map((target) => [target.qid, target]));
  const shipped = new Map<string, Profile>();

  for (const raw of rawProfiles) {
    if (raw.locale !== 'en' || !SHIPPED_STATUSES.has(raw.status)) continue;

    const subject = targetByQid.get(raw.qid);
    if (!subject)
      throw new Error(
        `${raw.fileName}: ${raw.qid} is not an entity in the dataset`,
      );
    if (shipped.has(subject.slug))
      throw new Error(`${raw.fileName}: a second Profile for ${raw.qid}`);

    assertBoldOnlyMarkup(raw.overview, `${raw.fileName}: overview`);
    raw.keyMoments.forEach((moment, index) => {
      assertBoldOnlyMarkup(
        moment.date,
        `${raw.fileName}: key_moments[${index}].date`,
      );
      assertBoldOnlyMarkup(
        moment.title,
        `${raw.fileName}: key_moments[${index}].title`,
      );
      assertBoldOnlyMarkup(
        moment.text,
        `${raw.fileName}: key_moments[${index}].text`,
      );
    });
    raw.deepFacts.forEach((fact, index) => {
      assertBoldOnlyMarkup(
        fact.text,
        `${raw.fileName}: deep_facts[${index}].text`,
      );
    });
    raw.connections.forEach((connection, index) => {
      assertBoldOnlyMarkup(
        connection.reason,
        `${raw.fileName}: connections[${index}].connection`,
      );
    });

    shipped.set(subject.slug, {
      overview: raw.overview,
      keyMoments: raw.keyMoments,
      deepFacts: raw.deepFacts,
      connections: resolveConnections(raw, targetByQid),
    });
  }

  return shipped;
}

// Marks each entity that has a shipped Profile (TimelineEntry.hasProfile).
export function withProfileFlags<T extends { slug: string }>(
  entries: T[],
  profiles: ReadonlyMap<string, Profile>,
): (T & { hasProfile?: true })[] {
  return entries.map((entry) =>
    profiles.has(entry.slug) ? { ...entry, hasProfile: true as const } : entry,
  );
}

// The locales a Profile ships in; `ru` is the English Profile until Russian
// Profiles exist.
const PROFILE_LOCALES = ['en', 'ru'] as const;

// Writes `<outputDir>/profiles/<locale>/<slug>.json`, replacing the previous
// run's files so a Profile that no longer ships does not linger.
export async function writeProfiles(
  outputDir: string,
  profiles: ReadonlyMap<string, Profile>,
): Promise<void> {
  const profilesDir = path.join(outputDir, 'profiles');
  await rm(profilesDir, { recursive: true, force: true });
  for (const locale of PROFILE_LOCALES) {
    const localeDir = path.join(profilesDir, locale);
    await mkdir(localeDir, { recursive: true });
    for (const [slug, profile] of profiles) {
      await writeFile(
        path.join(localeDir, `${slug}.json`),
        JSON.stringify(profile, null, 2),
      );
    }
  }
}
