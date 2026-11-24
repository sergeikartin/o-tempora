import { createHash } from 'node:crypto';
import { asArray, asRecord, asString } from '../values.js';

export interface Evidence {
  source: string;
  quote: string;
  kind: 'wikipedia' | 'primary' | 'scholarly' | 'other';
  // The original work/account, not the website repeating it.
  origin: string;
}

export interface Finding {
  path: string;
  claim: string;
  verdict: 'supported' | 'contradicted' | 'unverifiable' | 'disputed';
  risk: 'ordinary' | 'corroborate';
  explanation: string;
  correction: string;
  evidence: Evidence[];
  counterevidence?: Evidence[];
}

export function findingExcerpts(
  finding: Pick<Finding, 'evidence' | 'counterevidence'>,
): Evidence[] {
  return [...finding.evidence, ...(finding.counterevidence ?? [])];
}

export interface Assessment {
  findings: Finding[];
  covered: string[];
  uncovered: string[];
  issues: string[];
  coherent: boolean;
  subject_dates: { path: string; boundary: 'start' | 'end'; year: number }[];
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function hash(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

export function strings(value: unknown, where: string): string[] {
  return asArray(value, where).map((item) => asString(item, where));
}

export function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  where: string,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${where}: expected ${allowed.join(' | ')}`);
  }
  return value as T;
}

export interface Audit {
  uncovered: string[];
  issues: string[];
  coherent: boolean;
}

export function parseAudit(value: unknown): Audit {
  const root = asRecord(value, 'audit');
  if (typeof root.coherent !== 'boolean')
    throw new Error('audit.coherent: expected boolean');
  return {
    uncovered: strings(root.uncovered, 'audit.uncovered'),
    issues: strings(root.issues, 'audit.issues'),
    coherent: root.coherent,
  };
}

export function parseExcerpts(value: unknown, field: string): Evidence[] {
  return asArray(value, field).map((item) => {
    const excerpt = asRecord(item, field);
    return {
      source: asString(excerpt.source, `${field}.source`),
      quote: asString(excerpt.quote, `${field}.quote`),
      kind: oneOf(
        excerpt.kind,
        ['wikipedia', 'primary', 'scholarly', 'other'],
        `${field}.kind`,
      ),
      origin: asString(excerpt.origin, `${field}.origin`),
    };
  });
}

export function parseAssessment(value: unknown): Assessment {
  const root = asRecord(value, 'assessment');
  return {
    ...parseAudit(root),
    covered: strings(root.covered, 'covered'),
    subject_dates: asArray(root.subject_dates, 'subject_dates').map((item) => {
      const date = asRecord(item, 'subject date');
      if (typeof date.year !== 'number' || !Number.isInteger(date.year))
        throw new Error('subject date: expected integer astronomical year');
      return {
        path: asString(date.path, 'subject date path'),
        boundary: oneOf(
          date.boundary,
          ['start', 'end'],
          'subject date boundary',
        ),
        year: date.year,
      };
    }),
    findings: asArray(root.findings, 'findings').map((item) => {
      const row = asRecord(item, 'finding');
      if (typeof row.correction !== 'string')
        throw new Error('correction: expected string');
      return {
        path: asString(row.path, 'finding.path'),
        claim: asString(row.claim, 'finding.claim'),
        verdict: oneOf(
          row.verdict,
          ['supported', 'contradicted', 'unverifiable', 'disputed'],
          'verdict',
        ),
        risk: oneOf(row.risk, ['ordinary', 'corroborate'], 'risk'),
        explanation: asString(row.explanation, 'explanation'),
        correction: row.correction,
        evidence: parseExcerpts(row.evidence, 'evidence'),
        ...(row.counterevidence === undefined
          ? {}
          : {
              counterevidence: parseExcerpts(
                row.counterevidence,
                'counterevidence',
              ),
            }),
      };
    }),
  };
}

export function normalizeText(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim();
}
