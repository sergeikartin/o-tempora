import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type TestContext, test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { parseRawProfile, shipProfiles } from '../output/profiles.js';
import { passages } from './passages.js';
import { SessionBridge } from './session.js';
import { hash, type Source } from './verification/policy.js';
import { reportPathFor, verifyProfile } from './verification/runner.js';
import { SourceStore } from './verification/sources.js';

async function fixture(t: TestContext) {
  const directory = await mkdtemp(path.join(tmpdir(), 'profile-session-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return {
    directory,
    bridge: new SessionBridge({ directory, pollMs: 5, timeoutMs: 2000 }),
  };
}

async function waitFor<T>(read: () => Promise<T | undefined>): Promise<T> {
  for (let i = 0; i < 200; i++) {
    const value = await read();
    if (value !== undefined) return value;
    await setTimeout(5);
  }
  throw new Error('Test session request did not arrive');
}

async function nextRequest(directory: string, seen = new Set<string>()) {
  return waitFor(async () => {
    for (const name of await readdir(directory)) {
      if (seen.has(name)) continue;
      const file = path.join(directory, name, 'request.json');
      try {
        const request = JSON.parse(await readFile(file, 'utf8'));
        seen.add(name);
        return { directory: path.dirname(file), request };
      } catch (error) {
        if (
          !['ENOENT', 'ENOTDIR'].includes(
            (error as NodeJS.ErrnoException).code ?? '',
          )
        )
          throw error;
      }
    }
    return undefined;
  });
}

async function reply(directory: string, value: unknown) {
  await writeFile(path.join(directory, 'response.tmp'), JSON.stringify(value));
  await rename(
    path.join(directory, 'response.tmp'),
    path.join(directory, 'response.json'),
  );
}

test('session completions preserve structured replies without inventing model usage', async (t) => {
  const { directory } = await fixture(t);
  const messages: string[] = [];
  const logged = new SessionBridge({
    directory,
    pollMs: 5,
    timeoutMs: 2000,
    log: (message) => messages.push(message),
  });
  const pending = logged.complete('Write a Profile');
  const task = await nextRequest(directory);
  assert.equal(task.request.role, 'write');
  assert.equal(task.request.payload.prompt, 'Write a Profile');
  await reply(task.directory, {
    request_hash: task.request.request_hash,
    model: null,
    result: { overview: 'A Profile.' },
  });
  const completion = await pending;
  assert.equal(completion.tokens, null);
  assert.equal(completion.reasoningEffort, null);
  assert.equal(completion.model, 'session-agent (model unreported)');
  assert.deepEqual(JSON.parse(completion.text), { overview: 'A Profile.' });
  assert.ok(
    messages.some((message) =>
      /model unreported.*runtime metadata/.test(message),
    ),
  );
});

test('session completions preserve the runtime model identifier', async (t) => {
  const { directory, bridge } = await fixture(t);
  const pending = bridge.complete('Write a Profile');
  const task = await nextRequest(directory);
  await reply(task.directory, {
    request_hash: task.request.request_hash,
    model: 'gpt-6.1-sol',
    reasoning_effort: 'medium',
    tokens: { input: 122033, output: 4182 },
    result: { overview: 'A Profile.' },
  });
  const completion = await pending;
  assert.equal(completion.model, 'gpt-6.1-sol');
  assert.equal(completion.reasoningEffort, 'medium');
  assert.deepEqual(completion.tokens, { input: 122033, output: 4182 });
});

test('mismatched replies and abandoned requests fail without calling a provider', async (t) => {
  const { directory, bridge } = await fixture(t);
  const pending = assert.rejects(
    bridge.complete('Audit', 'audit'),
    /another request/,
  );
  const task = await nextRequest(directory);
  await reply(task.directory, {
    request_hash: 'stale',
    model: null,
    result: {},
  });
  await pending;
  const timeout = new SessionBridge({ directory, timeoutMs: 10, pollMs: 1 });
  await assert.rejects(timeout.complete('Repair', 'repair'), /timed out/);
});

test('session responses reject invalid token counts', async (t) => {
  const { directory, bridge } = await fixture(t);
  const seen = new Set<string>();
  for (const tokens of [
    { input: -1, output: 4 },
    { input: 1, output: 0.5 },
    { input: '1', output: 4 },
    { input: 1 },
  ]) {
    const pending = assert.rejects(bridge.complete('Write'), /tokens:/);
    const task = await nextRequest(directory, seen);
    await reply(task.directory, {
      request_hash: task.request.request_hash,
      model: 'session-writer',
      tokens,
      result: {},
    });
    await pending;
  }
});

for (const repair of [false, true])
  test(`session verification uses fetched evidence and separate audit (repair=${repair})`, async (t) => {
    const { directory, bridge } = await fixture(t);
    const url = 'https://en.wikipedia.org/wiki/Isaac_Newton';
    const text =
      'Newton published the Principia in 1687. Newton was an English mathematician.';
    const padding = 'Unrelated source text. '.repeat(400);
    const article = padding + text;
    const source: Source = {
      id: hash(article),
      text: article,
      url,
      fetched_at: '2026-11-16T00:00:00Z',
      anchors: [],
    };
    const profile = {
      subject: 'Isaac Newton',
      type: 'person',
      wikipedia_url: url,
      overview: repair
        ? 'Newton was an English physician.'
        : 'Newton was an English mathematician.',
      key_moments: [
        {
          date: '1687',
          title: 'Principia',
          text: 'Newton published the Principia in 1687.',
          claims: ['Newton published the Principia in 1687.'],
          source: url,
        },
      ],
      deep_facts: [],
      connections: [],
      meta: {
        locale: 'en',
        source: { wikidata_qid: 'Q935' },
        review: { status: 'draft' },
      },
    };
    const filePath = path.join(directory, 'raw', 'newton.json');
    await mkdir(path.dirname(filePath));
    await writeFile(filePath, JSON.stringify(profile));
    const subject = {
      qid: 'Q935',
      lane: 'people' as const,
      name: 'Isaac Newton',
      dateSpan: { startYear: 1643, endYear: 1727 },
      wikipediaUrl: url,
    };
    const seen = new Set<string>();
    let fetches = 0;
    const pending = verifyProfile({
      filePath,
      subject,
      research: bridge.research,
      complete: bridge.complete,
      repair,
      resolve: async () => new Map([[url, 'Q935']]),
      sources: new SourceStore(async () => {
        fetches++;
        return source;
      }),
    });
    for (let pass = 0; pass < (repair ? 2 : 1); pass++) {
      const task = await nextRequest(directory, seen);
      assert.equal(task.request.role, 'research');
      await writeFile(
        path.join(task.directory, 'sources', 'one.request.json'),
        JSON.stringify({ url, query: 'PRINCIPIA' }),
      );
      const fetched = await waitFor(async () => {
        try {
          return JSON.parse(
            await readFile(
              path.join(task.directory, 'sources', 'one.response.json'),
              'utf8',
            ),
          );
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT')
            return undefined;
          throw error;
        }
      });
      assert.equal(fetched.source.id, source.id);
      assert.equal(fetched.source.url, source.url);
      assert.equal(fetched.source.text, article.slice(fetched.source.offset));
      assert.ok(fetched.source.offset > 0);
      assert.ok(fetched.source.text.includes(text));
      assert.equal(fetched.source.next_offset, null);
      const fields = passages(task.request.payload.profile);
      await reply(task.directory, {
        request_hash: task.request.request_hash,
        model: 'session-researcher',
        result: {
          covered: fields.map((field) => field.path),
          uncovered: [],
          issues: [],
          coherent: true,
          subject_dates: [],
          findings: fields.map((field) => ({
            path: field.path,
            claim: field.text,
            verdict:
              repair && pass === 0 && field.path === 'overview'
                ? 'contradicted'
                : 'supported',
            risk: 'ordinary',
            explanation: 'The article supports it.',
            correction: '',
            evidence: [
              {
                source: source.id,
                quote: text,
                kind: 'wikipedia',
                origin: 'Newton article',
              },
            ],
          })),
        },
      });
      const audit = await nextRequest(directory, seen);
      assert.equal(audit.request.role, 'audit');
      assert.match(audit.request.payload.prompt, /Independently audit/);
      await reply(audit.directory, {
        request_hash: audit.request.request_hash,
        model: 'session-auditor',
        result: { uncovered: [], issues: [], coherent: true },
      });
      if (repair && pass === 0) {
        const correction = await nextRequest(directory, seen);
        assert.equal(correction.request.role, 'repair');
        const { meta: _meta, ...repaired } = profile;
        await reply(correction.directory, {
          request_hash: correction.request.request_hash,
          model: 'session-repairer',
          result: {
            ...repaired,
            overview: 'Newton was an English mathematician.',
          },
        });
      }
    }
    assert.equal((await pending).status, 'approved');
    assert.equal(fetches, 1);
    const record = JSON.parse(await readFile(filePath, 'utf8'));
    const report = JSON.parse(await readFile(reportPathFor(filePath), 'utf8'));
    assert.deepEqual(report.models, ['session-researcher', 'session-auditor']);
    assert.equal(report.repairs, repair ? 1 : 0);
    assert.equal(record.overview, 'Newton was an English mathematician.');
    assert.equal(
      shipProfiles(
        [parseRawProfile(record, filePath, report)],
        [{ ...subject, slug: 'newton', fameScore: 99, dates: '1643–1727' }],
      ).size,
      1,
    );
  });
