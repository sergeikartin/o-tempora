import { assertBoldOnlyMarkup } from './markup.ts';
import {
  type CheckVerdict,
  CheckVerdictSchema,
  computeEnglishSourceHash,
  formatZodIssues,
  type ProfileDraft,
  ProfileDraftSchema,
  type ProfileLocale,
  type ProfilePatch,
  ProfilePatchSchema,
  type StoredProfile,
} from './schemas.ts';
import { canonicalSourceKey, type SourceIndex } from './sources.ts';
import { formatDates, type ProfileSubject } from './subjects.ts';

export interface ValidationResult<T = unknown> {
  ok: boolean;
  issues: string[];
  data?: T;
}

const ROMAN_VALUES: Record<string, number> = {
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
  XI: 11,
  XII: 12,
  XIII: 13,
  XIV: 14,
  XV: 15,
  XVI: 16,
  XVII: 17,
  XVIII: 18,
  XIX: 19,
  XX: 20,
  XXI: 21,
};

function extractNumbers(text: string, includeRoman: boolean): Set<string> {
  const values = new Set<string>();
  const normalized = text.replace(/(\d)[,\u00A0\s](?=\d{3}\b)/g, '$1');
  for (const match of normalized.matchAll(/\d+/g)) {
    values.add(String(Number(match[0])));
  }
  if (includeRoman) {
    for (const match of text.matchAll(/\b([IVX]{2,5})\b/g)) {
      const roman = match[1];
      const numeric = roman ? ROMAN_VALUES[roman] : undefined;
      if (numeric !== undefined) values.add(String(numeric));
    }
  }
  return values;
}

function checkDateLabel(label: string, where: string, issues: string[]): void {
  if (/\b0\s*(?:BC|BCE|AD|CE)\b/i.test(label) || /^0$/.test(label.trim())) {
    issues.push(`${where}: historical year zero is invalid ("${label}")`);
  }
  const rangeMatch =
    /^\s*(?:c\.\s*)?(?:AD\s+)?(\d{1,4})\s*[–-]\s*(?:c\.\s*)?(?:AD\s+)?(\d{1,4})(?:\s*(BC|BCE|AD|CE))?\s*$/i.exec(
      label,
    );
  if (rangeMatch?.[1] && rangeMatch[2]) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    const era = (rangeMatch[3] ?? '').toUpperCase();
    const isBc = era === 'BC' || era === 'BCE';
    if (isBc ? start < end : start > end) {
      issues.push(`${where}: reversed year range "${label}"`);
    }
  }
}

function checkBoldMarkup(text: string, where: string, issues: string[]): void {
  try {
    assertBoldOnlyMarkup(text, where);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }
}

export interface ValidateDraftOptions {
  locale: ProfileLocale;
  subject: ProfileSubject;
  subjectByQid: ReadonlyMap<string, ProfileSubject>;
  sourceIndex?: SourceIndex;
  englishProfile?: StoredProfile;
}

