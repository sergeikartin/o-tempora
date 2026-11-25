import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { PROMPTS_DIR } from './paths.ts';
import { parseAgentModel, parsePrompt } from './prompt.ts';

const markdown = [
  '- **Version:** 1.2.3',
  '',
  '## Prompt',
  '',
  '```text',
  'write a profile',
  '```',
  '',
  '## Meta',
  '',
  '```text',
  'not the prompt',
  '```',
].join('\n');

test('parsePrompt reads the version and hashes the first block after "## Prompt"', () => {
  const info = parsePrompt(markdown);
  assert.equal(info.version, '1.2.3');
  assert.equal(info.hash.length, 12);
  assert.notEqual(
    info.hash,
    parsePrompt(markdown.replace('write a', 'write the')).hash,
  );
  assert.equal(
    info.hash,
    parsePrompt(markdown.replace('not the prompt', 'other')).hash,
  );
});

test('parsePrompt throws when the prompt block is missing', () => {
  assert.throws(() => parsePrompt('no prompt here'), /Prompt/);
});

test('the checked-in prompts hash to the values they state', async () => {
  for (const filename of await readdir(PROMPTS_DIR)) {
    if (!filename.endsWith('.md')) continue;
    const markdown = await readFile(path.join(PROMPTS_DIR, filename), 'utf8');
    const stated = /first 12 chars: `([0-9a-f]{12})`/.exec(markdown)?.[1];
    assert.equal(parsePrompt(markdown, filename).hash, stated, filename);
  }
});

test('parseAgentModel reads the model from frontmatter', () => {
  assert.equal(parseAgentModel('---\nname: x\nmodel: opus\n---\nbody'), 'opus');
  assert.throws(() => parseAgentModel('---\nname: x\n---\n'), /model/);
});
