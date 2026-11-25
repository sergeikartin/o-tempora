import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { getDomain } from 'tldts';
import { evidenceStore } from './evidence-cache.js';
import { writeJson } from './store.js';
import { type ProfileSubject, subjectBrief } from './subjects.js';
import { asArray, asRecord, asString } from './values.js';
import { hash } from './verification/assessment.js';
import {
  fetchReferenceLinks,
  fetchSource,
  SourceFetchError,
  sourceUrl,
} from './verification/sources.js';

const BLOCK_TTL = 7 * 24 * 60 * 60 * 1_000;
const PREFETCH_MIN_TEXT_LENGTH = 1_000;
const MAX_EXPLICIT_URLS = 24;
const UNSUPPORTED_TYPE_REASON = 'Source is not readable HTML or plain text';

const INSTITUTIONS = new Set([
  'stanford.edu',
  'britannica.com',
  'st-andrews.ac.uk',
  'nobelprize.org',
  'nationalarchives.gov.uk',
  'folger.edu',
  'loc.gov',
  'bl.uk',
  'metmuseum.org',
  'britishmuseum.org',
  'vangoghmuseum.nl',
  'unesco.org',
  'nasa.gov',
  'who.int',
]);

export interface PrefetchDeepFactCandidate {
  angle: string;
  urls: string[];
}

export interface PrefetchManifest {
  qid?: string;
  core_urls: string[];
  deep_fact_candidates: PrefetchDeepFactCandidate[];
  dispute_urls: string[];
}

export interface PrefetchedDeepFactGroup {
  angle: string;
  source_ids: string[];
  skipped: { url: string; reason: string }[];
  corroboration_ready: boolean;
}

export interface PrefetchedManifestGroups {
  core: string[];
  deep_fact_candidates: PrefetchedDeepFactGroup[];
  dispute: string[];
}

function parseUrlList(value: unknown, label: string): string[] {
  if (value === undefined) return [];
  return asArray(value, label).map((item, index) => {
    const url = asString(item, `${label}[${index}]`).trim();
    if (!url) throw new Error(`${label}[${index}] must be a non-empty string`);
    return url;
  });
}

export function parsePrefetchManifest(
  value: unknown,
  expectedQid?: string,
): PrefetchManifest {
  const data = asRecord(value, 'prefetch manifest');
  const qid =
    data.qid === undefined
      ? undefined
      : asString(data.qid, 'manifest qid').trim();
  if (qid !== undefined && !/^Q\d+$/.test(qid))
    throw new Error('manifest qid must be a Wikidata QID');
  if (expectedQid && qid && qid !== expectedQid)
    throw new Error(`Prefetch manifest is for ${qid}, expected ${expectedQid}`);
  const core_urls = parseUrlList(data.core_urls, 'core_urls');
  const dispute_urls = parseUrlList(data.dispute_urls, 'dispute_urls');
  const deep_fact_candidates =
    data.deep_fact_candidates === undefined
      ? []
      : asArray(data.deep_fact_candidates, 'deep_fact_candidates').map(
          (item, index): PrefetchDeepFactCandidate => {
            const entry = asRecord(item, `deep_fact_candidates[${index}]`);
            const angle = asString(
              entry.angle,
              `deep_fact_candidates[${index}].angle`,
            ).trim();
            if (!angle)
              throw new Error(
                `deep_fact_candidates[${index}].angle must be non-empty`,
              );
            const urls = parseUrlList(
              entry.urls,
              `deep_fact_candidates[${index}].urls`,
            );
            if (!urls.length)
              throw new Error(
                `deep_fact_candidates[${index}].urls must contain at least one URL`,
              );
            return { angle, urls };
          },
        );
  const totalUrls =
    core_urls.length +
    dispute_urls.length +
    deep_fact_candidates.reduce((sum, item) => sum + item.urls.length, 0);
  if (totalUrls === 0)
    throw new Error('Prefetch manifest must contain at least one URL');
  return {
    ...(qid ? { qid } : {}),
    core_urls,
    deep_fact_candidates,
    dispute_urls,
  };
}

