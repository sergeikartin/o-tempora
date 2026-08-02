import type { SparqlBinding, SparqlBindingValue, SparqlResults } from "./sparql-result-shape.js";

function isBindingValue(value: unknown): value is SparqlBindingValue {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.type === "string" && typeof candidate.value === "string";
}

function isBinding(value: unknown): value is SparqlBinding {
  if (typeof value !== "object" || value === null) return false;
  return Object.values(value as Record<string, unknown>).every(isBindingValue);
}

/**
 * Structural check on the SPARQL JSON shape only (head.vars / results.bindings
 * conform to the W3C SPARQL 1.1 Query Results JSON format). This does not
 * interpret, merge, or tag the data — that boundary belongs to Transform.
 */
export function validateSparqlResultShape(data: unknown): SparqlResults {
  if (typeof data !== "object" || data === null) {
    throw new Error("SPARQL response is not a JSON object.");
  }

  const head = (data as Record<string, unknown>).head;
  if (
    typeof head !== "object" ||
    head === null ||
    !Array.isArray((head as Record<string, unknown>).vars) ||
    !(head as { vars: unknown[] }).vars.every((entry) => typeof entry === "string")
  ) {
    throw new Error("SPARQL response is missing a valid head.vars string array.");
  }

  const results = (data as Record<string, unknown>).results;
  if (
    typeof results !== "object" ||
    results === null ||
    !Array.isArray((results as Record<string, unknown>).bindings)
  ) {
    throw new Error("SPARQL response is missing a valid results.bindings array.");
  }

  const bindings = (results as { bindings: unknown[] }).bindings;
  if (!bindings.every(isBinding)) {
    throw new Error("SPARQL response contains a malformed binding row.");
  }

  return data as SparqlResults;
}
