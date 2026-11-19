import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  DETAIL_LEVEL_FAME_SCORE_FLOORS,
  PROFILE_LANES,
  type Profile,
  type ProfileConnection,
  type ProfileDeepFact,
  type ProfileKeyMoment,
  type ProfileLane,
} from '@o-tempora/shared-types';
import { assertBoldOnlyMarkup } from '../profiles/markup.js';
import {
  approvedTranslation,
  readTranslation,
  type TranslationFields,
} from '../profiles/translation.js';
import { asArray, asRecord, asString } from '../profiles/values.js';
import { hasApproval } from '../profiles/verification/policy.js';

import { detailLevelOf } from './write-datasets.js';

export { assertBoldOnlyMarkup } from '../profiles/markup.js';
export { asArray, asRecord, asString } from '../profiles/values.js';

// The slice of a raw Profile file (prompts/profile.md's JSON plus the `meta`
// the profiles script adds, docs/adr/0022-...) that Output reads. Claims,
// confidence, importance and the Deep Fact type are review material
// and never ship.
export interface RawProfile {
  fileName: string;
  qid: string;
  locale: string;
  status: string;
  approved: boolean;
  verifiedDates?: string;
  russian?: TranslationFields;
  overview: string;
  keyMoments: ProfileKeyMoment[];
  deepFacts: ProfileDeepFact[];
  // `qid` is the target's Wikidata ID, resolved from its Wikipedia URL by the
  // profiles script; a Connection without one cannot be resolved.
  connections: { qid?: string; reason: string }[];
}

// These statuses still require a current verification receipt to ship.
const SHIPPED_STATUSES: ReadonlySet<string> = new Set(['reviewed', 'edited']);

// Older Profiles can lack a source, and `not_on_wikipedia` is a review
// sentinel. Neither should become a link, nor should malformed/unsafe URLs.
function parseSource(value: unknown): { sourceUrl?: string } {
  if (typeof value !== 'string') return {};
  try {
    const url = new URL(value);
    if (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      !url.username &&
      !url.password
    ) {
      return { sourceUrl: url.href };
    }
  } catch {}
  return {};
}

export function parseRawProfile(
  json: unknown,
  fileName: string,
  report?: unknown,
): RawProfile {
  const root = asRecord(json, fileName);
  const meta = asRecord(root.meta, `${fileName}: meta`);
  const source = asRecord(meta.source, `${fileName}: meta.source`);
  const review = asRecord(meta.review, `${fileName}: meta.review`);

  const parsed: RawProfile = {
    fileName,
    qid: asString(source.wikidata_qid, `${fileName}: meta.source.wikidata_qid`),
    locale: asString(meta.locale, `${fileName}: meta.locale`),
    status: asString(review.status, `${fileName}: meta.review.status`),
    approved: false,
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
          ...parseSource(moment.source),
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
          ...parseSource(fact.source),
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
  parsed.approved = hasApproval(json, report, [
    'overview',
    ...parsed.keyMoments.flatMap((_, i) =>
      ['date', 'title', 'text'].map((field) => `key_moments.${i}.${field}`),
    ),
    ...parsed.deepFacts.map((_, i) => `deep_facts.${i}.text`),
    ...parsed.connections.map((_, i) => `connections.${i}.connection`),
  ]);
  if (parsed.approved) {
    const subject = asRecord(
      asRecord(report, 'report').subject,
      'report.subject',
    );
    parsed.verifiedDates = asString(subject.dates, 'report.subject.dates');
  }
  return parsed;
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
        fileName.endsWith('.verification.json') ||
        fileName.includes('.translation.')
      )
        continue;
      const json: unknown = JSON.parse(
        await readFile(path.join(laneDir, fileName), 'utf8'),
      );
      let report: unknown;
      try {
        report = JSON.parse(
          await readFile(
            path.join(
              laneDir,
              fileName.replace(/\.json$/, '.verification.json'),
            ),
            'utf8',
          ),
        );
      } catch (error) {
        if (
          (error as NodeJS.ErrnoException).code !== 'ENOENT' &&
          !(error instanceof SyntaxError)
        )
          throw error;
      }
      const raw = parseRawProfile(json, `${lane}/${fileName}`, report);
      if (raw.approved && fileName.endsWith('.en.json')) {
        raw.russian = approvedTranslation(
          await readTranslation(path.join(laneDir, fileName)),
          json,
        );
      }
      profiles.push(raw);
    }
  }
  return profiles;
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
  raw: RawProfile,
  targetByQid: ReadonlyMap<string, ProfileTarget>,
  locale: 'en' | 'ru',
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
      name: locale === 'ru' ? (target.nameRu ?? target.name) : target.name,
      lane: target.lane,
      detailLevel: detailLevelOf(
        target.fameScore,
        DETAIL_LEVEL_FAME_SCORE_FLOORS[target.lane],
      ),
    });
  }
  return connections;
}

// The Profiles to ship, keyed by the entity's slug. Only approved `reviewed`
// and `edited` English Profiles ship. Russian output additionally requires a
// current translation approval; absent/stale translations leave Description.
export function shipProfiles(
  rawProfiles: readonly RawProfile[],
  targets: readonly ProfileTarget[],
  locale: 'en' | 'ru' = 'en',
): Map<string, Profile> {
  const targetByQid = new Map(targets.map((target) => [target.qid, target]));
  const shipped = new Map<string, Profile>();

  for (const original of rawProfiles) {
    let raw = original;
    if (
      raw.locale !== 'en' ||
      !SHIPPED_STATUSES.has(raw.status) ||
      !raw.approved
    )
      continue;

    const subject = targetByQid.get(raw.qid);
    if (!subject)
      throw new Error(
        `${raw.fileName}: ${raw.qid} is not an entity in the dataset`,
      );
    if (raw.verifiedDates !== subject.dates) continue;
    if (locale === 'ru') {
      if (!raw.russian) continue;
      const fields = raw.russian;
      const text = (path: string) =>
        asString(fields[path], `${raw.fileName}: Russian ${path}`);
      raw = {
        ...raw,
        overview: text('overview'),
        keyMoments: raw.keyMoments.map((moment, i) => ({
          ...moment,
          date: text(`key_moments.${i}.date`),
          title: text(`key_moments.${i}.title`),
          text: text(`key_moments.${i}.text`),
        })),
        deepFacts: raw.deepFacts.map((fact, i) => ({
          ...fact,
          text: text(`deep_facts.${i}.text`),
        })),
        connections: raw.connections.map((connection, i) => ({
          ...connection,
          reason: text(`connections.${i}.connection`),
        })),
      };
    }
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
      connections: resolveConnections(raw, targetByQid, locale),
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
