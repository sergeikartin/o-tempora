import { test, expect } from 'vitest';
import en from './en.json';
import ru from './ru.json';

// Paraglide's stable API has no build-failing check for a key missing from
// one locale (packages/web/docs/adr/0005-paraglide-js-replaces-hand-rolled-i18n.md)
// — this replaces that guarantee so a missing translation fails CI instead
// of silently rendering blank.
test('en and ru message catalogs have the same keys', () => {
  const enKeys = Object.keys(en).filter((key) => key !== '$schema').sort();
  const ruKeys = Object.keys(ru).filter((key) => key !== '$schema').sort();
  expect(ruKeys).toEqual(enKeys);
});
