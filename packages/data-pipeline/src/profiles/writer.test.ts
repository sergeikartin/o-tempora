import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { parseModelProfile } from './model-profile.js';
import { incomingPath } from './plan.js';
import type { Complete } from './providers.js';
import type { ProfileSubject } from './subjects.js';
import { extractJson, type WriteEntry, writeProfiles } from './writer.js';

const PROMPT =
  '## Prompt\n\n```text\nWrite {name} ({type}). Return JSON only.\n```\n';

const subject = (qid: string, name: string): ProfileSubject => ({
  qid,
  lane: 'people',
  name,
  dates: '1900–1950',
  wikipediaUrl: `https://en.wikipedia.org/wiki/${name}`,
});

const profile = (name: string) => ({
  subject: name,
  type: 'person',
  wikipedia_url: `https://en.wikipedia.org/wiki/${name}`,
  overview: 'An overview.',
  key_moments: [
    {
      date: '1900',
      title: 'A moment',
      text: 'It happened.',
      claims: ['It happened in 1900.'],
      source: 'not_on_wikipedia',
    },
  ],
  deep_facts: [],
  connections: [],
});

async function entries(...names: string[]): Promise<WriteEntry[]> {
  const dir = await mkdtemp(path.join(tmpdir(), 'writer-'));
  return names.map((name, index) => {
    const s = subject(`Q${index + 1}`, name);
    return {
      kind: 'write',
      subject: s,
      regenerates: false,
      outputPath: incomingPath(dir, s.qid),
    };
  });
}

test('extractJson reads the object out of a fenced reply', () => {
  assert.deepEqual(extractJson('Here:\n```json\n{"a": 1}\n```'), { a: 1 });
  assert.throws(() => extractJson('no object'), /JSON/);
});

test('stages the validated reply with a writer block, one failure not stopping the rest', async () => {
  const [ada, bad] = await entries('Ada', 'Bad');
  const prompts: string[] = [];
  const complete: Complete = async (prompt) => {
    prompts.push(prompt);
    const text = prompt.includes('Write Bad')
      ? '{"overview": ""}'
      : `\`\`\`json\n${JSON.stringify(profile('Ada'))}\n\`\`\``;
    return { text, model: 'm-1', tokens: { input: 10, output: 20 } };
  };

  const result = await writeProfiles({
    entries: [ada as WriteEntry, bad as WriteEntry],
    promptMarkdown: PROMPT,
    complete,
    provider: 'openai',
    concurrency: 2,
  });

  assert.deepEqual(result.written, [(ada as WriteEntry).outputPath]);
  assert.equal(result.failed.length, 1);
  assert.equal(result.failed[0]?.qid, 'Q2');
  assert.deepEqual(prompts.sort(), [
    'Write Ada (person). Return JSON only.\n',
    'Write Bad (person). Return JSON only.\n',
  ]);

  const staged = JSON.parse(
    await readFile((ada as WriteEntry).outputPath, 'utf8'),
  );
  assert.deepEqual(staged.writer, {
    provider: 'openai',
    model: 'm-1',
    tokens: { input: 10, output: 20 },
  });
  parseModelProfile(staged, 'staged');
});
