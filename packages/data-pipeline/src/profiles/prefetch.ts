import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { getDomain } from 'tldts';
import { evidenceStore } from './evidence-cache.js';
import { writeJson } from './store.js';
import { type ProfileSubject, subjectBrief } from './subjects.js';
import { hash } from './verification/assessment.js';
import {
  fetchReferenceLinks,
  fetchSource,
  SourceFetchError,
  sourceUrl,
} from './verification/sources.js';

const BLOCK_TTL = 7 * 24 * 60 * 60 * 1_000;
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

function rootHost(url: string): string {
  const { hostname } = sourceUrl(url);
  return getDomain(hostname, { allowPrivateDomains: true }) ?? hostname;
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
    typeof entry.failed_at === 'number' &&
    Number.isFinite(entry.failed_at) &&
    now - entry.failed_at < BLOCK_TTL
  );
}

interface PrefetchOptions {
  profilesDir: string;
  maxSources?: number;
  refresh?: boolean;
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
  fetch = fetchSource,
  readLinks = fetchReferenceLinks,
  now = Date.now,
}: PrefetchOptions & { subject: ProfileSubject }) {
  if (!/^Q\d+$/.test(subject.qid)) throw new Error('Invalid subject QID');
  if (!Number.isSafeInteger(maxSources))
    throw new Error('--max-sources must be an integer');
  const limit = Math.max(1, Math.min(8, maxSources));
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
    (url) =>
      fetch(
        url,
        url === wikipediaUrl
          ? {
              onReferenceLinks: (references) => {
                links = references;
              },
            }
          : undefined,
      ),
    refresh,
  );
  const sources: Awaited<ReturnType<typeof store.readOutline>>[] = [];
  const skipped: { url: string; reason: string }[] = [];

  async function read(url: string, host: string) {
    const hostKey = path.join(directory, 'blocked-hosts', hash(host));
    const blockedFile = `${hostKey}.json`;
    const clearedFile = `${hostKey}.cleared`;
    const legacyEntry = Object.hasOwn(legacyHosts, host)
      ? legacyHosts[host]
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
        return { url, reason: `Blocked host: ${prior.reason}` };
    }
    let outline: Awaited<ReturnType<typeof store.readOutline>>;
    try {
      outline = await store.readOutline(url);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (
        error instanceof SourceFetchError &&
        (error.unsupportedType || [403, 410, 451].includes(error.status ?? 0))
      ) {
        await writeJson(blockedFile, { host, url, reason, failed_at: now() });
      }
      return { url, reason };
    }
    if (refresh) {
      // Suppress a legacy entry without changing the shared legacy file.
      if (activeBlock(legacyEntry, now())) await writeJson(clearedFile, true);
      await rm(blockedFile, { force: true });
    }
    return outline;
  }

  const wikipedia = await read(wikipediaUrl, rootHost(wikipediaUrl));
  if ('reason' in wikipedia) skipped.push(wikipedia);
  else {
    sources.push(wikipedia);
    if (links === undefined) {
      try {
        links = await readLinks(wikipedia.url);
      } catch (error) {
        skipped.push({
          url: wikipedia.url,
          reason: `Reference links: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
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
    const results = await Promise.all(
      batch.map(({ url, host }) => read(url, host)),
    );
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

  const result = {
    qid: subject.qid,
    subject: subjectBrief(subject),
    sources: sources.map((source) => ({
      ...source,
      headings: source.headings.filter(({ level }) => level <= 3).slice(0, 60),
    })),
    skipped,
  };
  await writeJson(
    path.join(directory, 'prefetch', `${subject.qid}.json`),
    result,
  );
  return result;
}
