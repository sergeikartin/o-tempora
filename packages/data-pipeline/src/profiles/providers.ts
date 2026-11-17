import Anthropic from '@anthropic-ai/sdk';
import { FinishReason, GoogleGenAI, ThinkingLevel } from '@google/genai';
import OpenAI from 'openai';
import type { TokenUsage } from './usage.js';

export const PROVIDERS = ['openai', 'anthropic', 'gemini'] as const;
export type Provider = (typeof PROVIDERS)[number];

export const DEFAULT_MODEL: Record<Provider, string> = {
  openai: 'gpt-6-astra',
  anthropic: 'claude-opus-5-5',
  gemini: 'gemini-4-argon',
};

// Reasoning tokens count against the output cap, so it leaves room for them
// beyond the ~6k tokens of a Profile.
const MAX_OUTPUT_TOKENS = 32_000;

export interface Completion {
  text: string;
  // The model the provider reports having served, recorded in `meta.model`.
  model: string;
  reasoningEffort?: string | null;
  tokens: TokenUsage | null;
}

export type Complete = (
  prompt: string,
  role?: 'write' | 'audit' | 'repair' | 'translate' | 'translation-audit',
) => Promise<Completion>;

export function isProvider(value: string): value is Provider {
  return (PROVIDERS as readonly string[]).includes(value);
}

// Credentials come from `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` and
// `GEMINI_API_KEY`. Sampling parameters are left at the provider default:
// the current models of both reject or ignore them.
function openAiCompleter(model: string): Complete {
  const client = new OpenAI();
  return async (prompt) => {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      reasoning_effort: 'high',
      max_completion_tokens: MAX_OUTPUT_TOKENS,
    });
    const choice = response.choices[0];
    if (!choice) throw new Error('OpenAI returned no choices');
    if (choice.message.refusal) {
      throw new Error(`OpenAI refused: ${choice.message.refusal}`);
    }
    if (choice.finish_reason !== 'stop' || !choice.message.content) {
      throw new Error(`OpenAI stopped early: ${choice.finish_reason}`);
    }
    return {
      text: choice.message.content,
      model: response.model,
      reasoningEffort: 'high',
      tokens: {
        input: response.usage?.prompt_tokens ?? 0,
        output: response.usage?.completion_tokens ?? 0,
      },
    };
  };
}

function anthropicCompleter(model: string): Complete {
  const client = new Anthropic();
  return async (prompt) => {
    const message = await client.messages
      .stream({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        output_config: { effort: 'high' },
        messages: [{ role: 'user', content: prompt }],
      })
      .finalMessage();
    if (message.stop_reason !== 'end_turn') {
      throw new Error(`Anthropic stopped early: ${message.stop_reason}`);
    }
    const text = message.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('');
    return {
      text,
      model: message.model,
      reasoningEffort: 'high',
      tokens: {
        input: message.usage.input_tokens,
        output: message.usage.output_tokens,
      },
    };
  };
}

function geminiCompleter(model: string): Complete {
  // The Gemini SDK does not look the key up in the environment itself.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const client = new GoogleGenAI({ apiKey });
  return async (prompt) => {
    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
    });
    const candidate = response.candidates?.[0];
    if (!candidate) {
      throw new Error(
        `Gemini returned no candidates: ${response.promptFeedback?.blockReason ?? 'unknown reason'}`,
      );
    }
    if (candidate.finishReason !== FinishReason.STOP || !response.text) {
      throw new Error(`Gemini stopped early: ${candidate.finishReason}`);
    }
    const usage = response.usageMetadata;
    return {
      text: response.text,
      model: response.modelVersion ?? model,
      reasoningEffort: 'high',
      tokens: {
        input: usage?.promptTokenCount ?? 0,
        // Thinking tokens are billed as output but counted separately.
        output:
          (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
      },
    };
  };
}

const COMPLETERS: Record<Provider, (model: string) => Complete> = {
  openai: openAiCompleter,
  anthropic: anthropicCompleter,
  gemini: geminiCompleter,
};

export function createCompleter(provider: Provider, model: string): Complete {
  return COMPLETERS[provider](model);
}
