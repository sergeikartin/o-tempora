import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PROMPT_PATH, WRITER_AGENT_PATH } from './paths.js';

export interface PromptInfo {
  version: string;
  // First 12 hex chars of the sha256 of the prompt block, trailing newline
  // included; the value `prompts/profile.md` states for itself.
  hash: string;
}

const PROMPT_BLOCK = /## Prompt[\s\S]*?```text\n([\s\S]*?)```/;
const VERSION_LINE = /^- \*\*Version:\*\* (\S+)$/m;

function promptBlock(markdown: string): string | undefined {
  return PROMPT_BLOCK.exec(markdown)?.[1];
}

export function parsePrompt(markdown: string): PromptInfo {
  const block = promptBlock(markdown);
  const version = VERSION_LINE.exec(markdown)?.[1];
  if (block === undefined || version === undefined) {
    throw new Error(
      'profile.md: expected a "- **Version:**" line and a "## Prompt" text block',
    );
  }
  return {
    version,
    hash: createHash('sha256').update(block).digest('hex').slice(0, 12),
  };
}

export async function loadPrompt(): Promise<PromptInfo> {
  return parsePrompt(await readFile(PROMPT_PATH, 'utf8'));
}

// The writer agent's `model:` frontmatter value, recorded in `meta.model`: a
// subagent does not report the exact model ID it ran on.
export function parseAgentModel(agentMarkdown: string): string {
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(agentMarkdown)?.[1];
  const model = frontmatter && /^model:\s*(\S+)$/m.exec(frontmatter)?.[1];
  if (!model) throw new Error('profile-writer.md: no "model:" in frontmatter');
  return model;
}

export async function loadWriterModel(): Promise<string> {
  return parseAgentModel(await readFile(WRITER_AGENT_PATH, 'utf8'));
}
