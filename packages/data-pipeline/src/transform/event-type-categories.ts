import type { Category } from "@same-sky/shared-types";
import { WAR_TYPE_QID } from "../fetch/queries/historical-events.js";

// Closed, already-fully-enumerated set: exactly these 8 ?type class Q-IDs
// appear in events-historical.raw.json, matching EVENT_TYPES in
// fetch/queries/historical-events.ts.
export const EVENT_TYPE_CATEGORIES: Record<string, Category> = {
  [WAR_TYPE_QID]: "war", // war
  Q178561: "war", // battle
  Q188055: "war", // siege
  Q645883: "war", // military operation
  Q131569: "politics", // treaty
  Q10931: "politics", // revolution
  Q124734: "politics", // rebellion
  // "historical event" is a generic catch-all (only 25 rows) with no
  // inherent category signal — mapped to politics as a judgment call, per
  // the spec, not a real Wikidata signal.
  Q13418847: "politics", // historical event
};
