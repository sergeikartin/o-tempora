import { expect, test } from 'vitest';
import {
  isSelectionFull,
  MAX_SELECTION_SIZE,
  type SelectionMember,
  toggleMember,
} from './selection';

const member = (id: string): SelectionMember => ({
  ref: { id, entityType: 'person' },
  slug: `slug-${id}`,
});

test('toggling an absent member appends it, keeping selection order', () => {
  expect(toggleMember([member('a')], member('b')).map((m) => m.ref.id)).toEqual(
    ['a', 'b'],
  );
});

test('toggling a present member removes it', () => {
  expect(
    toggleMember([member('a'), member('b')], member('a')).map((m) => m.ref.id),
  ).toEqual(['b']);
});

test('adding past the cap returns the same array', () => {
  const full = ['a', 'b', 'c', 'd'].map(member);
  expect(isSelectionFull(full)).toBe(true);
  expect(full).toHaveLength(MAX_SELECTION_SIZE);
  expect(toggleMember(full, member('e'))).toBe(full);
});

test('a member of a full selection can still be removed', () => {
  const full = ['a', 'b', 'c', 'd'].map(member);
  expect(toggleMember(full, member('c'))).toHaveLength(3);
});
