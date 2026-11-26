import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { PACKAGE_DIR, PROMPTS_DIR } from './paths.ts';
import { loadWriterModel, parseAgentModel, parsePrompt } from './prompt.ts';

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

test('all harness agent stubs point to existing canonical Profile role docs', async () => {
  const repoRoot = path.resolve(PACKAGE_DIR, '..', '..');
  const roles = [
    {
      name: 'profile-coordinator',
      doc: 'packages/data-pipeline/docs/profile-coordinator.md',
    },
    {
      name: 'profile-translation-coordinator',
      doc: 'packages/data-pipeline/docs/profile-translation-coordinator.md',
    },
    {
      name: 'profile-scout',
      doc: 'packages/data-pipeline/docs/profile-roles/profile-scout.md',
    },
    {
      name: 'profile-writer',
      doc: 'packages/data-pipeline/docs/profile-roles/profile-writer.md',
    },
    {
      name: 'profile-auditor',
      doc: 'packages/data-pipeline/docs/profile-roles/profile-auditor.md',
    },
    {
      name: 'profile-translator',
      doc: 'packages/data-pipeline/docs/profile-roles/profile-translator.md',
    },
    {
      name: 'profile-translation-auditor',
      doc: 'packages/data-pipeline/docs/profile-roles/profile-translation-auditor.md',
    },
  ];
  const harnesses = [
    { dir: '.claude/agents', ext: '.md' },
    { dir: '.codex/agents', ext: '.toml' },
    { dir: '.agents/agents', ext: '.md' },
  ];

  for (const role of roles) {
    const docText = await readFile(path.join(repoRoot, role.doc), 'utf8');
    assert.ok(docText.trim().length > 0, `empty canonical doc: ${role.doc}`);
    for (const harness of harnesses) {
      const stubPath = path.join(
        repoRoot,
        harness.dir,
        `${role.name}${harness.ext}`,
      );
      const stubText = await readFile(stubPath, 'utf8');
      assert.ok(
        stubText.includes(role.doc),
        `${stubPath} should reference ${role.doc}`,
      );
    }
  }

  assert.ok((await loadWriterModel()).length > 0);
});
