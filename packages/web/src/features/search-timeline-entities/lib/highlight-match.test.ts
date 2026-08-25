import { expect, test } from 'vitest';
import { splitOnMatch } from './highlight-match';

test('splitOnMatch finds a case-insensitive match and preserves original casing', () => {
  expect(splitOnMatch('Aristotle', 'risto')).toEqual({
    before: 'A',
    match: 'risto',
    after: 'tle',
  });
});

test('splitOnMatch returns null when the query does not occur in the text', () => {
  expect(splitOnMatch('Aristotle', 'plato')).toBeNull();
});

test('splitOnMatch returns null for an empty/whitespace-only query', () => {
  expect(splitOnMatch('Aristotle', '  ')).toBeNull();
});

test('splitOnMatch matches at the very start of the text', () => {
  expect(splitOnMatch('Korean War', 'korean')).toEqual({
    before: '',
    match: 'Korean',
    after: ' War',
  });
});
