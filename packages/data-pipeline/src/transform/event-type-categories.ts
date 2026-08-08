import type { ConflictCategory } from "@same-sky/shared-types";
import {
  WAR_TYPE_QID,
  BATTLE_TYPE_QID,
  SIEGE_TYPE_QID,
  MILITARY_OPERATION_TYPE_QID,
  REVOLUTION_TYPE_QID,
  REBELLION_TYPE_QID,
  COUP_D_ETAT_TYPE_QID,
  WAR_OF_INDEPENDENCE_TYPE_QID,
  PEACE_TREATY_TYPE_QID,
} from "../fetch/queries/historical-events.js";

// Direct 1:1 map from each of the 9 surviving Q-IDs to its own
// ConflictCategory value — no more collapsing multiple Wikidata classes onto
// a shared "war"/"politics" bucket like the pre-taxonomy-restructure table
// did. Each raw file fetch-historical-events.ts now writes (one per
// category) only ever carries the one Q-ID it was fetched for, so every row
// resolves through exactly one of these entries.
export const EVENT_TYPE_CATEGORIES: Record<string, ConflictCategory> = {
  [WAR_TYPE_QID]: "war",
  [BATTLE_TYPE_QID]: "battle",
  [SIEGE_TYPE_QID]: "siege",
  [MILITARY_OPERATION_TYPE_QID]: "military-operation",
  [REVOLUTION_TYPE_QID]: "revolution",
  [REBELLION_TYPE_QID]: "rebellion",
  [COUP_D_ETAT_TYPE_QID]: "coup-d-etat",
  [WAR_OF_INDEPENDENCE_TYPE_QID]: "war-of-independence",
  [PEACE_TREATY_TYPE_QID]: "peace-treaty",
};
