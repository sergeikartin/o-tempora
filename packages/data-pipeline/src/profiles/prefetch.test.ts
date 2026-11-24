import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { runCoordinatorCommand } from './coordinator.js';
import { prefetchBatch, prefetchSubject, rankReferences } from './prefetch.js';
import type { ProfileSubject } from './subjects.js';
import { hash } from './verification/assessment.js';
import {
  extractHtmlDocument,
  extractReferenceLinks,
  fetchSource,
  SourceFetchError,
} from './verification/sources.js';

const wikipedia = 'https://en.wikipedia.org/wiki/Isaac_Newton';
const subject: ProfileSubject = {
  qid: 'Q935',
  lane: 'people',
  name: 'Isaac Newton',
  dateSpan: { startYear: 1643, endYear: 1727 },
  wikipediaUrl: wikipedia,
};

test('reference extraction favors reference sections and filters unsuitable URLs', () => {
  const links = extractReferenceLinks(
    '<a href="https://daily.com/article#first">general</a>' +
      '<ol class="references"><li><a href="//archive.ac.uk/sources#part">source</a></li></ol>' +
      '<div class="reflist"><a href="https://daily.com/article#second">same</a></div>' +
      '<h2><span id="External_links">External links</span></h2><ul><li><a href="https://museum.org/collection">museum</a></li></ul>' +
      '<h2>Next</h2><a href="extra">extra</a>' +
      '<nav><a href="https://navigation.com">navigation</a></nav>' +
      '<a href="https://en.wikipedia.org/wiki/Other">internal</a>' +
      '<a href="https://commons.wikimedia.org/file">wikimedia</a>' +
      '<a href="https://www.youtube.com/profile">video</a>' +
      '<a href="https://books.org/a%2EPDF?download=1">book</a>' +
      '<a href="https://127.0.0.1/article">local</a>' +
      '<a href="http://books.org/book">insecure</a>' +
      '<a href="https://user@books.org/book">credentials</a>',
    'https://books.org/start/',
  );
  assert.deepEqual(links, [
    'https://archive.ac.uk/sources',
    'https://daily.com/article',
    'https://museum.org/collection',
    'https://books.org/start/extra',
  ]);
  assert.deepEqual(
    rankReferences([
      ...links,
      'https://dept.archive.ac.uk/second',
      'https://britannica.com/newton',
    ]).map(({ url }) => url),
    [
      'https://archive.ac.uk/sources',
      'https://britannica.com/newton',
      'https://museum.org/collection',
      'https://books.org/start/extra',
      'https://daily.com/article',
    ],
  );
});

test('source fetching honors numeric Retry-After, caps it and falls back to backoff', async () => {
  const responses = [
    { status: 503, retryAfter: '120' },
    { status: 429, retryAfter: 'invalid' },
    { status: 451 },
  ];
  const delays: number[] = [];
  await assert.rejects(
    fetchSource('https://example.org/history', {
      requestPage: async () => {
        const response = responses.shift();
        assert.ok(response);
        return { ...response, type: 'text/html', text: '' };
      },
      wait: async (ms) => {
        delays.push(ms);
      },
    }),
    (error) => error instanceof SourceFetchError && error.status === 451,
  );
  assert.deepEqual(delays, [60_000, 10_000]);

  let tries = 0;
  await assert.rejects(
    fetchSource('https://example.org/history', {
      requestPage: async () =>
        tries++ === 0
          ? { status: 429, retryAfter: '2', type: '', text: '' }
          : { status: 200, type: 'application/pdf', text: '' },
      wait: async (ms) => {
        assert.equal(ms, 2_000);
      },
    }),
    (error) => error instanceof SourceFetchError && error.unsupportedType,
  );
});

test('Wikipedia requests start at least one second apart', async () => {
  const started: number[] = [];
  const requestPage = async () => {
    started.push(performance.now());
    return {
      status: 200,
      type: 'text/plain',
      text: 'Wikipedia article text. '.repeat(10),
    };
  };
  await Promise.all([
    fetchSource(wikipedia, { requestPage }),
    fetchSource('https://en.wikipedia.org/wiki/Robert_Hooke', { requestPage }),
  ]);
  assert.equal(started.length, 2);
  assert.ok((started[1] ?? 0) - (started[0] ?? 0) >= 999);
});

