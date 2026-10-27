import type { SelectedEntityRef } from './ref';

// The Selection (CONTEXT.md): the one entity whose panel is open.
export interface SelectionMember {
  ref: SelectedEntityRef;
  slug: string;
}
