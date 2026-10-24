import type { SelectedEntityRef } from './ref';

// The cap on a Selection (CONTEXT.md): beyond four marks the bands and the
// panel list stop being readable.
export const MAX_SELECTION_SIZE = 4;

export interface SelectionMember {
  ref: SelectedEntityRef;
  slug: string;
}

export function isSelectionFull(members: readonly SelectionMember[]): boolean {
  return members.length >= MAX_SELECTION_SIZE;
}

// Shift/Ctrl/Cmd-click or the panel's add mode: removes the member when
// present, appends it otherwise, and ignores an add past the cap (returning
// the same array so callers can tell nothing changed).
export function toggleMember(
  members: readonly SelectionMember[],
  member: SelectionMember,
): readonly SelectionMember[] {
  if (members.some((existing) => existing.ref.id === member.ref.id)) {
    return members.filter((existing) => existing.ref.id !== member.ref.id);
  }
  if (isSelectionFull(members)) return members;
  return [...members, member];
}
