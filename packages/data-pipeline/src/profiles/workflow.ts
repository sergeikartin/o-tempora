import path from 'node:path';
import type { ProfileLane } from '@o-tempora/shared-types';
import { RAW_PROFILES_DIR, SOURCES_DIR, WORK_DIR, workFile } from './paths.ts';
import {
  type CheckVerdict,
  computeEnglishSourceHash,
  type ProfileLocale,
  type StoredProfile,
} from './schemas.ts';
import {
  fetchSource,
  readSourceIndex,
  resolveRussianWikipediaUrl,
} from './sources.ts';
import {
  committedProfilePath,
  readCommittedProfiles,
  readJsonIfExists,
  writeJsonFile,
} from './store.ts';
import { formatDates, type ProfileSubject, SUBJECT_TYPE } from './subjects.ts';
import { validateCheck, validateDraft } from './validate.ts';

export type ProfileStage =
  | 'missing'
  | 'approved'
  | 'stale'
  | 'needs-review'
  | 'awaiting-english';

export type StatusScope = 'legendary' | 'mainstream' | 'all';

export interface StatusEntry {
  qid: string;
  slug: string;
  name: string;
  lane: ProfileLane;
  detailLevel: 1 | 2 | 3 | 4;
  fameScore: number;
  dates: string;
  stage: ProfileStage;
  hasDraft?: true;
  reason?: string;
}

export interface StatusResult {
  locale: ProfileLocale;
  total: number;
  counts: Record<ProfileStage, number>;
  items: StatusEntry[];
}

async function readCheckState(
  qid: string,
  locale: ProfileLocale,
  workDir: string,
): Promise<{ hasDraft: boolean; needsReviewReason?: string }> {
  const draft = await readJsonIfExists(
    workFile(qid, `${locale}.draft.json`, workDir),
  );
  const recheckRaw = await readJsonIfExists(
    workFile(qid, `${locale}.recheck.json`, workDir),
  );
  if (recheckRaw !== undefined) {
    const parsed = validateCheck(recheckRaw, { qid, locale });
    if (parsed.ok && parsed.data && parsed.data.verdict !== 'pass') {
      const summary =
        parsed.data.blockers[0]?.issue ??
        `recheck verdict: ${parsed.data.verdict}`;
      return { hasDraft: draft !== undefined, needsReviewReason: summary };
    }
  }
  const checkRaw = await readJsonIfExists(
    workFile(qid, `${locale}.check.json`, workDir),
  );
  if (checkRaw !== undefined) {
    const parsed = validateCheck(checkRaw, { qid, locale });
    if (parsed.ok && parsed.data && parsed.data.verdict === 'escalate') {
      const summary =
        parsed.data.blockers[0]?.issue ?? 'checker requested human escalation';
      return { hasDraft: draft !== undefined, needsReviewReason: summary };
    }
  }
  return { hasDraft: draft !== undefined };
}

export interface StatusOptions {
  locale: ProfileLocale;
  scope?: StatusScope;
  qids?: readonly string[];
  stages?: readonly ProfileStage[];
  limit?: number;
  subjects: readonly ProfileSubject[];
  rawProfilesDir?: string;
  workDir?: string;
}

