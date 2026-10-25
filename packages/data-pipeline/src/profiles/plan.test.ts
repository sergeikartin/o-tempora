import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planProfiles } from './plan.js';
import type { StoredProfile } from './store.js';
import type { ProfileSubject } from './subjects.js';

const subject = (qid: string): ProfileSubject => ({
  qid,
  lane: 'people',
  name: qid,
  dates: '1900–1950',
  wikipediaUrl: `https://en.wikipedia.org/wiki/${qid}`,
});

const stored = (
  qid: string,
  status: string,
  promptHash: string,
): [string, StoredProfile] => [
  qid,
  { qid, filePath: `/profiles/${qid}.en.json`, status, promptHash },
];

const options = {
  currentPromptHash: 'new',
  regenerateStale: false,
  incomingDir: '/incoming',
};

test('plans entities with no record and skips those at the current prompt', () => {
  const entries = planProfiles(
    [subject('Q1'), subject('Q2')],
    new Map([stored('Q2', 'draft', 'new')]),
    options,
  );
  assert.deepEqual(
    entries.map((e) => [e.subject.qid, e.kind]),
    [
      ['Q1', 'write'],
      ['Q2', 'skip'],
    ],
  );
  assert.equal(
    entries[0]?.kind === 'write' && entries[0].outputPath,
    '/incoming/Q1.json',
  );
  assert.equal(entries[1]?.kind === 'skip' && entries[1].reason, 'current');
});

test('skips a stale record unless regeneration is requested', () => {
  const records = new Map([stored('Q1', 'reviewed', 'old')]);

  const [skipped] = planProfiles([subject('Q1')], records, options);
  assert.equal(skipped?.kind === 'skip' && skipped.reason, 'stale');

  const [regenerated] = planProfiles([subject('Q1')], records, {
    ...options,
    regenerateStale: true,
  });
  assert.equal(regenerated?.kind === 'write' && regenerated.regenerates, true);
});

test('regeneration leaves records at the current prompt alone', () => {
  const [entry] = planProfiles(
    [subject('Q1')],
    new Map([stored('Q1', 'reviewed', 'new')]),
    { ...options, regenerateStale: true },
  );
  assert.equal(entry?.kind === 'skip' && entry.reason, 'current');
});

test('never plans an edited record, even a stale one with regeneration on', () => {
  const [entry] = planProfiles(
    [subject('Q1')],
    new Map([stored('Q1', 'edited', 'old')]),
    { ...options, regenerateStale: true },
  );
  assert.equal(entry?.kind === 'skip' && entry.reason, 'edited');
});
