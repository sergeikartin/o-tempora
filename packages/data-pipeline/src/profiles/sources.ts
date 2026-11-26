import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { SOURCES_DIR } from './paths.ts';
import { isSafePublicHttpUrl } from './schemas.ts';

const USER_AGENT =
  'O-Tempora-DataPipeline/2.0 (https://github.com/o-tempora; historical timeline)';
const FETCH_TIMEOUT_MS = 20_000;
const MIN_CONTENT_CHARS = 200;
const WIKIPEDIA_MIN_GAP_MS = 350;

const BOT_WALL_PATTERNS = [
  /just a moment\.\.\./i,
  /attention required!\s*\|\s*cloudflare/i,
  /verify you are human/i,
  /enable javascript and cookies to continue/i,
  /access denied.*reference #/i,
  /pardon our interruption/i,
];

const markdownConverter = new NodeHtmlMarkdown({
  ignore: [
    'script',
    'style',
    'noscript',
    'template',
    'nav',
    'footer',
    'aside',
    'header',
    'form',
    'iframe',
    'svg',
    'button',
  ],
  maxConsecutiveNewlines: 2,
});

export interface SourceHeading {
  level: number;
  heading: string;
  line: number;
}

export interface SourceIndexEntry {
  hash: string;
  file: string;
  requestedUrl: string;
  finalUrl: string;
  title: string;
  fetchedAt: string;
  lineCount: number;
}

export type SourceIndex = Record<string, SourceIndexEntry>;

export interface FetchedSourceSummary {
  requestedUrl: string;
  finalUrl: string;
  title: string;
  path: string;
  lineCount: number;
  headings: SourceHeading[];
  cached: boolean;
}

// Strip `#fragment` so section-anchor citations resolve to the fetched page.
export function canonicalSourceKey(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.hash = '';
  return url.href;
}