export async function getProfileStatus({
  locale,
  scope = 'mainstream',
  qids,
  stages,
  limit,
  subjects,
  rawProfilesDir = RAW_PROFILES_DIR,
  workDir = WORK_DIR,
}: StatusOptions): Promise<StatusResult> {
  const committed = await readCommittedProfiles(rawProfilesDir);
  const enByQid = new Map<string, StoredProfile>();
  const ruByQid = new Map<string, StoredProfile>();
  for (const record of committed) {
    if (record.profile.meta.locale === 'en') {
      enByQid.set(record.profile.meta.qid, record.profile);
    } else {
      ruByQid.set(record.profile.meta.qid, record.profile);
    }
  }

  let selected: ProfileSubject[];
  if (qids && qids.length > 0) {
    const byQid = new Map(subjects.map((subject) => [subject.qid, subject]));
    selected = qids.map((qid) => {
      const found = byQid.get(qid);
      if (!found) throw new Error(`Unknown dataset QID: ${qid}`);
      return found;
    });
  } else {
    const maxLevel = scope === 'legendary' ? 1 : scope === 'mainstream' ? 2 : 4;
    selected = subjects
      .filter((subject) => subject.detailLevel <= maxLevel)
      .sort(
        (a, b) => a.detailLevel - b.detailLevel || b.fameScore - a.fameScore,
      );
  }

  const stageFilter = stages && stages.length > 0 ? new Set(stages) : undefined;
  const includeAwaitingEnglish =
    (qids && qids.length > 0) || stageFilter?.has('awaiting-english') === true;

  const items: StatusEntry[] = [];
  for (const subject of selected) {
    const dates = formatDates(subject.dateSpan);
    const en = enByQid.get(subject.qid);
    const enCurrent = en !== undefined && en.meta.subjectDates === dates;

    let stage: ProfileStage;
    let reason: string | undefined;
    let hasDraft = false;

    if (locale === 'en') {
      if (en) {
        if (enCurrent) {
          stage = 'approved';
        } else {
          stage = 'stale';
          reason = `subjectDates "${en.meta.subjectDates}" != dataset "${dates}"`;
        }
      } else {
        const work = await readCheckState(subject.qid, 'en', workDir);
        hasDraft = work.hasDraft;
        if (work.needsReviewReason) {
          stage = 'needs-review';
          reason = work.needsReviewReason;
        } else {
          stage = 'missing';
        }
      }
    } else {
      if (!enCurrent) {
        if (!includeAwaitingEnglish) continue;
        stage = 'awaiting-english';
        reason = en
          ? 'English Profile is stale'
          : 'No approved English Profile';
      } else {
        const ru = ruByQid.get(subject.qid);
        const expectedHash = computeEnglishSourceHash(en);
        if (ru) {
          if (
            ru.meta.sourceHash === expectedHash &&
            ru.meta.subjectDates === dates
          ) {
            stage = 'approved';
          } else {
            stage = 'stale';
            reason =
              ru.meta.sourceHash !== expectedHash
                ? 'English prose changed since Russian translation'
                : `subjectDates "${ru.meta.subjectDates}" != dataset "${dates}"`;
          }
        } else {
          const work = await readCheckState(subject.qid, 'ru', workDir);
          hasDraft = work.hasDraft;
          if (work.needsReviewReason) {
            stage = 'needs-review';
            reason = work.needsReviewReason;
          } else {
            stage = 'missing';
          }
        }
      }
    }

    if (stageFilter && !stageFilter.has(stage)) continue;
    items.push({
      qid: subject.qid,
      slug: subject.slug,
      name: subject.name,
      lane: subject.lane,
      detailLevel: subject.detailLevel,
      fameScore: subject.fameScore,
      dates,
      stage,
      ...(hasDraft ? { hasDraft: true } : {}),
      ...(reason ? { reason } : {}),
    });
  }

  const limited = limit !== undefined ? items.slice(0, limit) : items;
  const counts: Record<ProfileStage, number> = {
    missing: 0,
    approved: 0,
    stale: 0,
    'needs-review': 0,
    'awaiting-english': 0,
  };
  for (const item of limited) counts[item.stage] += 1;

  return {
    locale,
    total: limited.length,
    counts,
    items: limited,
  };
}

export interface PrepareOptions {
  qids: readonly string[];
  locale: ProfileLocale;
  subjects: readonly ProfileSubject[];
  rawProfilesDir?: string;
  workDir?: string;
  sourcesDir?: string;
  refresh?: boolean;
  fetchImpl?: typeof fetch;
}

export async function prepareProfiles({
  qids,
  locale,
  subjects,
  rawProfilesDir = RAW_PROFILES_DIR,
  workDir = WORK_DIR,
  sourcesDir = SOURCES_DIR,
  refresh = false,
  fetchImpl = fetch,
}: PrepareOptions): Promise<
  { qid: string; briefPath: string; wikipediaPath?: string }[]
