import type { ModelProfile } from '../model-profile.js';
import { readPromptText } from '../prompt.js';
import { type ProfileSubject, subjectBrief } from '../subjects.js';
import {
  type Assessment,
  type Evidence,
  findingExcerpts,
  normalizeText,
  type Source,
} from './policy.js';
import { headingPathAt } from './sources.js';

const AUDIT_CONTEXT_WINDOW = 350;

export interface ReAuditContext {
  repaired_paths: string[];
  prior_blockers: string[];
}

export function englishAuditPrompt(
  profile: ModelProfile,
  subject: ProfileSubject,
  assessment: Assessment,
  sources: readonly Source[],
  reAudit?: ReAuditContext,
): string {
  const evidenceBySource = new Map<string, Evidence[]>();
  for (const finding of assessment.findings) {
    for (const item of findingExcerpts(finding)) {
      const items = evidenceBySource.get(item.source) ?? [];
      items.push(item);
      evidenceBySource.set(item.source, items);
    }
  }

  const sourceNumbers = new Map(
    [...evidenceBySource.keys()].map((id, index) => [id, index + 1]),
  );
  const contextIndexes = new Map<Evidence, number>();
  const sourceContexts = sources.flatMap((source) => {
    const items = evidenceBySource.get(source.id);
    if (!items) return [];
    const text = normalizeText(source.text);
    const headings = source.headings ?? [];
    const ranges = items
      .map((item) => {
        const quote = normalizeText(item.quote);
        return {
          item,
          length: quote.length,
          index: quote ? text.indexOf(quote) : -1,
        };
      })
      .filter(({ index }) => index >= 0)
      .sort((a, b) => a.index - b.index);
    const excerpts: { start: number; end: number; sectionOffset: number }[] =
      [];
    let nextHeading = 0;
    for (const { item, index, length } of ranges) {
      while (
        nextHeading < headings.length &&
        (headings[nextHeading]?.offset ?? Infinity) <= index
      )
        nextHeading++;
      const sectionOffset = headings[nextHeading - 1]?.offset ?? 0;
      const sectionEnd = headings[nextHeading]?.offset ?? text.length;
      const start = Math.max(sectionOffset, index - AUDIT_CONTEXT_WINDOW);
      // Retain the evidence itself even when the quotation spans a heading.
      const end = Math.max(
        index + length,
        Math.min(sectionEnd, index + length + AUDIT_CONTEXT_WINDOW),
      );
      const last = excerpts.at(-1);
      if (last && last.sectionOffset === sectionOffset && start <= last.end)
        last.end = Math.max(last.end, end);
      else excerpts.push({ start, end, sectionOffset });
      contextIndexes.set(item, excerpts.length - 1);
    }
    return [
      {
        source: sourceNumbers.get(source.id),
        url: source.url,
        title: source.title,
        excerpts: excerpts.map(({ start, end, sectionOffset }) => ({
          section: headingPathAt(headings, sectionOffset),
          text: text.slice(start, end),
        })),
      },
    ];
  });
  const withContext = (item: Evidence) => ({
    ...item,
    source: sourceNumbers.get(item.source),
    source_excerpt_index: contextIndexes.get(item) ?? null,
  });
  const findings = assessment.findings.map(
    ({ explanation, correction, ...finding }) => ({
      ...finding,
      ...(finding.verdict !== 'supported' ? { explanation } : {}),
      ...(correction ? { correction } : {}),
      evidence: finding.evidence.map(withContext),
      ...(finding.counterevidence?.length
        ? { counterevidence: finding.counterevidence.map(withContext) }
        : {}),
    }),
  );
  const { covered: _covered, ...assessmentFields } = assessment;
  return (
    readPromptText('profile-audit.md') +
    JSON.stringify({
      subject: subjectBrief(subject),
      profile,
      assessment: { ...assessmentFields, findings },
      source_contexts: sourceContexts,
      ...(reAudit ? { re_audit: reAudit } : {}),
    })
  );
}
