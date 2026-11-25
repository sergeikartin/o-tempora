import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  createBlockedHostCache,
  isBlockableFetchError,
} from './blocked-hosts.js';
import { writeJson } from './store.js';
import { hash } from './verification/assessment.js';
import {
  fetchSource,
  parseSourceSnapshot,
  SourceStore,
  sourceUrl,
} from './verification/sources.js';

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8'));
}

export async function readSnapshot(directory: string, id: unknown) {
  if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id))
    throw new Error('Invalid evidence snapshot ID');
  return parseSourceSnapshot(
    await readJson(path.join(directory, `${id}.json`)),
    id,
  );
}

export interface EvidenceStoreOptions {
  blockedHosts?: boolean;
  now?: () => number;
}

export function evidenceStore(
  profilesDir: string,
  fetchPage = fetchSource,
  refresh = false,
  { blockedHosts = true, now = Date.now }: EvidenceStoreOptions = {},
) {
  const directory = path.join(profilesDir, 'evidence');
  const blocks = blockedHosts
    ? createBlockedHostCache(directory, now)
    : undefined;
  const urlPath = (url: string) =>
    path.join(directory, 'urls', `${hash(url)}.json`);
  return new SourceStore(async (url) => {
    const normalized = sourceUrl(url).href;
    if (!refresh) {
      try {
        return await readSnapshot(
          directory,
          await readJson(urlPath(normalized)),
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      const blockedReason = await blocks?.check(normalized);
      if (blockedReason !== undefined) {
        throw new Error(
          `Blocked host: ${blockedReason} (use --refresh to retry)`,
        );
      }
    }
    let source: Awaited<ReturnType<typeof fetchPage>>;
    try {
      source = await fetchPage(normalized);
    } catch (error) {
      if (blocks && isBlockableFetchError(error)) {
        await blocks.record(normalized, error.message);
      }
      throw error;
    }
    if (refresh && blocks) await blocks.clear(normalized);
    await writeJson(path.join(directory, `${source.id}.json`), source);
    await writeJson(urlPath(normalized), source.id);
    if (source.url !== normalized)
      await writeJson(urlPath(source.url), source.id);
    return source;
  });
}