export function extractHtmlTitle(html: string): string {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!match?.[1]) return '';
  return match[1]
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function htmlToCleanMarkdown(html: string): string {
  // Strip Wikipedia's noisy table-of-contents / edit links before conversion.
  const withoutNoise = html
    .replace(/<span class="mw-editsection">[\s\S]*?<\/span>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '');
  return markdownConverter
    .translate(withoutNoise)
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractMarkdownHeadings(markdown: string): SourceHeading[] {
  const headings: SourceHeading[] = [];
  const lines = markdown.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const match = /^(#{1,3})\s+(.+?)\s*#*$/.exec(line);
    if (!match?.[1] || !match[2]) continue;
    headings.push({
      level: match[1].length,
      heading: match[2].trim(),
      line: i + 1,
    });
  }
  return headings;
}

function isBotWall(title: string, body: string): boolean {
  const sample = `${title}\n${body.slice(0, 2000)}`;
  return BOT_WALL_PATTERNS.some((pattern) => pattern.test(sample));
}

export async function readSourceIndex(
  sourcesDir = SOURCES_DIR,
): Promise<SourceIndex> {
  try {
    const raw = await readFile(path.join(sourcesDir, 'index.json'), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as SourceIndex;
    }
  } catch {}
  return {};
}

async function writeSourceIndex(
  index: SourceIndex,
  sourcesDir: string,
): Promise<void> {
  await mkdir(sourcesDir, { recursive: true });
  await writeFile(
    path.join(sourcesDir, 'index.json'),
    JSON.stringify(index, null, 2),
  );
}

let lastWikipediaRequestMs = 0;
async function paceWikipedia(url: string): Promise<void> {
  const host = new URL(url).hostname;
  if (!host.endsWith('wikipedia.org') && !host.endsWith('wikidata.org')) return;
  const now = Date.now();
  const waitMs = WIKIPEDIA_MIN_GAP_MS - (now - lastWikipediaRequestMs);
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  lastWikipediaRequestMs = Date.now();
}

export interface FetchSourceOptions {
  sourcesDir?: string;
  refresh?: boolean;
  fetchImpl?: typeof fetch;
}

export async function fetchSource(
  rawUrl: string,
  {
    sourcesDir = SOURCES_DIR,
    refresh = false,
    fetchImpl = fetch,
  }: FetchSourceOptions = {},
): Promise<FetchedSourceSummary> {
  if (!isSafePublicHttpUrl(rawUrl)) {
    throw new Error(`Unsupported source URL: ${rawUrl}`);
  }
  const requestedKey = canonicalSourceKey(rawUrl);
  const index = await readSourceIndex(sourcesDir);
  const existing = !refresh ? index[requestedKey] : undefined;
  if (existing) {
    const filePath = path.join(sourcesDir, existing.file);
    try {
      const content = await readFile(filePath, 'utf8');
      return {
        requestedUrl: requestedKey,
        finalUrl: existing.finalUrl,
        title: existing.title,
        path: filePath,
        lineCount: content.split('\n').length,
        headings: extractMarkdownHeadings(content),
        cached: true,
      };
    } catch {
      // Cache file missing on disk; fall through to re-fetch.
    }
  }

  await paceWikipedia(requestedKey);
  const response = await fetchImpl(requestedKey, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html, text/plain;q=0.9, */*;q=0.1',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${requestedKey}: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const contentType = (
    response.headers.get('content-type') ?? ''
  ).toLowerCase();
  if (
    contentType &&
    !contentType.includes('text/html') &&
    !contentType.includes('text/plain') &&
    !contentType.includes('application/xhtml')
  ) {
    throw new Error(
      `Unsupported content-type "${contentType}" for ${requestedKey} (HTML or plain text required)`,
    );
  }

  const finalKey = canonicalSourceKey(response.url || requestedKey);
  const rawBody = await response.text();
  const isHtml =
    !contentType.includes('text/plain') &&
    (contentType.includes('html') || /<html|<body|<p[\s>]/i.test(rawBody));
  const title = isHtml ? extractHtmlTitle(rawBody) : '';
  const body = isHtml ? htmlToCleanMarkdown(rawBody) : rawBody.trim();

  if (isBotWall(title, body)) {
    throw new Error(
      `Blocked by bot challenge or access wall at ${finalKey} ("${title}")`,
    );
  }
  if (body.length < MIN_CONTENT_CHARS) {
    throw new Error(
      `Fetched page too short (${body.length} chars) at ${finalKey}`,
    );
  }

  const fetchedAt = new Date().toISOString();
  const hash = createHash('sha256').update(finalKey).digest('hex').slice(0, 16);
  const fileName = `${hash}.md`;
  const filePath = path.join(sourcesDir, fileName);
  const document = [
    '---',
    `requestedUrl: ${JSON.stringify(requestedKey)}`,
    `finalUrl: ${JSON.stringify(finalKey)}`,
    `title: ${JSON.stringify(title)}`,
    `fetchedAt: ${JSON.stringify(fetchedAt)}`,
    '---',
    '',
    body,
    '',
  ].join('\n');

  await mkdir(sourcesDir, { recursive: true });
  await writeFile(filePath, document, 'utf8');

  const lineCount = document.split('\n').length;
  const entry: SourceIndexEntry = {
    hash,
    file: fileName,
    requestedUrl: requestedKey,
    finalUrl: finalKey,
    title,
    fetchedAt,
    lineCount,
  };
  index[requestedKey] = entry;
  index[finalKey] = entry;
  await writeSourceIndex(index, sourcesDir);

  return {
    requestedUrl: requestedKey,
    finalUrl: finalKey,
    title,
    path: filePath,
    lineCount,
    headings: extractMarkdownHeadings(document),
    cached: false,
  };
}

// Resolves a Wikidata QID's Russian Wikipedia URL via Wikidata's wbgetentities API.
export async function resolveRussianWikipediaUrl(
  qid: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | undefined> {
  const apiUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${encodeURIComponent(qid)}&props=sitelinks&sitefilter=ruwiki&format=json`;
  await paceWikipedia(apiUrl);
  const response = await fetchImpl(apiUrl, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) return undefined;
  const json = (await response.json()) as {
    entities?: Record<string, { sitelinks?: { ruwiki?: { title?: string } } }>;
  };
  const title = json.entities?.[qid]?.sitelinks?.ruwiki?.title;
  if (!title) return undefined;
  return `https://ru.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`;
}
