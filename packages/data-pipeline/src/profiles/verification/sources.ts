import { lookup } from 'node:dns/promises';
import { get } from 'node:https';
import { setTimeout as sleep } from 'node:timers/promises';
import { Parser } from 'htmlparser2';
import type { FunctionTool } from 'openai/resources/responses/responses';
import { getDomain, parse as parseDomain } from 'tldts';
import { asArray, asRecord, asString } from '../values.js';
import { hash, normalizeText, strings } from './assessment.js';
import type { Source, SourceHeading } from './policy.js';

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

const HEADING_LEVEL = new Map<string, SourceHeading['level']>([
  ['h1', 1],
  ['h2', 2],
  ['h3', 3],
  ['h4', 4],
  ['h5', 5],
  ['h6', 6],
]);
const BLOCKS = new Set(['p', 'div', 'li', 'br', 'tr', 'td', 'section']);
const HIDDEN = new Set([
  'script',
  'style',
  'noscript',
  'svg',
  'nav',
  'footer',
  'header',
]);

// Keep unfinished words across parser callbacks so combining characters split
// by entities or inline tags still compose before assigning the next offset.
class NormalizedText {
  private readonly chunks: string[] = [];
  private word = '';
  offset = 0;

  append(text: string) {
    for (const part of text.matchAll(/(\s+)|(\S+)/g)) {
      if (part[1]) this.boundary();
      else this.word += part[0];
    }
  }

  boundary() {
    if (!this.word) return;
    const word = this.word.normalize('NFC');
    if (this.offset) {
      this.chunks.push(' ');
      this.offset++;
    }
    this.chunks.push(word);
    this.offset += word.length;
    this.word = '';
  }

  nextOffset() {
    return this.offset ? this.offset + 1 : 0;
  }

  finish() {
    this.boundary();
    return this.chunks.join('');
  }
}

export function extractHtmlDocument(
  html: string,
  anchors?: Set<string>,
): { text: string; title?: string; headings: SourceHeading[] } {
  const visible = new NormalizedText();
  const ranges: {
    level: SourceHeading['level'];
    offset: number;
    end: number;
  }[] = [];
  const stack: { hidden: boolean; offset?: number }[] = [];
  let hidden = 0;
  let inHeading = false;
  let titleText: NormalizedText | undefined;
  let title: string | undefined;
  const parser = new Parser(
    {
      onopentag(name, attributes) {
        if (anchors) {
          if (attributes.id) anchors.add(attributes.id);
          if (attributes.name) anchors.add(attributes.name);
        }
        const hide =
          HIDDEN.has(name) ||
          (name === 'span' &&
            attributes.class?.split(/\s+/).includes('mw-editsection')) === true;
        if (hide) hidden++;
        const level = HEADING_LEVEL.get(name);
        if (!hidden && (level || BLOCKS.has(name))) visible.boundary();
        // Treat nested headings in malformed HTML as part of the outer label.
        const startsHeading = !hidden && level !== undefined && !inHeading;
        stack.push({
          hidden: hide,
          offset: startsHeading ? visible.nextOffset() : undefined,
        });
        if (startsHeading) inHeading = true;
        if (!hidden && name === 'title' && title === undefined)
          titleText = new NormalizedText();
      },
      ontext(text) {
        if (hidden) return;
        visible.append(text);
        titleText?.append(text);
      },
      onclosetag(name) {
        const entry = stack.pop();
        if (entry?.hidden) hidden--;
        if (hidden || entry?.hidden) return;
        if (name === 'title' && titleText) {
          title = titleText.finish() || undefined;
          titleText = undefined;
        }
        const level = HEADING_LEVEL.get(name);
        if (level || BLOCKS.has(name)) visible.boundary();
        if (level && entry?.offset !== undefined) {
          inHeading = false;
          if (visible.offset > entry.offset)
            ranges.push({ level, offset: entry.offset, end: visible.offset });
        }
      },
    },
    { decodeEntities: true },
  );
  parser.end(html);
  const text = visible.finish();
  return {
    text,
    ...(title ? { title } : {}),
    headings: ranges.map(({ level, offset, end }) => ({
      level,
      offset,
      text: text.slice(offset, end),
    })),
  };
}

