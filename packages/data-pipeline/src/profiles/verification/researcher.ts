import OpenAI from 'openai';
import type { ResponseInputItem } from 'openai/resources/responses/responses';
import type { ModelProfile } from '../model-profile.js';
import { passages } from '../passages.js';
import { readPromptText } from '../prompt.js';
import type { Complete, Completion } from '../providers.js';
import { type ProfileSubject, subjectBrief } from '../subjects.js';
import { extractJson } from '../values.js';
import type { AdversarialCheck } from './adversarial.js';
import {
  type Assessment,
  type Evidence,
  findingExcerpts,
  normalizeText,
  parseAssessment,
  parseAudit,
  type Report,
  type Source,
} from './policy.js';
import {
  headingPathAt,
  readSourceTool,
  readSourceToolOutput,
  type SourceStore,
} from './sources.js';

export type Research = (
  profile: ModelProfile,
  subject: ProfileSubject,
  sources: SourceStore,
) => Promise<{ assessment: Assessment; model: string }>;

// Web search discovers candidates; only the local fetch tool can supply evidence
// that the deterministic gate will accept. Each pass has fixed research limits.
export function createResearcher(model: string): Research {
  const client = new OpenAI({ timeout: 180_000, maxRetries: 2 });
  return async (profile, subject, sources) => {
    const instructions = readPromptText('profile-research.md').slice(0, -1);
    const input: ResponseInputItem[] = [
      {
        role: 'user',
        content: JSON.stringify({
          profile,
          subject: subjectBrief(subject),
          passages: passages(profile),
        }),
      },
    ];
    let reads = 0;
    let searches = 0;
    for (let turn = 0; turn < 12; turn++) {
      const response = await client.responses.create({
        model,
        instructions,
        input,
        store: false,
        include: ['reasoning.encrypted_content'],
        reasoning: { effort: 'high' },
        max_output_tokens: 24_000,
        max_tool_calls: 8,
        tools: [
          ...(searches < 16 ? [{ type: 'web_search' as const }] : []),
          readSourceTool,
        ],
      });
      if (response.status !== 'completed')
        throw new Error(`Verification model stopped: ${response.status}`);
      for (const item of response.output) {
        if (
          item.type === 'message' ||
          item.type === 'reasoning' ||
          item.type === 'function_call' ||
          item.type === 'web_search_call'
        )
          input.push(item);
        else throw new Error(`Unexpected verification output: ${item.type}`);
      }
      searches += response.output.filter(
        (item) => item.type === 'web_search_call',
      ).length;
      const calls = response.output.filter(
        (item) => item.type === 'function_call',
      );
      if (!calls.length)
        return {
          assessment: parseAssessment(extractJson(response.output_text)),
          model: response.model,
        };
      for (const call of calls) {
        if (++reads > 24)
          throw new Error('Verification exhausted its source-read budget');
        if (call.name !== readSourceTool.name)
          throw new Error('Unknown verification tool');
        const output = await readSourceToolOutput(sources, call.arguments);
        input.push({
          type: 'function_call_output',
          call_id: call.call_id,
          output: JSON.stringify(output),
        });
      }
    }
    throw new Error('Verification exhausted its research-turn budget');
  };
}

export function englishAuditPrompt(
  profile: ModelProfile,
  subject: ProfileSubject,
  assessment: Assessment,
  sources: readonly Source[],
  adversarialChecks: readonly AdversarialCheck[] = [],
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
      const start = Math.max(sectionOffset, index - 700);
      // Retain the evidence itself even when the quotation spans a heading.
      const end = Math.max(
        index + length,
        Math.min(sectionEnd, index + length + 700),
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
  const findings = assessment.findings.map((finding) => ({
    ...finding,
    evidence: finding.evidence.map(withContext),
    counterevidence: finding.counterevidence?.map(withContext),
  }));
  return (
    readPromptText('profile-audit.md') +
    JSON.stringify({
      subject: subjectBrief(subject),
      profile,
      assessment: { ...assessment, findings },
      source_contexts: sourceContexts,
      adversarial_notes: adversarialChecks
        .filter(({ outcome }) => outcome !== 'no_conflict_found')
        .map(({ finding_index, path, outcome, note }) => ({
          finding_index,
          path,
          outcome,
          note,
        })),
    })
  );
}

export async function auditProfile(
  profile: ModelProfile,
  subject: ProfileSubject,
  assessment: Assessment,
  sources: readonly Source[],
  complete: Complete,
  adversarialChecks?: readonly AdversarialCheck[],
): Promise<{
  audit: Report['audit'];
  model: string;
  tokens: Completion['tokens'];
}> {
  const response = await complete(
    englishAuditPrompt(
      profile,
      subject,
      assessment,
      sources,
      adversarialChecks,
    ),
    'audit',
  );
  return {
    audit: parseAudit(extractJson(response.text)),
    model: response.model,
    tokens: response.tokens,
  };
}