function rootHost(url: string): string {
  const { hostname } = sourceUrl(url);
  return getDomain(hostname, { allowPrivateDomains: true }) ?? hostname;
}

function blockHost(url: string): string {
  return sourceUrl(url)
    .hostname.replace(/^www\./, '')
    .toLowerCase();
}

function isWikipediaUrl(url: string): boolean {
  return getDomain(sourceUrl(url).hostname) === 'wikipedia.org';
}

function tier(host: string): number {
  if (INSTITUTIONS.has(host) || /\.(edu|ac\.uk|gov)$/.test(host)) return 1;
  return host.endsWith('.org') ? 2 : 3;
}

export function rankReferences(links: readonly string[]) {
  const ranked = links
    .map((url) => ({ url, host: rootHost(url) }))
    .sort((left, right) => tier(left.host) - tier(right.host));
  const seen = new Set<string>();
  return ranked.filter(({ host }) => {
    if (seen.has(host)) return false;
    seen.add(host);
    return true;
  });
}

type BlockedHost = { url: string; reason: string; failed_at: number };

async function readCache(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

function activeBlock(value: unknown, now: number): value is BlockedHost {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<BlockedHost>;
  return (
    typeof entry.url === 'string' &&
    typeof entry.reason === 'string' &&
    entry.reason !== UNSUPPORTED_TYPE_REASON &&
    typeof entry.failed_at === 'number' &&
    Number.isFinite(entry.failed_at) &&
    now - entry.failed_at < BLOCK_TTL
  );
}

interface PrefetchOptions {
  profilesDir: string;
  maxSources?: number;
  refresh?: boolean;
  manifest?: PrefetchManifest;
  urls?: readonly string[];
  fetch?: typeof fetchSource;
  readLinks?: typeof fetchReferenceLinks;
  now?: () => number;
}

export function validatePrefetchConcurrency(concurrency: number) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 3)
    throw new Error('--concurrency must be an integer from 1 to 3');
}

export async function prefetchBatch({
  subjects,
  concurrency = 1,
  ...options
}: PrefetchOptions & {
  subjects: readonly ProfileSubject[];
  concurrency?: number;
}) {
  validatePrefetchConcurrency(concurrency);
  const results: Awaited<ReturnType<typeof prefetchSubject>>[] = [];
  const queue = subjects.entries();
  const workers = await Promise.allSettled(
    Array.from({ length: Math.min(concurrency, subjects.length) }, async () => {
      for (const [index, subject] of queue)
        results[index] = await prefetchSubject({ subject, ...options });
    }),
  );
  for (const worker of workers) {
    if (worker.status === 'rejected') throw worker.reason;
  }
  return results;
}

