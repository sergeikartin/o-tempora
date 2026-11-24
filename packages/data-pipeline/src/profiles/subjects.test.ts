import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { formatDates, loadSubjects, subjectBrief } from './subjects.js';

test('formatDates writes CE spans and single years', () => {
  assert.equal(formatDates({ startYear: 1789, endYear: 1799 }), '1789–1799');
  assert.equal(formatDates({ startYear: 1969 }), '1969');
  assert.equal(formatDates({ startYear: 1969, endYear: 1969 }), '1969');
  assert.equal(formatDates({ startYear: 476 }), 'AD 476');
});

test('formatDates converts astronomical years to BC', () => {
  assert.equal(formatDates({ startYear: -550, endYear: -478 }), '551–479 BC');
  assert.equal(formatDates({ startYear: -43, endYear: 14 }), '44 BC–AD 14');
  assert.equal(formatDates({ startYear: 0 }), '1 BC');
});

test('formatDates marks living people and approximate dates', () => {
  assert.equal(formatDates({ startYear: 1950, ongoing: true }), '1950–present');
  assert.equal(formatDates({ startYear: 1450, approximate: true }), 'c. 1450');
});

test('Profile subjects populate the cache with Russian metadata and refresh on stale or corrupt inputs', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'profile-subjects-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const cachePath = path.join(root, 'cache.json');
  const fresh = loadSubjects({ bypassCache: true });
  const newton = fresh.find(({ qid }) => qid === 'Q935');
  assert.ok(newton?.ru?.name);
  assert.match(newton.ru.name, /Ньютон/);
  assert.ok(newton.ru.tagline);
  assert.ok(newton.ru.description);
  assert.equal('ru' in subjectBrief(newton), false);

  let size = 1;
  let mtimeMs = 1;
  let computed = 0;
  const options = {
    cachePath,
    compute: () => {
      computed++;
      return fresh;
    },
    statInputs: () => ({ 'test.raw.json': { size, mtimeMs } }),
  };
  assert.deepEqual(loadSubjects(options), fresh);
  assert.deepEqual(
    loadSubjects({
      ...options,
      compute: () => assert.fail('warm cache rebuilt'),
    }),
    fresh,
  );
  assert.equal(computed, 1);
  size++;
  assert.deepEqual(loadSubjects(options), fresh);
  mtimeMs++;
  assert.deepEqual(loadSubjects(options), fresh);
  assert.equal(computed, 3);

  writeFileSync(cachePath, '{broken');
  assert.deepEqual(loadSubjects(options), fresh);
  const saved = JSON.parse(readFileSync(cachePath, 'utf8'));
  for (const change of [{ schema_version: 2 }, { subjects: [{}] }]) {
    writeFileSync(cachePath, JSON.stringify({ ...saved, ...change }));
    assert.deepEqual(loadSubjects(options), fresh);
  }
  assert.equal(computed, 6);
  assert.equal(JSON.parse(readFileSync(cachePath, 'utf8')).schema_version, 1);
  assert.deepEqual(
    loadSubjects({ ...options, cachePath: path.join(cachePath, 'unwritable') }),
    fresh,
  );
});
