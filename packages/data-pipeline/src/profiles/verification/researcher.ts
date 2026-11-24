import OpenAI from 'openai';
import type { ResponseInputItem } from 'openai/resources/responses/responses';
import type { ModelProfile } from '../model-profile.js';
import { passages } from '../passages.js';
import { readPromptText } from '../prompt.js';
import type { Complete, Completion } from '../providers.js';
import { type ProfileSubject, subjectBrief } from '../subjects.js';
import { asRecord, extractJson } from '../values.js';
import {
  type Assessment,
  type Evidence,
  findingExcerpts,
  parseAssessment,
  parseAudit,
  type Report,
  type Source,
} from './policy.js';
import type { SourceStore } from './sources.js';

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
          {
            type: 'function',
            name: 'read_source',
            description:
              'Fetch an exact excerpt from a public HTTPS article. Use a literal name, phrase or year as query to jump to its first match at or after offset, or null to read from offset. Start at offset 0; use next_offset with query=null to continue reading. An empty result for a query means the phrase was not found. Evidence must cite the returned content hash and quote the returned text. PDF and login-only pages are unsupported; seek a readable alternative.',
            strict: true,
            parameters: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                offset: { type: 'integer', minimum: 0 },
                query: { type: ['string', 'null'] },
              },
              required: ['url', 'offset', 'query'],
              additionalProperties: false,
            },
          },
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
        let output: unknown;
        try {
          if (call.name !== 'read_source')
            throw new Error('Unknown verification tool');
          const args = asRecord(JSON.parse(call.arguments), 'read_source');
          const { id, url, text, offset, next_offset } =
            await sources.readExcerpt(args);
          output = {
            id,
            url,
            text,
            offset,
            next_offset,
          };
        } catch (error) {
          output = {
            error: error instanceof Error ? error.message : String(error),
            retryable: true,
          };
        }
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
): string {
  const evidenceBySource = new Map<string, Evidence[]>();
  for (const finding of assessment.findings) {
    for (const item of findingExcerpts(finding)) {
      const items = evidenceBySource.get(item.source) ?? [];
      items.push(item);
      evidenceBySource.set(item.source, items);
    }
  }

  const contextIndexes = new Map<Evidence, number>();
  const sourceContexts = sources.flatMap((source) => {
    const items = evidenceBySource.get(source.id);
    if (!items) return [];
    const ranges = items
      .map((item) => ({ item, index: source.text.indexOf(item.quote) }))
      .filter(({ index }) => index >= 0)
      .sort((a, b) => a.index - b.index);
    const excerpts: { start: number; end: number }[] = [];
    for (const { item, index } of ranges) {
      const start = Math.max(0, index - 700);
      const end = Math.min(source.text.length, index + item.quote.length + 700);
      const last = excerpts.at(-1);
      if (last && start <= last.end) last.end = Math.max(last.end, end);
      else excerpts.push({ start, end });
      contextIndexes.set(item, excerpts.length - 1);
    }
    return [
      {
        source: source.id,
        url: source.url,
        excerpts: excerpts.map(({ start, end }) =>
          source.text.slice(start, end),
        ),
      },
    ];
  });
  const withContext = (item: Evidence) => ({
    ...item,
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
      passages: passages(profile),
      assessment: { ...assessment, findings },
      source_contexts: sourceContexts,
    })
  );
}

export async function auditProfile(
  profile: ModelProfile,
  subject: ProfileSubject,
  assessment: Assessment,
  sources: readonly Source[],
  complete: Complete,
): Promise<{
  audit: Report['audit'];
  model: string;
  tokens: Completion['tokens'];
}> {
  const response = await complete(
    englishAuditPrompt(profile, subject, assessment, sources),
    'audit',
  );
  return {
    audit: parseAudit(extractJson(response.text)),
    model: response.model,
    tokens: response.tokens,
  };
}
