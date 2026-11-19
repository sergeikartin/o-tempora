import type { SelectedEntityRef } from './ref';

// The Selection (GLOSSARY.md): the one entity whose panel is open.
export interface SelectionMember {
  ref: SelectedEntityRef;
  slug: string;
}
