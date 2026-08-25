// Which lane a timeline entity belongs to — a web-UI concept (not part of
// packages/shared-types' pipeline-owned domain model), shared by every
// feature/widget that needs to resolve "this id, in this lane" back to a
// full entity: features/select-timeline-entity (click-to-select),
// widgets/timeline-canvas (the click source), and
// features/search-timeline-entities (search results). Lives in shared/lib,
// not owned by any one of those features, since FSD forbids same-layer
// features importing from each other.
export const ENTITY_TYPES = ['person', 'conflict', 'milestone'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

// Identifies an entity without its full data — TimelineCanvas's delegated
// click listener resolves only this much from the DOM
// (data-entity-id/data-entity-type), and a search result resolves only this
// much from its own matched entity — leaving the actual full-entity lookup
// to whoever owns the in-memory datasets (app/App.tsx).
export interface SelectedEntityRef {
  id: string;
  entityType: EntityType;
}
