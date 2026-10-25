import assert from 'node:assert/strict';
import { test } from 'node:test';
import { qidsByTitle, titleOfArticleUrl } from './wikipedia-qids.js';

test('titleOfArticleUrl reads plain article links only', () => {
  assert.equal(
    titleOfArticleUrl('https://en.wikipedia.org/wiki/Isaac_Newton'),
    'Isaac Newton',
  );
  assert.equal(
    titleOfArticleUrl('https://en.wikipedia.org/wiki/Ren%C3%A9_Descartes'),
    'René Descartes',
  );
  assert.equal(
    titleOfArticleUrl('https://en.wikipedia.org/wiki/Armada#Defeat'),
    undefined,
  );
  assert.equal(titleOfArticleUrl('https://ru.wikipedia.org/wiki/X'), undefined);
});

test('qidsByTitle follows normalization and redirects to the page item', () => {
  const found = qidsByTitle(['isaac Newton', 'Sir Isaac Newton', 'Nowhere'], {
    query: {
      normalized: [{ from: 'isaac Newton', to: 'Isaac Newton' }],
      redirects: [{ from: 'Sir Isaac Newton', to: 'Isaac Newton' }],
      pages: {
        '1': { title: 'Isaac Newton', pageprops: { wikibase_item: 'Q935' } },
        '-1': { title: 'Nowhere' },
      },
    },
  });
  assert.deepEqual(
    [...found],
    [
      ['isaac Newton', 'Q935'],
      ['Sir Isaac Newton', 'Q935'],
    ],
  );
});