test('prefetch persists source maps and deterministic blocks, and evidence reuses the same snapshots', async (t) => {
  const profilesDir = await mkdtemp(path.join(tmpdir(), 'profile-prefetch-'));
  t.after(() => rm(profilesDir, { recursive: true, force: true }));
  const blocked = 'https://archive.gov/newton';
  const gone = 'https://university.edu/newton';
  const unavailable = 'https://transient.edu/newton';
  const primary = 'https://britannica.com/newton';
  const scholarly = 'https://university.ac.uk/newton';
  const organization = 'https://museum.org/newton';
  const restricted = 'https://restricted.gov/newton';
  const unreadable = 'https://scans.edu/newton';
  const links = [
    organization,
    blocked,
    gone,
    unavailable,
    restricted,
    unreadable,
    primary,
    'https://www.britannica.com/redundant',
    scholarly,
  ];
  const document = extractHtmlDocument(
    '<title>A title</title><h1>Isaac Newton</h1><h2>Career</h2>' +
      '<h3>Principia</h3><h4>A small detail</h4><p>' +
      'Newton studied at Cambridge. '.repeat(420) +
      'Unique target phrase.</p>',
  );

  let currentTime = Date.UTC(2026, 0, 1);
  let inFlight = 0;
  let peak = 0;
  const fetched: string[] = [];
  const fetch: typeof fetchSource = async (url, options) => {
    fetched.push(url);
    inFlight++;
    peak = Math.max(peak, inFlight);
    try {
      await sleep(1);
      if (url === wikipedia) options?.onReferenceLinks?.(links);
      if (url === blocked) throw new SourceFetchError('HTTP 403', 403);
      if (url === gone) throw new SourceFetchError('HTTP 410', 410);
      if (url === restricted) throw new SourceFetchError('HTTP 451', 451);
      if (url === unreadable)
        throw new SourceFetchError('Unsupported content type', undefined, true);
      if (url === unavailable) throw new SourceFetchError('HTTP 503', 503);
      const payload = {
        url,
        fetched_at: new Date(currentTime).toISOString(),
        ...document,
      };
      return { ...payload, id: hash(payload) };
    } finally {
      inFlight--;
    }
  };
  const emitted: unknown[] = [];
  const coordinator = {
    profilesDir,
    resolve: async () =>
      assert.fail('Prefetch must not resolve article identities'),
    fetch,
    emit: (result: unknown) => emitted.push(result),
    subjects: () => [subject],
  };

  await runCoordinatorCommand(
    'prefetch',
    ['--qids=Q935', '--max-sources=3'],
    coordinator,
  );
  const base = path.join(profilesDir, 'evidence');
  const map = JSON.parse(
    await readFile(path.join(base, 'prefetch', 'Q935.json'), 'utf8'),
  );
  assert.deepEqual(emitted, [map]);
  assert.deepEqual(
    map.sources.map(({ url }: { url: string }) => url),
    [wikipedia, primary, scholarly, organization],
  );
  assert.deepEqual(map.sources[0].headings, document.headings.slice(0, 3));
  assert.equal(map.sources[0].chars, document.text.length);
  assert.equal(peak, 3);
  assert.deepEqual(fetched.slice(0, 4), [
    wikipedia,
    blocked,
    gone,
    unavailable,
  ]);
  assert.ok(!fetched.includes('https://www.britannica.com/redundant'));

  const blockDir = path.join(base, 'blocked-hosts');
  const hosts = [
    'archive.gov',
    'restricted.gov',
    'scans.edu',
    'university.edu',
  ];
  assert.deepEqual(
    await readdir(blockDir),
    hosts.map((host) => `${hash(host)}.json`).sort(),
  );
  for (const host of hosts) {
    const entry = JSON.parse(
      await readFile(path.join(blockDir, `${hash(host)}.json`), 'utf8'),
    );
    assert.equal(entry.host, host);
  }
  fetched.length = 0;
  await runCoordinatorCommand(
    'evidence',
    [`--url=${primary}`, '--outline'],
    coordinator,
  );
  assert.deepEqual(emitted.at(-1), {
    ...map.sources[1],
    headings: document.headings,
  });
  await runCoordinatorCommand(
    'evidence',
    [`--url=${primary}`, '--length=1', '--query=Unique target phrase'],
    coordinator,
  );
  const excerpt = emitted.at(-1);
  assert.ok(
    excerpt &&
      typeof excerpt === 'object' &&
      'text' in excerpt &&
      typeof excerpt.text === 'string',
  );
  assert.ok(
    excerpt.text.length <= 500 && excerpt.text.includes('Unique target phrase'),
  );
  await runCoordinatorCommand(
    'evidence',
    [`--url=${primary}`, '--length=12000'],
    coordinator,
  );
  assert.equal((emitted.at(-1) as { text: string }).text.length, 8000);
  for (const flags of [
    ['--outline', '--offset=0'],
    ['--length=2.5'],
    ['--outline=yes'],
  ])
    await assert.rejects(
      runCoordinatorCommand(
        'evidence',
        [`--url=${primary}`, ...flags],
        coordinator,
      ),
    );
  assert.equal(fetched.length, 0);

  let linkReads = 0;
  const prefetch = (refresh = false) =>
    prefetchSubject({
      subject,
      profilesDir,
      maxSources: 3,
      refresh,
      fetch,
      now: () => currentTime,
      readLinks: async (url) => {
        assert.equal(url, wikipedia);
        linkReads++;
        return links;
      },
    });
  currentTime = Date.now();
  const warm = await prefetch();
  assert.equal(linkReads, 1);
  assert.deepEqual(fetched, [unavailable]);
  assert.equal(
    warm.skipped.filter(({ reason }) => reason.startsWith('Blocked host:'))
      .length,
    4,
  );

  fetched.length = 0;
  await prefetch(true);
  assert.ok(
    fetched.includes(blocked) &&
      fetched.includes(wikipedia) &&
      fetched.includes(primary),
  );
  fetched.length = 0;
  currentTime += 7 * 24 * 60 * 60 * 1_000;
  await prefetch();
  assert.ok(fetched.includes(blocked) && fetched.includes(gone));
});

