export interface SparqlBindingValue {
  type: string;
  value: string;
  datatype?: string;
  "xml:lang"?: string;
}

export type SparqlBinding = Record<string, SparqlBindingValue>;

export interface SparqlResults {
  head: { vars: string[] };
  results: { bindings: SparqlBinding[] };
}