> {
  const byQid = new Map(subjects.map((subject) => [subject.qid, subject]));
  const committed =
    locale === 'ru' ? await readCommittedProfiles(rawProfilesDir) : [];
  const enByQid = new Map(
    committed
      .filter((record) => record.profile.meta.locale === 'en')
      .map((record) => [record.profile.meta.qid, record.profile]),
  );

  const prepared: {
    qid: string;
    briefPath: string;
    wikipediaPath?: string;
  }[] = [];

  for (const qid of qids) {
    const subject = byQid.get(qid);
    if (!subject) throw new Error(`Unknown dataset QID: ${qid}`);
    const dates = formatDates(subject.dateSpan);

    if (locale === 'en') {
      const wiki = await fetchSource(subject.wikipediaUrl, {
        sourcesDir,
        refresh,
        fetchImpl,
      });
      const briefPath = workFile(qid, 'en.brief.json', workDir);
      await writeJsonFile(briefPath, {
        qid: subject.qid,
        type: SUBJECT_TYPE[subject.lane],
        lane: subject.lane,
        slug: subject.slug,
        name: subject.name,
        ...(subject.tagline ? { tagline: subject.tagline } : {}),
        dates,
        wikipediaUrl: subject.wikipediaUrl,
        wikipediaSource: {
          finalUrl: wiki.finalUrl,
          title: wiki.title,
          path: wiki.path,
          lineCount: wiki.lineCount,
          headings: wiki.headings,
        },
        draftPath: workFile(qid, 'en.draft.json', workDir),
      });
      prepared.push({ qid, briefPath, wikipediaPath: wiki.path });
    } else {
      const english = enByQid.get(qid);
      if (!english) {
        throw new Error(
          `Cannot prepare Russian translation for ${qid}: no committed English Profile`,
        );
      }
      const sourceHash = computeEnglishSourceHash(english);
      let russianWikipedia:
        | {
            url: string;
            finalUrl: string;
            title: string;
            path: string;
            lineCount: number;
            headings: { level: number; heading: string; line: number }[];
          }
        | undefined;
      try {
        const ruUrl = await resolveRussianWikipediaUrl(qid, fetchImpl);
        if (ruUrl) {
          const wiki = await fetchSource(ruUrl, {
            sourcesDir,
            refresh,
            fetchImpl,
          });
          russianWikipedia = {
            url: ruUrl,
            finalUrl: wiki.finalUrl,
            title: wiki.title,
            path: wiki.path,
            lineCount: wiki.lineCount,
            headings: wiki.headings,
          };
        }
      } catch {
        // Russian Wikipedia is helpful context, not a hard blocker for translation.
      }

      const connectionNamesRu = Object.fromEntries(
        english.connections.map((conn) => {
          const target = byQid.get(conn.qid);
          return [conn.qid, target?.ru?.name ?? target?.name ?? conn.qid];
        }),
      );

      const briefPath = workFile(qid, 'ru.brief.json', workDir);
      await writeJsonFile(briefPath, {
        qid: subject.qid,
        lane: subject.lane,
        slug: subject.slug,
        nameEn: subject.name,
        nameRu: subject.ru?.name ?? subject.name,
        ...(subject.ru?.tagline ? { taglineRu: subject.ru.tagline } : {}),
        dates,
        sourceHash,
        connectionNamesRu,
        englishProfile: {
          overview: english.overview,
          keyMoments: english.keyMoments,
          deepFacts: english.deepFacts,
          connections: english.connections,
        },
        ...(russianWikipedia ? { russianWikipedia } : {}),
        draftPath: workFile(qid, 'ru.draft.json', workDir),
      });
      prepared.push({
        qid,
        briefPath,
        ...(russianWikipedia ? { wikipediaPath: russianWikipedia.path } : {}),
      });
    }
  }

  return prepared;
}

export interface PromoteOptions {
  qid: string;
  locale: ProfileLocale;
  subjects: readonly ProfileSubject[];
  force?: boolean;
  humanApproved?: boolean;
  rawProfilesDir?: string;
  workDir?: string;
  sourcesDir?: string;
}