export function validateDraft(
  raw: unknown,
  {
    locale,
    subject,
    subjectByQid,
    sourceIndex,
    englishProfile,
  }: ValidateDraftOptions,
): ValidationResult<ProfileDraft> {
  const parsed = ProfileDraftSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issues: formatZodIssues(parsed.error) };
  }

  const draft = parsed.data;
  const issues: string[] = [];

  if (draft.qid !== subject.qid) {
    issues.push(`qid: expected ${subject.qid}, got ${draft.qid}`);
  }

  const expectedDates = formatDates(subject.dateSpan);
  if (draft.subjectDates !== expectedDates) {
    issues.push(
      `subjectDates: expected "${expectedDates}", got "${draft.subjectDates}"`,
    );
  }

  checkBoldMarkup(draft.overview, 'overview', issues);
  draft.keyMoments.forEach((moment, i) => {
    checkBoldMarkup(moment.date, `keyMoments.${i}.date`, issues);
    checkBoldMarkup(moment.title, `keyMoments.${i}.title`, issues);
    checkBoldMarkup(moment.text, `keyMoments.${i}.text`, issues);
    checkDateLabel(moment.date, `keyMoments.${i}.date`, issues);
  });
  draft.deepFacts.forEach((fact, i) => {
    checkBoldMarkup(fact.text, `deepFacts.${i}.text`, issues);
  });

  const seenConnections = new Set<string>();
  draft.connections.forEach((connection, i) => {
    checkBoldMarkup(connection.reason, `connections.${i}.reason`, issues);
    if (connection.qid === subject.qid) {
      issues.push(`connections.${i}.qid: cannot connect subject to itself`);
    } else if (!subjectByQid.has(connection.qid)) {
      issues.push(
        `connections.${i}.qid: ${connection.qid} is not an entity in the dataset`,
      );
    }
    if (seenConnections.has(connection.qid)) {
      issues.push(`connections.${i}.qid: duplicate target ${connection.qid}`);
    }
    seenConnections.add(connection.qid);
  });

  if (locale === 'en') {
    const checkCachedUrl = (url: string | undefined, where: string) => {
      if (!url) {
        issues.push(`${where}: sourceUrl is required for English drafts`);
        return;
      }
      if (sourceIndex) {
        const key = canonicalSourceKey(url);
        if (!sourceIndex[key]) {
          issues.push(
            `${where}: ${url} has not been fetched via fetch-source (not in .work/sources/index.json)`,
          );
        }
      }
    };
    draft.keyMoments.forEach((moment, i) => {
      checkCachedUrl(moment.sourceUrl, `keyMoments.${i}.sourceUrl`);
    });
    draft.deepFacts.forEach((fact, i) => {
      checkCachedUrl(fact.sourceUrl, `deepFacts.${i}.sourceUrl`);
    });
  } else {
    if (!englishProfile) {
      issues.push(
        `Russian draft for ${subject.qid} requires a committed English Profile`,
      );
    } else {
      const expectedHash = computeEnglishSourceHash(englishProfile);
      if (draft.sourceHash !== expectedHash) {
        issues.push(
          `sourceHash: expected "${expectedHash}", got "${draft.sourceHash ?? ''}"`,
        );
      }
      if (draft.keyMoments.length !== englishProfile.keyMoments.length) {
        issues.push(
          `keyMoments: expected ${englishProfile.keyMoments.length} items to match English, got ${draft.keyMoments.length}`,
        );
      }
      if (draft.deepFacts.length !== englishProfile.deepFacts.length) {
        issues.push(
          `deepFacts: expected ${englishProfile.deepFacts.length} items to match English, got ${draft.deepFacts.length}`,
        );
      }
      if (draft.connections.length !== englishProfile.connections.length) {
        issues.push(
          `connections: expected ${englishProfile.connections.length} items to match English, got ${draft.connections.length}`,
        );
      }

      const checkRussianField = (
        englishText: string,
        russianText: string,
        where: string,
        requireCyrillic = true,
      ) => {
        if (requireCyrillic && !/[А-Яа-яЁё]/.test(russianText)) {
          issues.push(`${where}: expected Russian (Cyrillic) prose`);
        }
        if (englishText.includes('**') && !russianText.includes('**')) {
          issues.push(`${where}: missing **bold** emphasis present in English`);
        }
        const enNumbers = extractNumbers(englishText, false);
        const ruNumbers = extractNumbers(russianText, true);
        for (const num of enNumbers) {
          if (!ruNumbers.has(num)) {
            issues.push(
              `${where}: missing numeric value "${num}" present in English`,
            );
          }
        }
      };

      checkRussianField(englishProfile.overview, draft.overview, 'overview');
      const momentCount = Math.min(
        draft.keyMoments.length,
        englishProfile.keyMoments.length,
      );
      for (let i = 0; i < momentCount; i += 1) {
        const enMoment = englishProfile.keyMoments[i];
        const ruMoment = draft.keyMoments[i];
        if (!enMoment || !ruMoment) continue;
        checkRussianField(
          enMoment.date,
          ruMoment.date,
          `keyMoments.${i}.date`,
          false,
        );
        checkRussianField(
          enMoment.title,
          ruMoment.title,
          `keyMoments.${i}.title`,
        );
        checkRussianField(enMoment.text, ruMoment.text, `keyMoments.${i}.text`);
        if (ruMoment.sourceUrl !== enMoment.sourceUrl) {
          issues.push(
            `keyMoments.${i}.sourceUrl: must match English sourceUrl`,
          );
        }
      }

      const factCount = Math.min(
        draft.deepFacts.length,
        englishProfile.deepFacts.length,
      );
      for (let i = 0; i < factCount; i += 1) {
        const enFact = englishProfile.deepFacts[i];
        const ruFact = draft.deepFacts[i];
        if (!enFact || !ruFact) continue;
        checkRussianField(enFact.text, ruFact.text, `deepFacts.${i}.text`);
        if (ruFact.isLegend !== enFact.isLegend) {
          issues.push(
            `deepFacts.${i}.isLegend: must match English (${enFact.isLegend})`,
          );
        }
        if (ruFact.sourceUrl !== enFact.sourceUrl) {
          issues.push(`deepFacts.${i}.sourceUrl: must match English sourceUrl`);
        }
      }

      const connCount = Math.min(
        draft.connections.length,
        englishProfile.connections.length,
      );
      for (let i = 0; i < connCount; i += 1) {
        const enConn = englishProfile.connections[i];
        const ruConn = draft.connections[i];
        if (!enConn || !ruConn) continue;
        if (ruConn.qid !== enConn.qid) {
          issues.push(
            `connections.${i}.qid: expected ${enConn.qid} to match English, got ${ruConn.qid}`,
          );
        }
        checkRussianField(
          enConn.reason,
          ruConn.reason,
          `connections.${i}.reason`,
        );
      }
    }
  }

  return issues.length === 0
    ? { ok: true, issues: [], data: draft }
    : { ok: false, issues };
}

export function validatePatch(raw: unknown): ValidationResult<ProfilePatch> {
  const parsed = ProfilePatchSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issues: formatZodIssues(parsed.error) };
  }
  return { ok: true, issues: [], data: parsed.data };
}

export function validateCheck(
  raw: unknown,
  expected?: { qid: string; locale: ProfileLocale },
): ValidationResult<CheckVerdict> {
  const parsed = CheckVerdictSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issues: formatZodIssues(parsed.error) };
  }
  const issues: string[] = [];
  if (expected) {
    if (parsed.data.qid !== expected.qid) {
      issues.push(`qid: expected ${expected.qid}, got ${parsed.data.qid}`);
    }
    if (parsed.data.locale !== expected.locale) {
      issues.push(
        `locale: expected ${expected.locale}, got ${parsed.data.locale}`,
      );
    }
  }
  return issues.length === 0
    ? { ok: true, issues: [], data: parsed.data }
    : { ok: false, issues };
}
