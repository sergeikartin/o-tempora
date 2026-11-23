import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PROMPT_PATH } from './paths.js';
import { loadPrompt, parseAgentModel, parsePrompt } from './prompt.js';

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

test('the checked-in prompt hashes to the value it states', async () => {
  const stated = /first 12 chars: `([0-9a-f]{12})`/.exec(
    await readFile(PROMPT_PATH, 'utf8'),
  )?.[1];
  assert.equal((await loadPrompt()).hash, stated);
});

test('parseAgentModel reads the model from frontmatter', () => {
  assert.equal(parseAgentModel('---\nname: x\nmodel: opus\n---\nbody'), 'opus');
  assert.throws(() => parseAgentModel('---\nname: x\n---\n'), /model/);
});