const secondSubject = {
  ...subject,
  qid: 'Q1',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Hooke',
};
const thirdSubject = {
  ...subject,
  qid: 'Q2',
  wikipediaUrl: 'https://en.wikipedia.org/wiki/Halley',
};

test('prefetch CLI rejects invalid concurrency and emits results in input order', async (t) => {
  const profilesDir = await mkdtemp(path.join(tmpdir(), 'prefetch-cli-'));
  t.after(() => rm(profilesDir, { recursive: true, force: true }));
  const emitted: unknown[] = [];
  const options = {
    profilesDir,
    subjects: () => [subject, secondSubject],
    resolve: async () => assert.fail('unexpected article resolution'),
    fetch: async (url: string) => {
      throw new SourceFetchError(`Unavailable: ${url}`, 503);
    },
    emit: (value: unknown) => {
      emitted.push(value);
    },
  };
  for (const n of ['0', '4', 'abc', '1.5']) {
    await assert.rejects(
      runCoordinatorCommand(
        'prefetch',
        ['--qids=Q1', `--concurrency=${n}`],
        options,
      ),
      /--concurrency must be an integer from 1 to 3/,
    );
  }
  await runCoordinatorCommand(
    'prefetch',
    ['--qids=Q1,Q935', '--concurrency=2'],
    options,
  );
  assert.deepEqual(
    emitted.map((result) => (result as { qid: string }).qid),
    ['Q1', 'Q935'],
  );
});

test('prefetch batches bound active QIDs, run serially by default and retain input order', async (t) => {
  const profilesDir = await mkdtemp(path.join(tmpdir(), 'prefetch-workers-'));
  t.after(() => rm(profilesDir, { recursive: true, force: true }));
  let active = 0;
  let peak = 0;
  const finished: string[] = [];
  const subjects = [subject, secondSubject, thirdSubject];
  const options = {
    profilesDir,
    subjects,
    fetch: async (url: string) => {
      active++;
      peak = Math.max(peak, active);
      await sleep(url === wikipedia ? 40 : 5);
      finished.push(url);
      active--;
      throw new SourceFetchError('Transient', 503);
    },
  };
  await prefetchBatch(options);
  assert.equal(peak, 1);
  assert.deepEqual(
    finished,
    subjects.map(({ wikipediaUrl }) => wikipediaUrl),
  );
  peak = 0;
  finished.length = 0;
  const results = await prefetchBatch({ ...options, concurrency: 2 });
  assert.equal(peak, 2);
  assert.deepEqual(
    results.map(({ qid }) => qid),
    subjects.map(({ qid }) => qid),
  );
  assert.equal(finished.at(-1), wikipedia);
});

