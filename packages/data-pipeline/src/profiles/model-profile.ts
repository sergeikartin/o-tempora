import { asArray, asRecord, asString } from '../output/profiles.js';

// What the profile-writer agent returns (prompts/profile.md's "Return JSON
// only" block), validated. `meta` is added later by finalize.
export interface ModelProfile {
  subject: string;
  type: string;
  wikipedia_url: string;
  overview: string;
  key_moments: {
    date: string;
    title: string;
    text: string;
    claims: string[];
    source: string;
  }[];
  deep_facts: {
    text: string;
    type: string;
    is_legend: boolean;
    confidence: string;
    claims: string[];
    source: string;
  }[];
  connections: {
    name: string;
    wikipedia_url: string;
    connection: string;
    importance: string;
  }[];
}

const MAX_KEY_MOMENTS = 4;
const MAX_DEEP_FACTS = 3;
const MAX_CONNECTIONS = 15;

const NOT_ON_WIKIPEDIA = 'not_on_wikipedia';
const WIKIPEDIA_SOURCE = /^https:\/\/en\.wikipedia\.org\/wiki\/\S+$/;

function asOneOf(value: unknown, allowed: readonly string[], where: string) {
  const text = asString(value, where);
  if (!allowed.includes(text)) {
    throw new Error(`${where}: expected one of ${allowed.join(', ')}`);
  }
  return text;
}

function asSource(value: unknown, where: string): string {
  const text = asString(value, where);
  if (text !== NOT_ON_WIKIPEDIA && !WIKIPEDIA_SOURCE.test(text)) {
    throw new Error(
      `${where}: expected an en.wikipedia.org article URL or "${NOT_ON_WIKIPEDIA}"`,
    );
  }
  return text;
}

function asClaims(value: unknown, where: string): string[] {
  const claims = asArray(value, where).map((claim, index) =>
    asString(claim, `${where}[${index}]`),
  );
  if (claims.length === 0) throw new Error(`${where}: expected claims`);
  return claims;
}

function asBoundedArray(
  value: unknown,
  where: string,
  min: number,
  max: number,
): unknown[] {
  const items = asArray(value, where);
  if (items.length < min || items.length > max) {
    throw new Error(`${where}: expected ${min} to ${max} items`);
  }
  return items;
}

export function parseModelProfile(json: unknown, where: string): ModelProfile {
  const root = asRecord(json, where);

  return {
    subject: asString(root.subject, `${where}: subject`),
    type: asString(root.type, `${where}: type`),
    wikipedia_url: asString(root.wikipedia_url, `${where}: wikipedia_url`),
    overview: asString(root.overview, `${where}: overview`),
    key_moments: asBoundedArray(
      root.key_moments,
      `${where}: key_moments`,
      1,
      MAX_KEY_MOMENTS,
    ).map((item, index) => {
      const at = `${where}: key_moments[${index}]`;
      const moment = asRecord(item, at);
      return {
        date: asString(moment.date, `${at}.date`),
        title: asString(moment.title, `${at}.title`),
        text: asString(moment.text, `${at}.text`),
        claims: asClaims(moment.claims, `${at}.claims`),
        source: asSource(moment.source, `${at}.source`),
      };
    }),
    deep_facts: asBoundedArray(
      root.deep_facts,
      `${where}: deep_facts`,
      0,
      MAX_DEEP_FACTS,
    ).map((item, index) => {
      const at = `${where}: deep_facts[${index}]`;
      const fact = asRecord(item, at);
      if (typeof fact.is_legend !== 'boolean') {
        throw new Error(`${at}.is_legend: expected a boolean`);
      }
      return {
        text: asString(fact.text, `${at}.text`),
        type: asOneOf(
          fact.type,
          ['hidden_story', 'unique_detail'],
          `${at}.type`,
        ),
        is_legend: fact.is_legend,
        confidence: asOneOf(
          fact.confidence,
          ['high', 'medium'],
          `${at}.confidence`,
        ),
        claims: asClaims(fact.claims, `${at}.claims`),
        source: asSource(fact.source, `${at}.source`),
      };
    }),
    connections: asBoundedArray(
      root.connections,
      `${where}: connections`,
      0,
      MAX_CONNECTIONS,
    ).map((item, index) => {
      const at = `${where}: connections[${index}]`;
      const connection = asRecord(item, at);
      return {
        name: asString(connection.name, `${at}.name`),
        wikipedia_url: asString(
          connection.wikipedia_url,
          `${at}.wikipedia_url`,
        ),
        connection: asString(connection.connection, `${at}.connection`),
        importance: asOneOf(
          connection.importance,
          ['high', 'medium'],
          `${at}.importance`,
        ),
      };
    }),
  };
}
