import { lookup } from 'node:dns/promises';
import { get } from 'node:https';
import { Parser } from 'htmlparser2';
import { asRecord, asString } from '../values.js';
import { hash, normalizeText, type Source, strings } from './policy.js';

const MAX_BYTES = 3_000_000;
const EXCERPT_LENGTH = 8_000;
const EXCERPT_OVERLAP = 400;
const USER_AGENT =
  'o-tempora-data-pipeline/0.1 (contact sergei.kartin@gmail.com)';

export function publicIPv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  )
    return false;
  const [a = 0, b = 0] = parts;
  return (
    a > 0 &&
    a < 224 &&
    a !== 10 &&
    a !== 127 &&
    !(a === 169 && b === 254) &&
    !(a === 172 && b >= 16 && b <= 31) &&
    !(a === 192 && (b === 0 || b === 168)) &&
    !(a === 100 && b >= 64 && b <= 127) &&
    !(a === 198 && (b === 18 || b === 19))
  );
}

export function sourceUrl(value: string): URL {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443')
  ) {
    throw new Error(
      'Sources must be public HTTPS URLs without credentials or custom ports',
    );
  }
  url.hash = '';
  return url;
}

export function htmlText(html: string): string {
  const fragments: string[] = [];
  let hidden = 0;
  const stack: boolean[] = [];
  const blocks = new Set([
    'p',
    'div',
    'li',
    'br',
    'h1',
    'h2',
    'h3',
    'h4',
    'tr',
    'td',
    'section',
  ]);
  const parser = new Parser(
    {
      onopentag(name) {
        const hide = [
          'script',
          'style',
          'noscript',
          'svg',
          'nav',
          'footer',
          'header',
        ].includes(name);
        stack.push(hide);
        if (hide) hidden++;
        if (!hidden && blocks.has(name)) fragments.push(' ');
      },
      ontext(text) {
        if (!hidden) fragments.push(text);
      },
      onclosetag(name) {
        if (stack.pop()) hidden--;
        if (!hidden && blocks.has(name)) fragments.push(' ');
      },
    },
    { decodeEntities: true },
  );
  parser.end(html);
  return normalizeText(fragments.join(''));
}

function htmlAnchors(html: string): string[] {
  const anchors = new Set<string>();
  const parser = new Parser({
    onopentag(_name, attributes) {
      if (attributes.id) anchors.add(attributes.id);
      if (attributes.name) anchors.add(attributes.name);
    },
  });
  parser.end(html);
  return [...anchors];
}

interface Page {
  status: number;
  location?: string;
  type: string;
  text: string;
}

// Pin the validated public address into the socket's DNS lookup. Redirects go
// through the same check, so a source cannot redirect into the local network.
async function request(url: URL): Promise<Page> {
  const addresses = await lookup(url.hostname, { family: 4, all: true });
  const address = addresses[0]?.address;
  if (!address || addresses.some((item) => !publicIPv4(item.address)))
    throw new Error('Source resolved to a non-public address');
  return new Promise((resolve, reject) => {
    const req = get(
      url,
      {
        family: 4,
        lookup: (_host, _options, callback) => callback(null, address, 4),
        signal: AbortSignal.timeout(30_000),
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,text/plain',
          'Accept-Encoding': 'identity',
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on('data', (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > MAX_BYTES)
            response.destroy(new Error('Source exceeds 3 MB'));
          else chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            location: response.headers.location,
            type: response.headers['content-type'] ?? '',
            text: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    req.on('error', reject);
  });
}

export function parseSourceSnapshot(value: unknown, id: string): Source {
  const data = asRecord(value, 'source snapshot');
  const source = {
    url: asString(data.url, 'source URL'),
    fetched_at: asString(data.fetched_at, 'source date'),
    text: asString(data.text, 'source text'),
    anchors:
      data.anchors === undefined ? [] : strings(data.anchors, 'source anchors'),
  };
  if (
    data.id !== id ||
    (hash(source) !== id && hash(source.text) !== id) ||
    sourceUrl(source.url).href !== source.url
  ) {
    throw new Error(`Saved source content does not match ${id}`);
  }
  return { id, ...source };
}

export async function fetchSource(value: string): Promise<Source> {
  let url = sourceUrl(value);
  for (let redirect = 0; redirect < 6; redirect++) {
    let page: Page | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        page = await request(url);
        if (page.status !== 429 && page.status < 500) break;
      } catch (error) {
        if (attempt === 2) throw error;
      }
      if (attempt < 2)
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
    if (!page) throw new Error('Source fetch failed');
    if ([301, 302, 303, 307, 308].includes(page.status) && page.location) {
      url = sourceUrl(new URL(page.location, url).href);
      continue;
    }
    if (page.status !== 200)
      throw new Error(`Source returned HTTP ${page.status}`);
    if (!/text\/(html|plain)|application\/xhtml\+xml/.test(page.type))
      throw new Error('Source is not readable HTML or plain text');
    const text = page.type.includes('text/plain')
      ? normalizeText(page.text)
      : htmlText(page.text);
    if (text.length < 100)
      throw new Error('Source has insufficient readable text');
    const snapshot = {
      url: url.href,
      fetched_at: new Date().toISOString(),
      text,
      anchors: page.type.includes('text/plain') ? [] : htmlAnchors(page.text),
    };
    return { id: hash(snapshot), ...snapshot };
  }
  throw new Error('Source has too many redirects');
}

export class SourceStore {
  private readonly byUrl = new Map<string, Source>();
  readonly failures = new Map<string, string>();
  constructor(
    private readonly fetchPage: (url: string) => Promise<Source> = fetchSource,
    private readonly snapshots: readonly Source[] = [],
  ) {
    for (const source of snapshots) this.byUrl.set(source.url, source);
  }

  async read(value: string): Promise<Source> {
    const url = sourceUrl(value).href;
    const cached = this.byUrl.get(url);
    if (cached) return cached;
    try {
      const source = await this.fetchPage(url);
      this.byUrl.set(url, source);
      this.failures.delete(url);
      return source;
    } catch (error) {
      this.failures.set(
        url,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  async readExcerpt(input: Record<string, unknown>) {
    const offset = input.offset === undefined ? 0 : input.offset;
    if (
      typeof offset !== 'number' ||
      !Number.isSafeInteger(offset) ||
      offset < 0
    )
      throw new Error('Source offset must be a nonnegative integer');
    const query =
      input.query == null
        ? undefined
        : asString(input.query, 'source query').trim();
    if (query !== undefined && (!query || query.length > 256))
      throw new Error('Source query must contain 1 to 256 characters');

    const source = await this.read(asString(input.url, 'source URL'));
    let start = offset;
    if (query !== undefined) {
      const literal = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(literal, 'giu');
      pattern.lastIndex = offset;
      const match = pattern.exec(source.text);
      if (!match)
        return { ...source, text: '', offset: null, next_offset: null };
      start = Math.max(offset, match.index - 2_000);
    }

    const end = start + EXCERPT_LENGTH;
    return {
      ...source,
      text: source.text.slice(start, end),
      offset: start,
      next_offset: end < source.text.length ? end - EXCERPT_OVERLAP : null,
    };
  }

  all(): Source[] {
    return [
      ...new Map(
        [...this.snapshots, ...this.byUrl.values()].map((source) => [
          source.id,
          source,
        ]),
      ).values(),
    ];
  }
}