test('a concurrent prefetch batch shares Wikipedia pacing across hosts and QIDs', async (t) => {
  const profilesDir = await mkdtemp(path.join(tmpdir(), 'prefetch-paced-'));
  t.after(() => rm(profilesDir, { recursive: true, force: true }));
  const started: number[] = [];
  await prefetchBatch({
    profilesDir,
    subjects: [
      subject,
      {
        ...secondSubject,
        wikipediaUrl: 'https://simple.wikipedia.org/wiki/Hooke',
      },
    ],
    concurrency: 2,
    fetch: (url, options) =>
      fetchSource(url, {
        ...options,
        requestPage: async () => {
          started.push(performance.now());
          return {
            status: 200,
            type: 'text/plain',
            text: 'Wikipedia article text. '.repeat(10),
          };
        },
      }),
  });
  assert.equal(started.length, 2);
  assert.ok((started[1] ?? 0) - (started[0] ?? 0) >= 999);
});

test('concurrent prefetched access blocks survive and successful refresh clears per-host and legacy blocks', async (t) => {
  const profilesDir = await mkdtemp(path.join(tmpdir(), 'prefetch-blocked-'));
  t.after(() => rm(profilesDir, { recursive: true, force: true }));
  const directory = path.join(profilesDir, 'evidence');
  await mkdir(directory);
  const legacyUrl = 'https://legacy.example.org/article';
  const legacyFile = path.join(directory, 'blocked-hosts.json');
  const legacy = JSON.stringify({
    'example.org': {
      url: legacyUrl,
      reason: 'Legacy block',
      failed_at: Date.now(),
    },
  });
  await writeFile(legacyFile, legacy);
  const sources = ['https://archive.gov/newton', 'https://museum.org/hooke'];
  const fetches: string[] = [];
  let blocking = true;
  const options = {
    profilesDir,
    fetch: async (url: string, options?: Parameters<typeof fetchSource>[1]) => {
      fetches.push(url);
      if (url === subject.wikipediaUrl)
        options?.onReferenceLinks?.([sources[0] as string, legacyUrl]);
      if (url === secondSubject.wikipediaUrl)
        options?.onReferenceLinks?.([sources[1] as string]);
      if (blocking && sources.includes(url))
        throw new SourceFetchError('Forbidden', 403);
      const data = {
        url,
        fetched_at: new Date().toISOString(),
        text: 'Evidence.',
      };
      return { ...data, id: hash(data) };
    },
    readLinks: async () => [sources[0] as string, legacyUrl],
  };
  const results = await prefetchBatch({
    ...options,
    subjects: [subject, secondSubject],
    concurrency: 2,
  });
  assert.ok(
    results[0]?.skipped.some(
      ({ reason }) => reason === 'Blocked host: Legacy block',
    ),
  );
  assert.ok(!fetches.includes(legacyUrl));
  const blocks = path.join(directory, 'blocked-hosts');
  assert.deepEqual(
    await readdir(blocks),
    ['archive.gov', 'museum.org'].map((host) => `${hash(host)}.json`).sort(),
  );
  blocking = false;
  await prefetchSubject({ ...options, subject, refresh: true });
  await assert.rejects(
    readFile(path.join(blocks, `${hash('archive.gov')}.json`)),
    { code: 'ENOENT' },
  );
  await rm(path.join(directory, 'urls', `${hash(legacyUrl)}.json`));
  fetches.length = 0;
  await prefetchSubject({ ...options, subject });
  assert.deepEqual(fetches, [legacyUrl]);
  assert.equal(await readFile(legacyFile, 'utf8'), legacy);
});
