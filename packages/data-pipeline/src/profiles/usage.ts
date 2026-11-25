import { asRecord } from './values.ts';

export interface TokenUsage {
  input: number;
  output: number;
}

export function parseTokenUsage(value: unknown): TokenUsage | null {
  if (value === undefined || value === null) return null;
  const usage = asRecord(value, 'tokens');
  const { input, output } = usage;
  if (
    typeof input !== 'number' ||
    typeof output !== 'number' ||
    !Number.isSafeInteger(input) ||
    !Number.isSafeInteger(output) ||
    input < 0 ||
    output < 0
  ) {
    throw new Error(
      'tokens: expected nonnegative integer input and output counts',
    );
  }
  return { input, output };
}

export interface AgentRunMeta {
  model: string;
  reasoningEffort?: string | null;
  tokens: TokenUsage | null;
}
