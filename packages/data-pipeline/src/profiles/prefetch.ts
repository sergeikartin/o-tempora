import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getDomain } from 'tldts';
import { evidenceStore } from './evidence-cache.js';
import { writeJson } from './store.js';
import { type ProfileSubject, subjectBrief } from './subjects.js';
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

async function readBlockedHosts(file: string, now: number) {
  const hosts = new Map<string, BlockedHost>();
  try {
    const value: Record<string, BlockedHost> = JSON.parse(
      await readFile(file, 'utf8'),
    );
    for (const [host, entry] of Object.entries(value ?? {})) {
      if (
        typeof entry?.url === 'string' &&
        typeof entry.reason === 'string' &&
        Number.isFinite(entry.failed_at) &&
        now - entry.failed_at < BLOCK_TTL
      )
        hosts.set(host, entry);
    }
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code !== 'ENOENT' &&
      !(error instanceof SyntaxError)
    )
      throw error;
  }
  return hosts;
}

export async function prefetchSubject({
  subject,
  profilesDir,
  maxSources = 5,
  refresh = false,
  fetch = fetchSource,
  readLinks = fetchReferenceLinks,
  now = Date.now,
}: {
  subject: ProfileSubject;
  profilesDir: string;
  maxSources?: number;
  refresh?: boolean;
  fetch?: typeof fetchSource;
  readLinks?: typeof fetchReferenceLinks;
  now?: () => number;
}) {
  if (!/^Q\d+$/.test(subject.qid)) throw new Error('Invalid subject QID');
  if (!Number.isSafeInteger(maxSources))
    throw new Error('--max-sources must be an integer');
  const limit = Math.max(1, Math.min(8, maxSources));
  const directory = path.join(profilesDir, 'evidence');
  const blockedFile = path.join(directory, 'blocked-hosts.json');
  const blocked = refresh
    ? new Map<string, BlockedHost>()
    : await readBlockedHosts(blockedFile, now());
  const updates = new Map<string, BlockedHost | undefined>();
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
    const prior = blocked.get(host);
    if (prior) return { url, reason: `Blocked host: ${prior.reason}` };
    try {
      const outline = await store.readOutline(url);
      if (refresh) updates.set(host, undefined);
      return outline;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (
        error instanceof SourceFetchError &&
        (error.unsupportedType || [403, 410, 451].includes(error.status ?? 0))
      ) {
        updates.set(host, { url, reason, failed_at: now() });
      }
      return { url, reason };
    }
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

  if (updates.size) {
    const current = await readBlockedHosts(blockedFile, now());
    for (const [host, entry] of updates) {
      if (entry) current.set(host, entry);
      else current.delete(host);
    }
    await writeJson(blockedFile, Object.fromEntries(current));
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