export async function prefetchSubject({
  subject,
  profilesDir,
  maxSources = 5,
  refresh = false,
  manifest,
  urls,
  fetch = fetchSource,
  readLinks = fetchReferenceLinks,
  now = Date.now,
}: PrefetchOptions & { subject: ProfileSubject }) {
  if (!/^Q\d+$/.test(subject.qid)) throw new Error('Invalid subject QID');
  if (manifest && urls)
    throw new Error('Cannot combine prefetch manifest with explicit urls');
  if (!Number.isSafeInteger(maxSources))
    throw new Error('--max-sources must be an integer');
  const limit = Math.max(1, Math.min(8, maxSources));
  const explicitMode = manifest !== undefined || urls !== undefined;
  const directory = path.join(profilesDir, 'evidence');
  const legacy = await readCache(path.join(directory, 'blocked-hosts.json'));
  const legacyHosts =
    legacy && typeof legacy === 'object'
      ? (legacy as Record<string, unknown>)
      : {};
  const wikipediaUrl = sourceUrl(subject.wikipediaUrl).href;
  let links: string[] | undefined;
  const store = evidenceStore(
    profilesDir,
    (url) => {
      if (url === wikipediaUrl) {
        return fetch(
          url,
          explicitMode
            ? undefined
            : {
                onReferenceLinks: (references) => {
                  links = references;
                },
              },
        );
      }
      if (isWikipediaUrl(url)) return fetch(url);
      return fetch(url, {
        maxAttempts: 1,
        minTextLength: PREFETCH_MIN_TEXT_LENGTH,
        rejectBotWalls: true,
      });
    },
    refresh,
  );
  type Outline = Awaited<ReturnType<typeof store.readOutline>>;
  type ReadResult = Outline | { url: string; reason: string };
  const sources: Outline[] = [];
  const skipped: { url: string; reason: string }[] = [];

  async function read(url: string): Promise<ReadResult> {
    let normalized: string;
    let host: string;
    let root: string;
    try {
      normalized = sourceUrl(url).href;
      host = blockHost(normalized);
      root = rootHost(normalized);
    } catch (error) {
      return {
        url,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
    const hostKey = path.join(directory, 'blocked-hosts', hash(host));
    const blockedFile = `${hostKey}.json`;
    const clearedFile = `${hostKey}.cleared`;
    const legacyEntry = Object.hasOwn(legacyHosts, host)
      ? legacyHosts[host]
      : Object.hasOwn(legacyHosts, root)
        ? legacyHosts[root]
        : undefined;
    if (!refresh) {
      const entry = await readCache(blockedFile);
      const prior =
        entry === undefined &&
        activeBlock(legacyEntry, now()) &&
        (await readCache(clearedFile)) === undefined
          ? legacyEntry
          : entry;
      if (activeBlock(prior, now()))
        return { url: normalized, reason: `Blocked host: ${prior.reason}` };
    }
    let outline: Outline;
    try {
      outline = await store.readOutline(normalized);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (
        error instanceof SourceFetchError &&
        (error.botChallenge || [403, 410, 451].includes(error.status ?? 0))
      ) {
        await writeJson(blockedFile, {
          host,
          url: normalized,
          reason,
          failed_at: now(),
        });
      }
      return { url: normalized, reason };
    }
    if (refresh) {
      // Suppress a legacy entry without changing the shared legacy file.
      if (activeBlock(legacyEntry, now())) await writeJson(clearedFile, true);
      await rm(blockedFile, { force: true });
    }
    return outline;
  }

  const wikipedia = await read(wikipediaUrl);
  if ('reason' in wikipedia) skipped.push(wikipedia);
  else sources.push(wikipedia);

  let manifestGroups: PrefetchedManifestGroups | undefined;

  if (explicitMode) {
    const rawUrls = manifest
      ? [
          ...manifest.core_urls,
          ...manifest.deep_fact_candidates.flatMap((entry) => entry.urls),
          ...manifest.dispute_urls,
        ]
      : [...(urls ?? [])];
    const resultsByUrl = new Map<string, ReadResult>();
    if (!('reason' in wikipedia)) {
      resultsByUrl.set(wikipediaUrl, wikipedia);
      resultsByUrl.set(wikipedia.url, wikipedia);
    }
    const pending: string[] = [];
    const seenNormalized = new Set<string>(resultsByUrl.keys());
    const invalidByRaw = new Map<string, { url: string; reason: string }>();

    for (const raw of rawUrls) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      let normalized: string;
      try {
        normalized = sourceUrl(trimmed).href;
      } catch (error) {
        const entry = {
          url: trimmed,
          reason: error instanceof Error ? error.message : String(error),
        };
        if (!invalidByRaw.has(trimmed)) {
          invalidByRaw.set(trimmed, entry);
          skipped.push(entry);
        }
        continue;
      }
      if (seenNormalized.has(normalized)) continue;
      seenNormalized.add(normalized);
      if (pending.length >= MAX_EXPLICIT_URLS) {
        const entry = {
          url: normalized,
          reason: `Exceeded explicit URL limit (${MAX_EXPLICIT_URLS})`,
        };
        resultsByUrl.set(normalized, entry);
        skipped.push(entry);
        continue;
      }
      pending.push(normalized);
    }

    const seenIds = new Set(sources.map(({ id }) => id));
    for (let i = 0; i < pending.length; i += 3) {
      const batch = pending.slice(i, i + 3);
      const batchResults = await Promise.all(batch.map((url) => read(url)));
      for (const [index, result] of batchResults.entries()) {
        const requested = batch[index] as string;
        resultsByUrl.set(requested, result);
        if ('reason' in result) skipped.push(result);
        else {
          resultsByUrl.set(result.url, result);
          if (!seenIds.has(result.id)) {
            seenIds.add(result.id);
            sources.push(result);
          }
        }
      }
    }

    if (manifest) {
      const lookupRaw = (raw: string): ReadResult | undefined => {
        const trimmed = raw.trim();
        const invalid = invalidByRaw.get(trimmed);
        if (invalid) return invalid;
        try {
          return resultsByUrl.get(sourceUrl(trimmed).href);
        } catch {
          return undefined;
        }
      };
      const collectIds = (list: readonly string[]): string[] => {
        const ids = new Set<string>();
        for (const raw of list) {
          const entry = lookupRaw(raw);
          if (entry && !('reason' in entry)) ids.add(entry.id);
        }
        return [...ids];
      };
      manifestGroups = {
        core: collectIds(manifest.core_urls),
        deep_fact_candidates: manifest.deep_fact_candidates.map(
          ({ angle, urls: candidateUrls }) => {
            const ids = new Set<string>();
            const candidateSkipped: { url: string; reason: string }[] = [];
            const rootHosts = new Set<string>();
            const nonWikiRootHosts = new Set<string>();
            for (const raw of candidateUrls) {
              const entry = lookupRaw(raw);
              if (!entry) continue;
              if ('reason' in entry) {
                candidateSkipped.push(entry);
              } else {
                ids.add(entry.id);
                const root = rootHost(entry.url);
                rootHosts.add(root);
                if (!isWikipediaUrl(entry.url)) nonWikiRootHosts.add(root);
              }
            }
            return {
              angle,
              source_ids: [...ids],
              skipped: candidateSkipped,
              corroboration_ready:
                rootHosts.size >= 2 && nonWikiRootHosts.size >= 1,
            };
          },
        ),
        dispute: collectIds(manifest.dispute_urls),
      };
    }
  } else {
    if (!('reason' in wikipedia) && links === undefined) {
      try {
        links = await readLinks(wikipedia.url);
      } catch (error) {
        skipped.push({
          url: wikipedia.url,
          reason: `Reference links: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    const candidates = rankReferences(links ?? []);
    const used = new Set(sources.map(({ url }) => rootHost(url)));
    for (
      let i = 0;
      i < candidates.length && sources.length < limit + 1 && sources.length > 0;
    ) {
      const batch = candidates.slice(
        i,
        i + Math.min(3, limit + 1 - sources.length),
      );
      i += batch.length;
      const results = await Promise.all(batch.map(({ url }) => read(url)));
      for (const result of results) {
        if ('reason' in result) skipped.push(result);
        else {
          const host = rootHost(result.url);
          if (used.has(host))
            skipped.push({
              url: result.url,
              reason: 'Duplicate final source host',
            });
          else {
            used.add(host);
            sources.push(result);
          }
        }
      }
    }
  }

  const result = {
    qid: subject.qid,
    subject: subjectBrief(subject),
    sources: sources.map((source) => ({
      ...source,
      headings: source.headings.filter(({ level }) => level <= 3).slice(0, 60),
    })),
    skipped,
    ...(manifestGroups ? { manifest_groups: manifestGroups } : {}),
  };
  await writeJson(
    path.join(directory, 'prefetch', `${subject.qid}.json`),
    result,
  );
  return result;
}