export function htmlText(html: string): string {
  return extractHtmlDocument(html).text;
}

export function headingPathAt(
  headings: readonly SourceHeading[] | undefined,
  offset: number,
): string[] {
  const stack: SourceHeading[] = [];
  for (const heading of headings ?? []) {
    if (heading.offset > offset) break;
    while (stack.length && (stack.at(-1)?.level ?? 0) >= heading.level)
      stack.pop();
    stack.push(heading);
  }
  return stack.map(({ text }) => text);
}

const IGNORED_DOMAINS = new Set([
  'wikipedia.org',
  'wikimedia.org',
  'wikimediafoundation.org',
  'wikidata.org',
  'mediawiki.org',
  'wiktionary.org',
  'wikibooks.org',
  'wikiquote.org',
  'wikisource.org',
  'wikinews.org',
  'wikiversity.org',
  'wikivoyage.org',
  'wikifunctions.org',
  'wikispore.org',
  'wmflabs.org',
  'toolforge.org',
  'facebook.com',
  'instagram.com',
  'threads.net',
  'twitter.com',
  'x.com',
  'youtube.com',
  'youtu.be',
  'vimeo.com',
  'tiktok.com',
  'reddit.com',
  'linkedin.com',
  'dailymotion.com',
  'pinterest.com',
  'bsky.app',
]);

export function extractReferenceLinks(html: string, baseUrl: string): string[] {
  const preferred = new Set<string>();
  const general = new Set<string>();
  const stack: {
    references: boolean;
    sectionLevel?: number;
    hidden: boolean;
  }[] = [];
  let externalLevel: number | undefined;
  const parser = new Parser({
    onopentag(tag, attrs) {
      const parent = stack.at(-1);
      const level = HEADING_LEVEL.get(tag);
      if (level && externalLevel !== undefined && level <= externalLevel)
        externalLevel = undefined;
      if (attrs.id === 'External_links')
        externalLevel =
          level ??
          [...stack].reverse().find((entry) => entry.sectionLevel)
            ?.sectionLevel ??
          2;
      const references =
        !!parent?.references ||
        (attrs.class
          ?.split(/\s+/)
          .some((name) => name === 'references' || name === 'reflist') ??
          false);
      const hidden = !!parent?.hidden || HIDDEN.has(tag) || tag === 'head';
      stack.push({ references, sectionLevel: level, hidden });
      if (tag !== 'a' || !attrs.href || hidden) return;
      try {
        const url = sourceUrl(new URL(attrs.href, baseUrl).href);
        const { domain, isIcann } = parseDomain(url.hostname);
        // Actual DNS and public-address validation still happens on every fetch.
        if (
          !domain ||
          !isIcann ||
          IGNORED_DOMAINS.has(domain) ||
          /\.(pdf|jpe?g|png|gif|svg|mp[34]|zip)$/i.test(
            decodeURIComponent(url.pathname),
          )
        )
          return;
        (references || externalLevel !== undefined ? preferred : general).add(
          url.href,
        );
      } catch {
        // Malformed and unsupported links are omitted.
      }
    },
    onclosetag() {
      stack.pop();
    },
  });
  parser.end(html);
  return [...new Set([...preferred, ...general])];
}

export class SourceFetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly unsupportedType = false,
  ) {
    super(message);
  }
}

interface Page {
  status: number;
  location?: string;
  retryAfter?: string;
  type: string;
  text: string;
}

