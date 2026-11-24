import type { ModelProfile } from '../model-profile.js';
import { passages } from '../passages.js';
import { readPromptText } from '../prompt.js';
import { type ProfileSubject, subjectBrief } from '../subjects.js';
import { asArray, asRecord, asString } from '../values.js';
import {
  type Assessment,
  type Evidence,
  findingExcerpts,
  hash,
  normalizeText,
  oneOf,
  parseExcerpts,
  strings,
} from './assessment.js';
import type { Source } from './policy.js';
export interface AdversarialTarget {
  finding_index: number;
  path: string;
  claim: string;
  claim_hash: string;
  passage_text: string;
  existing_counterevidence: Evidence[];
}

export interface AdversarialCheck {
  finding_index: number;
  path: string;
  queries: string[];
  outcome: 'no_conflict_found' | 'conflict_found' | 'fetch_blocked';
  counterevidence: Evidence[];
  note: string;
}

export interface AdversarialResult {
  model: string;
  checks: AdversarialCheck[];
}

const RISK_CUE =
  /\b(first|only|oldest|largest|never|invented|coined|famously|allegedly|supposedly|legends?|myths?|apocryphal)\b/i;
const LONG_QUOTE =
  /"[^"\n]{15,}"|“[^”\n]{15,}”|‘[^’\n]{15,}’|(?<!\w)'[^'\n]{15,}'(?!\w)/u;

function datasetYearOnly(
  finding: Assessment['findings'][number],
  subject: string | undefined,
  dates: Assessment['subject_dates'],
): boolean {
  const claim = normalizeText(finding.claim).replace(/\.$/, '');
  const recorded = dates.filter(({ path }) => path === finding.path);
  if (!recorded.length) return false;
  const matchesYear = (label: string, boundary?: 'start' | 'end') => {
    const match = /^(?:(AD|CE) )?(\d{1,4})(?: (BCE?|AD|CE))?$/i.exec(label);
    const year = Number(match?.[2]);
    if (!year || (match?.[1] && match[3])) return false;
    const astronomicalYear = match?.[3]?.toUpperCase().startsWith('BC')
      ? 1 - year
      : year;
    return recorded.some(
      (date) =>
        (boundary === undefined || date.boundary === boundary) &&
        date.year === astronomicalYear,
    );
  };
  if (/^key_moments\.\d+\.date$/.test(finding.path) && matchesYear(claim))
    return true;

  const name = subject?.toLowerCase();
  return claim.split(/ and /i).every((clause, index) => {
    const match =
      /^(?:(.+?) )?(was born|died|started|began|ended|was founded|was established|was dissolved) (?:in )?(.+)$/i.exec(
        clause,
      );
    if (!match?.[2] || !match[3]) return false;
    const actor = match[1]?.toLowerCase();
    if (
      actor
        ? actor !== name &&
          actor !== name?.split(' ').at(-1) &&
          !['he', 'she', 'it', 'the subject'].includes(actor)
        : index === 0
    )
      return false;
    const boundary = ['died', 'ended', 'was dissolved'].includes(
      match[2].toLowerCase(),
    )
      ? 'end'
      : 'start';
    return matchesYear(match[3], boundary);
  });
}

export function selectAdversarialTargets(
  profile: Parameters<typeof passages>[0] & { subject?: string },
  assessment: Assessment,
): AdversarialTarget[] {
  const passageText = new Map(
    passages(profile).map(({ path, text }) => [path, text]),
  );
  return assessment.findings
    .flatMap((finding, finding_index) => {
      const { path, claim } = finding;
      const text = passageText.get(path);
      if (
        text === undefined ||
        finding.verdict !== 'supported' ||
        datasetYearOnly(finding, profile.subject, assessment.subject_dates)
      )
        return [];
      const claimCue = RISK_CUE.test(claim) || LONG_QUOTE.test(claim);
      const priority = path.startsWith('deep_facts.')
        ? 1
        : finding.risk === 'corroborate'
          ? 2
          : claimCue || RISK_CUE.test(text) || LONG_QUOTE.test(text)
            ? 3
            : undefined;
      if (priority === undefined) return [];
      return [
        {
          priority,
          claimCue,
          target: {
            finding_index,
            path,
            claim,
            claim_hash: hash({ path, claim }),
            passage_text: text,
            existing_counterevidence: finding.counterevidence ?? [],
          },
        },
      ];
    })
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        (a.priority === 3 ? Number(b.claimCue) - Number(a.claimCue) : 0) ||
        a.target.finding_index - b.target.finding_index,
    )
    .slice(0, 5)
    .map(({ target }) => target);
}

