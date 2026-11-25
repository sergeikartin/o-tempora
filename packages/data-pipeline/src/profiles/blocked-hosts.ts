import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { getDomain } from 'tldts';
import { writeJson } from './store.js';
import { hash } from './verification/assessment.js';
import { SourceFetchError, sourceUrl } from './verification/sources.js';

export const BLOCK_TTL = 7 * 24 * 60 * 60 * 1_000;
const UNSUPPORTED_TYPE_REASON = 'Source is not readable HTML or plain text';

export type BlockedHostEntry = {
  url: string;
  reason: string;
  failed_at: number;
};

export function rootHost(url: string): string {
  const { hostname } = sourceUrl(url);
  return getDomain(hostname, { allowPrivateDomains: true }) ?? hostname;
}

export function blockHost(url: string): string {
  return sourceUrl(url)
    .hostname.replace(/^www\./, '')
    .toLowerCase();
}

export function isBlockableFetchError(
  error: unknown,
): error is SourceFetchError {
  return (
    error instanceof SourceFetchError &&
    (error.botChallenge || [403, 410, 451].includes(error.status ?? 0))
  );
}

async function readCache(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

function activeBlock(value: unknown, now: number): value is BlockedHostEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<BlockedHostEntry>;
  return (
    typeof entry.url === 'string' &&
    typeof entry.reason === 'string' &&
    entry.reason !== UNSUPPORTED_TYPE_REASON &&
    typeof entry.failed_at === 'number' &&
    Number.isFinite(entry.failed_at) &&
    now - entry.failed_at < BLOCK_TTL
  );
}

export function createBlockedHostCache(
  evidenceDir: string,
  now: () => number = Date.now,
) {
  let legacyPromise: Promise<Record<string, unknown>> | undefined;
  const loadLegacy = () => {
    legacyPromise ??= readCache(
      path.join(evidenceDir, 'blocked-hosts.json'),
    ).then((value) =>
      value && typeof value === 'object'
        ? (value as Record<string, unknown>)
        : {},
    );
    return legacyPromise;
  };

  function pathsFor(normalizedUrl: string) {
    const host = blockHost(normalizedUrl);
    const root = rootHost(normalizedUrl);
    const key = path.join(evidenceDir, 'blocked-hosts', hash(host));
    return {
      host,
      root,
      blockedFile: `${key}.json`,
      clearedFile: `${key}.cleared`,
    };
  }

  async function legacyFor(host: string, root: string): Promise<unknown> {
    const legacy = await loadLegacy();
    return Object.hasOwn(legacy, host)
      ? legacy[host]
      : Object.hasOwn(legacy, root)
        ? legacy[root]
        : undefined;
  }

  return {
    async check(normalizedUrl: string): Promise<string | undefined> {
      const { host, root, blockedFile, clearedFile } = pathsFor(normalizedUrl);
      const entry = await readCache(blockedFile);
      const timestamp = now();
      let prior = entry;
      if (entry === undefined) {
        const legacy = await legacyFor(host, root);
        if (
          activeBlock(legacy, timestamp) &&
          (await readCache(clearedFile)) === undefined
        ) {
          prior = legacy;
        }
      }
      return activeBlock(prior, timestamp) ? prior.reason : undefined;
    },

    async record(normalizedUrl: string, reason: string): Promise<void> {
      const { host, blockedFile } = pathsFor(normalizedUrl);
      await writeJson(blockedFile, {
        host,
        url: normalizedUrl,
        reason,
        failed_at: now(),
      });
    },

    async clear(normalizedUrl: string): Promise<void> {
      const { host, root, blockedFile, clearedFile } = pathsFor(normalizedUrl);
      const legacy = await legacyFor(host, root);
      // Suppress a legacy entry without changing the shared legacy file.
      if (activeBlock(legacy, now())) await writeJson(clearedFile, true);
      await rm(blockedFile, { force: true });
    },
  };
}