function readableType(type: string): boolean {
  return ['text/html', 'text/plain', 'application/xhtml+xml'].includes(type);
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
        const headers = {
          status: response.statusCode ?? 0,
          location: response.headers.location,
          retryAfter: response.headers['retry-after'],
          type:
            (response.headers['content-type'] ?? '')
              .split(';', 1)[0]
              ?.trim()
              .toLowerCase() ?? '',
        };
        if (headers.status !== 200 || !readableType(headers.type)) {
          resolve({ ...headers, text: '' });
          response.destroy();
          return;
        }
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
          resolve({ ...headers, text: Buffer.concat(chunks).toString('utf8') }),
        );
      },
    );
    req.on('error', reject);
  });
}

export function parseSourceSnapshot(value: unknown, id: string): Source {
  const data = asRecord(value, 'source snapshot');
  const text = asString(data.text, 'source text');
  let previous = -1;
  const headings =
    data.headings === undefined
      ? undefined
      : asArray(data.headings, 'source headings').map((item): SourceHeading => {
          const heading = asRecord(item, 'source heading');
          const level = heading.level;
          const offset = heading.offset;
          const label = asString(heading.text, 'source heading text');
          if (
            (level !== 1 &&
              level !== 2 &&
              level !== 3 &&
              level !== 4 &&
              level !== 5 &&
              level !== 6) ||
            typeof offset !== 'number' ||
            !Number.isSafeInteger(offset) ||
            offset <= previous ||
            normalizeText(label) !== label ||
            !text.startsWith(label, offset)
          )
            throw new Error('Invalid source heading');
          previous = offset;
          return { level, offset, text: label };
        });
  const title =
    data.title === undefined ? undefined : asString(data.title, 'source title');
  const source = {
    url: asString(data.url, 'source URL'),
    fetched_at: asString(data.fetched_at, 'source date'),
    text,
    ...(data.anchors === undefined
      ? {}
      : { anchors: strings(data.anchors, 'source anchors') }),
    ...(title === undefined ? {} : { title }),
    ...(headings === undefined ? {} : { headings }),
  };
  const legacy = title === undefined && headings === undefined;
  if (
    data.id !== id ||
    (hash(source) !== id &&
      !(
        legacy &&
        (hash(source.text) === id ||
          (data.anchors === undefined &&
            hash({ ...source, anchors: [] }) === id))
      )) ||
    (title !== undefined && normalizeText(title) !== title) ||
    (!legacy && normalizeText(text) !== text) ||
    sourceUrl(source.url).href !== source.url
  ) {
    throw new Error(`Saved source content does not match ${id}`);
  }
  return { id, ...source };
}

let wikipediaQueue = Promise.resolve();
let nextWikipediaRequest = 0;

function paceWikipedia() {
  wikipediaQueue = wikipediaQueue.then(async () => {
    const delay = nextWikipediaRequest - performance.now();
    if (delay > 0) await sleep(Math.ceil(delay));
    nextWikipediaRequest = performance.now() + 1_000;
  });
  return wikipediaQueue;
}

interface FetchOptions {
  onReferenceLinks?: (links: string[]) => void;
  requestPage?: (url: URL) => Promise<Page>;
  wait?: (ms: number) => Promise<void>;
}

async function fetchPage(
  value: string,
  { requestPage = request, wait = sleep }: FetchOptions = {},
): Promise<{ url: URL; page: Page }> {
  let url = sourceUrl(value);
  for (let redirect = 0; redirect < 6; redirect++) {
    let page: Page | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (getDomain(url.hostname) === 'wikipedia.org') await paceWikipedia();
        page = await requestPage(url);
        if (page.status !== 429 && page.status < 500) break;
      } catch (error) {
        if (attempt === 2) throw error;
        page = undefined;
      }
      if (attempt < 2) {
        const retryAfter =
          page?.status === 429 ? page.retryAfter?.trim() : undefined;
        const delay =
          retryAfter && /^\d+$/.test(retryAfter)
            ? Math.min(Number(retryAfter), 60) * 1_000
            : 500 * 2 ** attempt;
        await wait(delay);
      }
    }
    if (!page) throw new Error('Source fetch failed');
    if ([301, 302, 303, 307, 308].includes(page.status) && page.location) {
      url = sourceUrl(new URL(page.location, url).href);
      continue;
    }
    if (page.status !== 200)
      throw new SourceFetchError(
        `Source returned HTTP ${page.status}`,
        page.status,
      );
    if (!readableType(page.type))
      throw new SourceFetchError(
        'Source is not readable HTML or plain text',
        undefined,
        true,
      );
    return { url, page };
  }
  throw new Error('Source has too many redirects');
}