const PROMPT_FILE = 'profile-adversarial.md';

function adversarialInput(
  profile: ModelProfile,
  subject: ProfileSubject,
  assessment: Assessment,
  targets: readonly AdversarialTarget[],
  sources: readonly Source[],
) {
  const cited = new Set(
    assessment.findings.flatMap((finding) =>
      findingExcerpts(finding).map(({ source }) => source),
    ),
  );
  const urls = [
    profile.wikipedia_url,
    ...profile.key_moments.map(({ source }) => source),
    ...profile.deep_facts.map(({ source }) => source),
    ...sources.filter(({ id }) => cited.has(id)).map(({ url }) => url),
  ];
  const cited_urls = [
    ...new Set(
      urls.flatMap((value) => {
        try {
          const url = new URL(value);
          url.hash = '';
          return [url.href];
        } catch {
          return [];
        }
      }),
    ),
  ];
  return JSON.stringify({
    subject: subjectBrief(subject),
    targets: targets.map(({ claim_hash: _hash, ...target }) => target),
    cited_urls,
  });
}

export function adversarialPrompt(
  profile: ModelProfile,
  subject: ProfileSubject,
  assessment: Assessment,
  targets: readonly AdversarialTarget[],
  sources: readonly Source[] = [],
): string {
  return (
    readPromptText(PROMPT_FILE) +
    adversarialInput(profile, subject, assessment, targets, sources)
  );
}

export function parseAdversarialResult(
  value: unknown,
  targets: readonly Pick<AdversarialTarget, 'finding_index' | 'path'>[],
): AdversarialCheck[] {
  const expected = new Map(
    targets.map(({ finding_index, path }) => [finding_index, path]),
  );
  const row = asRecord(value, 'adversarial result');
  const checks = asArray(row.checks, 'adversarial checks').map((item) => {
    const check = asRecord(item, 'adversarial check');
    const { finding_index } = check;
    const path = asString(check.path, 'adversarial path');
    if (
      typeof finding_index !== 'number' ||
      expected.get(finding_index) !== path
    )
      throw new Error(`Invalid or duplicate adversarial finding: ${path}`);
    expected.delete(finding_index);
    const outcome = oneOf(
      check.outcome,
      ['no_conflict_found', 'conflict_found', 'fetch_blocked'],
      'adversarial outcome',
    );
    const queries = strings(check.queries, 'adversarial queries');
    const counterevidence = parseExcerpts(
      check.counterevidence,
      'adversarial counterevidence',
    );
    const note = asString(check.note, 'adversarial note');
    if (
      !queries.length ||
      queries.some((query) => !query.trim()) ||
      !note.trim()
    )
      throw new Error(`${path}: adversarial check needs queries and a note`);
    if (outcome === 'conflict_found' && !counterevidence.length)
      throw new Error(`${path}: adversarial conflict needs counterevidence`);
    if (
      counterevidence.some(
        ({ source, quote, origin }) =>
          !/^[a-f0-9]{64}$/.test(source) || !quote.trim() || !origin.trim(),
      )
    )
      throw new Error(`${path}: invalid adversarial counterevidence excerpt`);
    return { finding_index, path, queries, outcome, counterevidence, note };
  });
  if (expected.size)
    throw new Error('Missing adversarial checks for selected findings');
  return checks.sort((a, b) => a.finding_index - b.finding_index);
}

export function mergeAdversarialResult(
  assessment: Assessment,
  result: Pick<AdversarialResult, 'checks'>,
): Assessment {
  const checks = new Map(
    result.checks.map((check) => [check.finding_index, check]),
  );
  return {
    ...assessment,
    findings: assessment.findings.map((finding, index) => {
      const check = checks.get(index);
      if (check?.path !== finding.path || !check.counterevidence.length)
        return finding;
      const excerpts = new Map<string, Evidence>();
      for (const item of [
        ...(finding.counterevidence ?? []),
        ...check.counterevidence,
      ]) {
        const key = JSON.stringify([item.source, normalizeText(item.quote)]);
        if (!excerpts.has(key)) excerpts.set(key, item);
      }
      return { ...finding, counterevidence: [...excerpts.values()] };
    }),
  };
}
