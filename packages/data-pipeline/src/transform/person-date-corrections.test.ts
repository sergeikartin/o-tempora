import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPeople } from '../output/write-datasets.js';
import { loadSubjects } from '../profiles/subjects.js';
import { transformPeople } from './index.js';
import { correctPersonDates } from './person-date-corrections.js';

const rows = transformPeople();

test('Newton has consistent Gregorian dates in both locale datasets and Profile inputs', () => {
  const newton = rows.find((row) => row.wdId === 'Q935');
  assert.ok(newton);
  for (const lang of ['en', 'ru'] as const) {
    assert.deepEqual(
      buildPeople(rows, lang).people.find(
        (candidate) => candidate.id === newton.id,
      )?.lifespan,
      {
        start: { year: 1643, month: 1 },
        end: { year: 1727, month: 3 },
      },
    );
  }
  assert.equal(
    loadSubjects().find((subject) => subject.qid === 'Q935')?.dates,
    '1643–1727',
  );

  // Pantheon's full date says 1981 for Titus; its year column correctly says 81.
  assert.equal(rows.find((row) => row.wdId === 'Q1421')?.deathyear, 81);
});

test('a changed Newton source baseline requires review instead of a silent correction', () => {
  const newton = rows.find((row) => row.wdId === 'Q935');
  assert.ok(newton);
  assert.throws(
    () =>
      correctPersonDates({
        ...newton,
        name: newton.name ?? '',
        deathyear: 1728,
      }),
    /Pantheon dates changed/,
  );
});