export async function fetchReferenceLinks(value: string): Promise<string[]> {
  const { url, page } = await fetchPage(value);
  return page.type === 'text/plain'
    ? []
    : extractReferenceLinks(page.text, url.href);
}

export async function fetchSource(
  value: string,
  options: FetchOptions = {},
): Promise<Source> {
  const { url, page } = await fetchPage(value, options);
  const plain = page.type === 'text/plain';
  const anchors = new Set<string>();
  const document = plain
    ? { text: normalizeText(page.text), headings: [] }
    : extractHtmlDocument(page.text, anchors);
  if (document.text.length < 100)
    throw new Error('Source has insufficient readable text');
  const snapshot = {
    url: url.href,
    fetched_at: new Date().toISOString(),
    ...document,
    anchors: [...anchors],
  };
  if (options.onReferenceLinks)
    options.onReferenceLinks(
      plain ? [] : extractReferenceLinks(page.text, url.href),
    );
  return { id: hash(snapshot), ...snapshot };
}

export function sourceOutline(source: Source) {
  return {
    id: source.id,
    url: source.url,
    title: source.title ?? null,
    chars: source.text.length,
    headings: source.headings ?? [],
  };
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
      this.byUrl.set(source.url, source);
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

  async readOutline(url: string) {
    return sourceOutline(await this.read(url));
  }

  async readExcerpt(input: Record<string, unknown>) {
    const offset = input.offset === undefined ? 0 : input.offset;
    if (
      typeof offset !== 'number' ||
      !Number.isSafeInteger(offset) ||
      offset < 0
    )
      throw new Error('Source offset must be a nonnegative integer');
    const requestedLength = input.length ?? EXCERPT_LENGTH;
    if (
      typeof requestedLength !== 'number' ||
      !Number.isSafeInteger(requestedLength)
    )
      throw new Error('Source length must be an integer');
    const length = Math.max(500, Math.min(EXCERPT_LENGTH, requestedLength));
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
        return {
          ...source,
          text: '',
          section: [],
          offset: null,
          next_offset: null,
        };
      start = Math.max(
        offset,
        match.index - Math.min(2_000, Math.floor(length / 4)),
      );
    }

    const end = start + length;
    return {
      ...source,
      text: source.text.slice(start, end),
      offset: start,
      section: headingPathAt(source.headings, start),
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

export const readSourceTool: FunctionTool = {
  type: 'function',
  name: 'read_source',
  description:
    'Fetch an exact excerpt from a public HTTPS article. Use a literal name, phrase or year as query to jump to its first match at or after offset, or null to read from offset. Start at offset 0; use next_offset with query=null to continue reading. An empty result for a query means the phrase was not found. Evidence must cite the returned content hash and quote the returned text. PDF and login-only pages are unsupported; seek a readable alternative.',
  strict: true,
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      offset: { type: 'integer', minimum: 0 },
      query: { type: ['string', 'null'] },
    },
    required: ['url', 'offset', 'query'],
    additionalProperties: false,
  },
};

export async function readSourceToolOutput(
  sources: SourceStore,
  argumentsJson: string,
) {
  try {
    const args = asRecord(JSON.parse(argumentsJson), 'read_source');
    const { id, url, title, section, text, offset, next_offset } =
      await sources.readExcerpt(args);
    return { id, url, title, section, text, offset, next_offset };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      retryable: true,
    };
  }
}