export async function promoteProfile({
  qid,
  locale,
  subjects,
  force = false,
  humanApproved = false,
  rawProfilesDir = RAW_PROFILES_DIR,
  workDir = WORK_DIR,
  sourcesDir = SOURCES_DIR,
}: PromoteOptions): Promise<{
  filePath: string;
  qid: string;
  locale: ProfileLocale;
}> {
  const byQid = new Map(subjects.map((subject) => [subject.qid, subject]));
  const subject = byQid.get(qid);
  if (!subject) throw new Error(`Unknown dataset QID: ${qid}`);

  const committed = await readCommittedProfiles(rawProfilesDir);
  const existing = committed.find(
    (record) =>
      record.profile.meta.qid === qid && record.profile.meta.locale === locale,
  );
  if (existing && !force) {
    throw new Error(
      `Committed Profile already exists at ${existing.fileName}. Pass --force to overwrite.`,
    );
  }

  const englishProfile =
    locale === 'ru'
      ? committed.find(
          (record) =>
            record.profile.meta.qid === qid &&
            record.profile.meta.locale === 'en',
        )?.profile
      : undefined;

  const draftPath = workFile(qid, `${locale}.draft.json`, workDir);
  const draftRaw = await readJsonIfExists(draftPath);
  if (draftRaw === undefined) {
    throw new Error(`Missing draft file: ${draftPath}`);
  }

  const sourceIndex =
    locale === 'en' ? await readSourceIndex(sourcesDir) : undefined;
  const draftValidation = validateDraft(draftRaw, {
    locale,
    subject,
    subjectByQid: byQid,
    sourceIndex,
    englishProfile,
  });
  if (!draftValidation.ok || !draftValidation.data) {
    throw new Error(
      `Draft failed validation:\n- ${draftValidation.issues.join('\n- ')}`,
    );
  }

  let checkerModel: string | undefined;
  if (!humanApproved) {
    const patchExists =
      (await readJsonIfExists(
        workFile(qid, `${locale}.patch.json`, workDir),
      )) !== undefined;
    const checkFileName = patchExists
      ? `${locale}.recheck.json`
      : `${locale}.check.json`;
    const checkPath = workFile(qid, checkFileName, workDir);
    const checkRaw = await readJsonIfExists(checkPath);
    if (checkRaw === undefined) {
      throw new Error(
        `Missing checker verdict: ${path.basename(checkPath)} (or pass --human-approved after manual review)`,
      );
    }
    const checkValidation = validateCheck(checkRaw, { qid, locale });
    if (!checkValidation.ok || !checkValidation.data) {
      throw new Error(
        `Invalid checker verdict (${checkFileName}): ${checkValidation.issues.join('; ')}`,
      );
    }
    const verdict: CheckVerdict = checkValidation.data;
    if (verdict.verdict !== 'pass') {
      throw new Error(
        `Cannot promote ${qid} (${locale}): latest verdict is "${verdict.verdict}" (${verdict.blockers.length} blocker(s))`,
      );
    }
    checkerModel = verdict.checkerModel;
  }

  const draft = draftValidation.data;
  const stored: StoredProfile = {
    overview: draft.overview,
    keyMoments: draft.keyMoments,
    deepFacts: draft.deepFacts,
    connections: draft.connections,
    meta: {
      qid: subject.qid,
      locale,
      subjectDates: draft.subjectDates,
      approvedAt: new Date().toISOString(),
      ...(locale === 'ru' && draft.sourceHash
        ? { sourceHash: draft.sourceHash }
        : {}),
      ...(draft.writerModel ? { writerModel: draft.writerModel } : {}),
      ...(checkerModel ? { checkerModel } : {}),
    },
  };

  const targetPath =
    existing?.filePath ??
    committedProfilePath(
      subject.lane,
      subject.qid,
      subject.slug,
      locale,
      rawProfilesDir,
    );
  await writeJsonFile(targetPath, stored);
  return { filePath: targetPath, qid, locale };
}
